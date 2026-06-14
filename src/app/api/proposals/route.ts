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
 * The interactive sign + payment step lives on /proposal/<token> and is a
 * Phase-2 stub until the payment provider is chosen.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProposalRequestSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { monthlyTotal, buildLineItems, addonTotal, buildAddonLineItems } from '@/lib/pricing';
import { PRICING_ADDONS } from '@/config/tiers';
import { generateOpaqueToken } from '@/lib/token';
import { CONSENT_VERSION, CONSENT_LANGUAGE } from '@/lib/consent';
import { siteConfig } from '@/config/site';
import { formatZAR } from '@/lib/utils';
import type { Bracket } from '@/types';

const PROPOSAL_TTL_DAYS = 30;

type BracketRow = Pick<
  Bracket,
  'service_slug' | 'ordinal' | 'label' | 'basic_price' | 'pro_price' | 'premium_price'
>;

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export async function POST(req: NextRequest) {
  // 1. Per-IP rate limit
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

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
  if (
    body &&
    typeof body === 'object' &&
    'website' in body &&
    (body as Record<string, unknown>).website
  ) {
    return NextResponse.json({ ok: true });
  }

  // 4. Zod validation
  const parsed = ProposalRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue.message, field: issue.path.join('.') },
      { status: 422 },
    );
  }

  const input = parsed.data;
  const admin = createSupabaseAdminClient();

  // 5. Recompute pricing server-side + build line items from the live brackets.
  let bracketRows: BracketRow[];
  try {
    const { data, error } = await admin
      .from('brackets')
      .select('service_slug, ordinal, label, basic_price, pro_price, premium_price')
      .in('service_slug', input.services)
      .returns<BracketRow[]>();

    if (error || !data) throw error ?? new Error('Brackets fetch returned no rows');
    bracketRows = data;
  } catch (err) {
    console.error('[PROPOSALS] price recomputation failed:', err);
    return NextResponse.json(
      { error: 'Could not price your proposal. Please try again.' },
      { status: 500 },
    );
  }

  // Add-ons: whitelist against the shared config before pricing. The bracket
  // total alone must clear the > 0 guard — an add-on can't carry a proposal.
  const addonSlugs = [...new Set(input.addons)].filter((slug) =>
    PRICING_ADDONS.some((a) => a.slug === slug),
  );

  const bracketTotalZAR = monthlyTotal(input.services, input.brackets, input.tierSlug, bracketRows);
  if (bracketTotalZAR <= 0) {
    return NextResponse.json(
      { error: 'No priced services in your selection. Please pick at least one regular bracket.' },
      { status: 422 },
    );
  }
  const monthlyTotalZAR = bracketTotalZAR + addonTotal(addonSlugs);
  // The configured price is the final, all-in monthly price. VAT is handled in
  // Xero (the billing pipeline), not on-site, so the site records no VAT split.
  const vatZAR = 0;
  const totalChargeZAR = monthlyTotalZAR;

  const serviceCatalogue = input.services.map((slug) => ({ slug, name: titleCase(slug) }));
  const lineItems = [
    ...buildLineItems(
      input.services,
      input.brackets,
      input.tierSlug,
      serviceCatalogue,
      bracketRows,
    ),
    ...buildAddonLineItems(addonSlugs),
  ];

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
    return NextResponse.json(
      { error: 'Could not save your details. Please try again.' },
      { status: 500 },
    );
  }

  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + PROPOSAL_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { error: propErr } = await admin.from('proposals').insert({
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
    });

    if (propErr) throw propErr;
  } catch (err) {
    console.error('[PROPOSALS] proposal insert error:', err);
    return NextResponse.json(
      { error: 'Could not generate your proposal. Please try again.' },
      { status: 500 },
    );
  }

  // 7. Email the proposal link to the client + a reference copy to the owner.
  //    Non-fatal — the proposal row is already persisted.
  const proposalUrl = `${siteConfig.url}/proposal/${token}`;
  const tierName = titleCase(input.tierSlug);
  const resendKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;

  if (resendKey) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);

      await resend.emails.send({
        from: siteConfig.email.sender,
        replyTo: siteConfig.email.replyTo,
        to: input.email,
        subject: 'Your Capucor proposal is ready',
        html: renderProposalEmail({
          firstName: input.firstName,
          businessName: input.businessName,
          tierName,
          lineItems,
          totalChargeZAR,
          proposalUrl,
        }),
      });

      if (ownerEmail) {
        await resend.emails.send({
          from: siteConfig.email.senderWebsite,
          to: ownerEmail,
          subject: `New proposal — ${input.businessName}`,
          text: [
            `A new proposal was generated from the pricing calculator.`,
            ``,
            `Name: ${fullName}`,
            `Business: ${input.businessName}`,
            `Email: ${input.email}`,
            `Package: ${tierName}`,
            ...lineItems.map((li) => `  · ${li.name}${li.label ? ` (${li.label})` : ''}: ${formatZAR(li.price)}`),
            ``,
            `Total monthly charge: ${formatZAR(totalChargeZAR)}`,
            ``,
            `Proposal link: ${proposalUrl}`,
          ].join('\n'),
        });
      }
    } catch (err) {
      console.error('[PROPOSALS] Resend send error:', err);
    }
  } else {
    console.log(`[PROPOSAL] business=${input.businessName} email=${input.email} url=${proposalUrl}`);
  }

  return NextResponse.json({ ok: true, proposalUrl });
}

interface ProposalEmailData {
  firstName: string;
  businessName: string;
  tierName: string;
  lineItems: { name: string; label: string | null; price: number }[];
  totalChargeZAR: number;
  proposalUrl: string;
}

// Hand-rolled, inline-styled HTML so it renders in any email client without a
// build step or extra dependency. Keep it simple and table-free where possible.
function renderProposalEmail(d: ProposalEmailData): string {
  const rows = d.lineItems
    .map(
      (li) => `
      <tr>
        <td style="padding:8px 0;color:#1f2937;font-size:14px;">${escapeHtml(li.name)}${
          li.label ? `<span style="color:#6b7280;"> · ${escapeHtml(li.label)}</span>` : ''
        }</td>
        <td style="padding:8px 0;text-align:right;color:#1f2937;font-size:14px;white-space:nowrap;">${formatZAR(li.price)}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;">
      <p style="margin:0 0 24px;font-weight:700;font-size:18px;letter-spacing:-0.01em;color:#0f766e;">Capucor</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">Hi ${escapeHtml(d.firstName)}, here&rsquo;s your proposal</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">
        Thanks for configuring a plan for <strong>${escapeHtml(d.businessName)}</strong>. Below is a summary
        of your ${escapeHtml(d.tierName)} subscription. Open your proposal to review the full details and
        sign electronically — there&rsquo;s no payment required to get started.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:0 0 8px;">
        ${rows}
      </table>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;margin-top:8px;padding-top:8px;">
        <tr><td style="padding:8px 0;color:#111827;font-size:16px;font-weight:700;">Total monthly charge</td><td style="padding:8px 0;text-align:right;color:#111827;font-size:16px;font-weight:700;">${formatZAR(d.totalChargeZAR)}</td></tr>
      </table>

      <a href="${d.proposalUrl}" style="display:block;margin:28px 0 8px;background:#0f766e;color:#ffffff;text-decoration:none;text-align:center;font-weight:600;font-size:15px;padding:14px 20px;border-radius:10px;">
        View &amp; sign your proposal
      </a>
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-align:center;">
        Billed monthly in arrears · cancel any time with 30 days&rsquo; notice
      </p>
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
      Capucor Business Solutions · Outsourced finance for growing SMEs
    </p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
