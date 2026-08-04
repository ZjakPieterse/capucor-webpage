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
 *   1. Rate-limit per IP (same bucket as /api/leads).
 *   2. Validate body with ProposalRequestSchema.
 *   3. Recompute pricing server-side from the live `brackets` table — the
 *      client payload is config only (services / brackets / tier); prices come
 *      from the DB so the client cannot tamper.
 *   4. Insert a lead (contact captured & stored) and a proposals row carrying
 *      an opaque token. Both go through the service-role admin client.
 *   5. Email the proposal link to the client + a reference copy to the owner.
 *
 * The client reviews and signs at /proposal/<token>. Signing is the debit-order
 * mandate and triggers portal provisioning (PR9, in /api/proposals/sign) — there
 * is no on-site payment step; collection is set up manually via Paysoft Flow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProposalRequestSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/getClientIp';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { priceProposalSelection } from '@/lib/proposalPricing';
import { generateOpaqueToken } from '@/lib/token';
import { CONSENT_VERSION, CONSENT_LANGUAGE } from '@/lib/consent';
import { siteConfig } from '@/config/site';
import { tierDisplayName } from '@/config/tiers';
import { sendEmail } from '@/lib/email/sendEmail';
import { renderCreatedProposalClientEmail, renderCreatedProposalOwnerText } from '@/lib/email/messages.mjs';

const PROPOSAL_TTL_DAYS = 7;

export async function POST(req: NextRequest) {
  // 1. Per-IP rate limit
  const ip = getClientIp(req.headers);

  const { allowed, retryAfter } = await checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

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
  const admin = createSupabaseAdminClient();

  // 5. Recompute pricing server-side from the live brackets (anti-tamper).
  const priced = await priceProposalSelection(admin, {
    services: input.services,
    brackets: input.brackets,
    tierSlug: input.tierSlug,
    addons: input.addons,
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
        source: 'proposal',
        name: fullName,
        business: input.businessName,
        email: input.email,
        config: {
          services: input.services,
          brackets: input.brackets,
          tier: input.tierSlug,
          addons: addonSlugs,
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
