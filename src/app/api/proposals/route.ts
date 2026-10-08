/**
 * POST /api/proposals
 *
 * Activate-modal endpoint for the pricing calculator. Ignition-style: instead
 * of sending the visitor to a payment page, we capture light contact details,
 * store them as a lead, and generate a PROPOSAL from the selected package that
 * is emailed to the client (to review + sign) and copied to a central Capucor
 * inbox for reference.
 *
 * Flow:
 *   1. Rate-limit per IP (its own bucket, not shared with /api/leads).
 *   2. Validate body with ProposalRequestSchema.
 *   3. Recompute pricing server-side from the live `brackets` table — the
 *      client payload is config only (services / brackets / tier); prices come
 *      from the DB so the client cannot tamper.
 *   4. Insert a lead (contact captured & stored) and a proposals row carrying
 *      an opaque token. Both go through the service-role admin client.
 *   5. Email the proposal link to the client + a reference copy to the owner.
 *
 * A package sold by application (Premium) takes intent 'request' instead:
 * steps 1 to 4 run as above (pricing included, as an estimate for Capucor),
 * the lead is stored with source 'call', Capucor is told by email, and no
 * proposal row is created (tweaks round 1, 2026-10-06).
 *
 * The client reviews and signs at /proposal/<token>. Signing is the debit-order
 * mandate and stops at `signed` + the signed PDF in Drive (web-standalone
 * phase 3) — there is no on-site payment step and no portal record; collection
 * is set up manually via Paysoft Flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProposalRequestSchema } from '@/lib/validations';
import { readJsonBody } from '@/lib/readJsonBody';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/getClientIp';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { priceProposalSelection } from '@/lib/proposalPricing';
import { generateOpaqueToken } from '@/lib/token';
import { CONSENT_VERSION, CONSENT_LANGUAGE } from '@/lib/consent';
import { siteConfig } from '@/config/site';
import { TIERS_BY_APPLICATION, tierDisplayName } from '@/config/tiers';
import { effectiveAddons, revenueNeedsCall } from '@/lib/calculatorFlow';
import { coreServiceError, parseAddonToken } from '@/lib/pricing';
import { formatZAR } from '@/lib/utils';
import { REVENUE_CALL_COPY } from '@/config/calculatorCopy';
import { sendEmail } from '@/lib/email/sendEmail';
import {
  renderCreatedProposalClientEmail,
  renderCreatedProposalOwnerText,
  renderLeadOwnerText,
} from '@/lib/email/messages.mjs';

const PROPOSAL_TTL_DAYS = 7;

// Its own bucket. Creating a proposal writes rows and sends two emails, so it
// keeps the standard allowance rather than the roomier signing one.
const RATE_LIMIT_KEY = 'proposal-create';

// A service selection, its bracket map, a tier slug, up to 5 add-ons and four
// short contact fields. ProposalRequestSchema puts no maximum on `services`, so
// the byte cap is what actually bounds that array.
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(req: NextRequest) {
  // 1. Per-IP rate limit
  const ip = getClientIp(req.headers);

  const { allowed, retryAfter } = await checkRateLimit(ip, { key: RATE_LIMIT_KEY });
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  // 2. Parse body, under a hard byte cap
  const read = await readJsonBody(req, MAX_BODY_BYTES);
  if (!read.ok) {
    return NextResponse.json({ error: read.error }, { status: read.status });
  }
  const body = read.body;

  // 3. Honeypot — silently succeed for bots, do not persist
  if (body && typeof body === 'object' && 'website' in body && (body as Record<string, unknown>).website) {
    return NextResponse.json({ ok: true });
  }

  // 4. Zod validation
  const parsed = ProposalRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue.message, field: issue.path.join('.') }, { status: 422 });
  }

  const input = parsed.data;

  // Premium is sold by application (calculator-v2 Phase 0): the calculator
  // sends a request, never a proposal, and Zjak handles it outside the system
  // (web-standalone decision 5). A request is only for such a package.
  const byApplication = TIERS_BY_APPLICATION.includes(input.tierSlug);
  if (byApplication && input.intent !== 'request') {
    return NextResponse.json(
      {
        error: `${tierDisplayName(input.tierSlug)} starts with a call. Please send a request and we will be in touch.`,
        field: 'tierSlug',
      },
      { status: 422 },
    );
  }
  if (!byApplication && input.intent === 'request') {
    return NextResponse.json(
      { error: 'This package can be accepted or emailed to you directly.', field: 'intent' },
      { status: 422 },
    );
  }

  // Monthly accounting (accounting plus bookkeeping) is in every package (F30).
  const coreError = coreServiceError(input.services, input.brackets);
  if (coreError) {
    return NextResponse.json({ error: coreError, field: 'services' }, { status: 422 });
  }

  // Revenue above R50m starts with a call (decision 2026-10-06), like Premium.
  if (revenueNeedsCall(input.brackets)) {
    return NextResponse.json(
      { error: REVENUE_CALL_COPY.apiError, field: 'brackets.accounting' },
      { status: 422 },
    );
  }

  // The answers, not the client's add-on list, decide the answer-driven tokens:
  // a VAT No adds the flag that hides VAT201. Any such token the client sent is
  // replaced, which also strips the retired Xero invoicing charge.
  // Dext is no longer offered (tweaks round 1, 2026-10-06), so a stale page
  // cannot add it; proposals already carrying the token still price as sent.
  const offeredAddons = input.addons.filter((t) => parseAddonToken(t).slug !== 'dext');
  const addons = effectiveAddons(offeredAddons, {
    vatRegistered: input.answers?.vatRegistered ?? null,
  });

  const admin = createSupabaseAdminClient();

  // 5. Recompute pricing server-side from the live brackets (anti-tamper).
  const priced = await priceProposalSelection(admin, {
    services: input.services,
    brackets: input.brackets,
    tierSlug: input.tierSlug,
    addons,
  });
  if (!priced.ok) {
    return NextResponse.json({ error: priced.error }, { status: priced.status });
  }
  const { addonSlugs, lineItems, monthlyTotalZAR, vatZAR, totalChargeZAR } = priced.data;

  // 6. Persist — lead first (so the contact lands in the existing pipeline),
  //    then the proposal row linked to it.
  const fullName = `${input.firstName} ${input.lastName}`.trim();
  const nowIso = new Date().toISOString();

  let leadId: string | null = null;
  try {
    const { data: leadRow, error: leadErr } = await admin
      .from('leads')
      .insert({
        source: byApplication ? 'call' : 'proposal',
        name: fullName,
        business: input.businessName,
        email: input.email,
        config: {
          services: input.services,
          brackets: input.brackets,
          tier: input.tierSlug,
          addons: addonSlugs,
          // The VAT answer (it also sets the not-VAT-registered flag above) and
          // the review-step action, for Capucor's reference. A stale page may
          // still send the withdrawn Xero-invoicing answer; it is not stored.
          ...(input.answers?.vatRegistered !== undefined && {
            answers: { vatRegistered: input.answers.vatRegistered },
          }),
          ...(input.intent && { intent: input.intent }),
          ...(byApplication && { estimatedMonthlyZAR: monthlyTotalZAR }),
        },
        consent_given: true,
        consent_timestamp: nowIso,
        consent_version: CONSENT_VERSION,
        consent_language: CONSENT_LANGUAGE,
      })
      .select('id')
      .single();

    if (leadErr) throw leadErr;
    leadId = (leadRow?.id as string) ?? null;
  } catch (err) {
    console.error('[PROPOSALS] lead insert error:', err);
    return NextResponse.json({ error: 'Could not save your details. Please try again.' }, { status: 500 });
  }

  // A Premium request ends here: tell Capucor, create no proposal.
  if (byApplication) {
    const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;
    const fields = {
      source: 'call',
      name: fullName,
      email: input.email,
      business: input.businessName,
      message: `${tierDisplayName(input.tierSlug)} request from the calculator. Estimated from ${formatZAR(monthlyTotalZAR)} a month.`,
      config: { services: input.services, brackets: input.brackets, tier: input.tierSlug, addons: addonSlugs },
    };
    if (ownerEmail && leadId) {
      const delivery = await sendEmail({
        sourceType: 'lead',
        sourceId: leadId,
        eventType: 'lead.owner_notification',
        idempotencyKey: `capucor_web_lead_owner_${leadId}`,
        adminClient: admin,
        message: {
          from: siteConfig.email.senderWebsite,
          to: ownerEmail,
          subject: `${tierDisplayName(input.tierSlug)} request: ${input.businessName}`,
          text: renderLeadOwnerText(fields),
        },
      });
      if (delivery.errorCode === 'missing_api_key') {
        console.log(`[PREMIUM REQUEST] business=${input.businessName} email=${input.email}`);
      }
    } else {
      console.log(`[PREMIUM REQUEST] business=${input.businessName} email=${input.email}`);
    }
    return NextResponse.json({ ok: true, requested: true });
  }

  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + PROPOSAL_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Human-readable reference (FT-YYYY-MM-NNNN) assigned by the DB trigger on
  // insert — read it back for the emails.
  let proposalId: string | null = null;
  let refNumber: string | null = null;
  try {
    const { data: propRow, error: propErr } = await admin
      .from('proposals')
      .insert({
        token,
        lead_id: leadId,
        first_name: input.firstName,
        last_name: input.lastName,
        business_name: input.businessName,
        email: input.email,
        services: input.services,
        brackets: input.brackets,
        tier_slug: input.tierSlug,
        addons: addonSlugs,
        monthly_total_zar: monthlyTotalZAR,
        vat_zar: vatZAR,
        total_charge_zar: totalChargeZAR,
        status: 'sent',
        consent_version: CONSENT_VERSION,
        consent_language: CONSENT_LANGUAGE,
        ip_address: ip === 'unknown' ? null : ip,
        user_agent: req.headers.get('user-agent') ?? null,
        sent_at: nowIso,
        expires_at: expiresAt,
      })
      .select('id, ref_number')
      .single();

    if (propErr) throw propErr;
    proposalId = (propRow?.id as string) ?? null;
    refNumber = (propRow?.ref_number as string) ?? null;
    if (!proposalId) throw new Error('Proposal insert did not return an id.');
  } catch (err) {
    console.error('[PROPOSALS] proposal insert error:', err);
    return NextResponse.json({ error: 'Could not generate your proposal. Please try again.' }, { status: 500 });
  }

  // 7. Email the proposal link to the client + a reference copy to the owner.
  //    Non-fatal — the proposal row is already persisted.
  const proposalUrl = `${siteConfig.marketingUrl}/proposal/${token}`;
  const tierName = tierDisplayName(input.tierSlug);
  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;

  const clientDelivery = await sendEmail({
    sourceType: 'proposal',
    sourceId: proposalId,
    eventType: 'proposal.created_client',
    idempotencyKey: `capucor_web_proposal_created_client_${proposalId}`,
    adminClient: admin,
    message: {
      from: siteConfig.email.sender,
      replyTo: siteConfig.email.replyTo,
      to: input.email,
      subject: refNumber ? `Your Capucor proposal (${refNumber}) is ready` : 'Your Capucor proposal is ready',
      html: renderCreatedProposalClientEmail({
        firstName: input.firstName,
        businessName: input.businessName,
        tierName,
        refNumber,
        lineItems,
        totalChargeZAR,
        proposalUrl,
        firstDebitFrom: nowIso,
      }),
    },
  });
  const deliveryStatus = clientDelivery.deliveryStatus;

  if (ownerEmail) {
    await sendEmail({
      sourceType: 'proposal',
      sourceId: proposalId,
      eventType: 'proposal.created_owner',
      idempotencyKey: `capucor_web_proposal_created_owner_${proposalId}`,
      adminClient: admin,
      message: {
        from: siteConfig.email.senderWebsite,
        to: ownerEmail,
        subject: `New proposal: ${input.businessName}${refNumber ? ` (${refNumber})` : ''}`,
        text: renderCreatedProposalOwnerText({
          refNumber,
          fullName,
          businessName: input.businessName,
          email: input.email,
          tierName,
          clientDeliveryStatus: deliveryStatus,
          lineItems,
          totalChargeZAR,
          proposalUrl,
        }),
      },
    });
  }

  if (clientDelivery.errorCode === 'missing_api_key') {
    console.log(`[PROPOSAL] business=${input.businessName} email=${input.email} url=${proposalUrl}`);
  }

  return NextResponse.json({ ok: true, proposalUrl, deliveryStatus });
}
