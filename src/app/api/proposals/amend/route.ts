/**
 * POST /api/proposals/amend?secret=REVALIDATE_SECRET
 *
 * Staff-side "change of service". Recomputes pricing server-side for a new
 * selection, then issues a NEW revision of an existing proposal: a fresh row
 * with its own token + reference and `version` bumped, linked back to the
 * original via `supersedes_id`. The original is marked `superseded`. The client
 * is emailed the new link to re-sign.
 *
 * Keeping each revision as its own row preserves the audit trail (every version
 * and its signature stays intact). Reference numbers are unique per row, so a
 * revision gets a new FT number; the lineage is the supersedes/superseded link.
 *
 * Internal-admin-gated (requireInternalApi({ admin: true }) → the
 * public.internal_users allowlist). The hub hides this action for basic staff;
 * the gate enforces it server-side too.
 */

import { NextRequest, NextResponse } from 'next/server';
import { AmendProposalSchema } from '@/lib/validations';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { priceProposalSelection } from '@/lib/proposalPricing';
import { generateOpaqueToken } from '@/lib/token';
import { requireInternalApi } from '@/lib/auth/requireInternalApi';
import { siteConfig } from '@/config/site';
import { formatZAR } from '@/lib/utils';

const PROPOSAL_TTL_DAYS = 30;

interface OriginalRow {
  id: string;
  lead_id: string | null;
  first_name: string;
  last_name: string;
  business_name: string;
  email: string;
  version: number;
  status: string;
  consent_version: string;
  consent_language: string;
}

export async function POST(req: NextRequest) {
  const auth = await requireInternalApi({ admin: true });
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = AmendProposalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }
  const input = parsed.data;
  const admin = createSupabaseAdminClient();

  // 1. Load the original.
  let original: OriginalRow;
  try {
    const { data, error } = await admin
      .from('proposals')
      .select(
        'id, lead_id, first_name, last_name, business_name, email, version, status, consent_version, consent_language',
      )
      .eq('id', input.proposalId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Proposal not found.' }, { status: 404 });
    original = data as unknown as OriginalRow;
  } catch (err) {
    console.error('[PROPOSALS/AMEND] lookup error:', err);
    return NextResponse.json({ error: 'Could not load the proposal.' }, { status: 500 });
  }

  if (original.status === 'superseded') {
    return NextResponse.json(
      { error: 'This proposal has already been replaced by a newer revision.' },
      { status: 409 },
    );
  }

  // 2. Recompute pricing for the new selection (anti-tamper, shared helper).
  const priced = await priceProposalSelection(admin, {
    services: input.services,
    brackets: input.brackets,
    tierSlug: input.tierSlug,
    addons: input.addons,
  });
  if (!priced.ok) {
    return NextResponse.json({ error: priced.error }, { status: priced.status });
  }
  const { addonSlugs, monthlyTotalZAR, vatZAR, totalChargeZAR } = priced.data;

  // 3. Insert the new revision.
  const contact = {
    first_name: input.firstName ?? original.first_name,
    last_name: input.lastName ?? original.last_name,
    business_name: input.businessName ?? original.business_name,
    email: input.email ?? original.email,
  };
  const token = generateOpaqueToken();
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + PROPOSAL_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let newId: string;
  let refNumber: string | null = null;
  try {
    const { data, error } = await admin
      .from('proposals')
      .insert({
        token,
        lead_id: original.lead_id,
        ...contact,
        services: input.services,
        brackets: input.brackets,
        tier_slug: input.tierSlug,
        addons: addonSlugs,
        monthly_total_zar: monthlyTotalZAR,
        vat_zar: vatZAR,
        total_charge_zar: totalChargeZAR,
        status: 'sent',
        version: (original.version ?? 1) + 1,
        supersedes_id: original.id,
        consent_version: original.consent_version,
        consent_language: original.consent_language,
        sent_at: nowIso,
        expires_at: expiresAt,
      })
      .select('id, ref_number')
      .single();
    if (error) throw error;
    newId = data!.id as string;
    refNumber = (data!.ref_number as string) ?? null;
  } catch (err) {
    console.error('[PROPOSALS/AMEND] insert error:', err);
    return NextResponse.json({ error: 'Could not create the revised proposal.' }, { status: 500 });
  }

  // 4. Mark the original superseded + link forward. Non-fatal: the new revision
  //    is already live, so a failure here just leaves a stale old row.
  const { error: supErr } = await admin
    .from('proposals')
    .update({ status: 'superseded', superseded_by_id: newId })
    .eq('id', original.id);
  if (supErr) console.error('[PROPOSALS/AMEND] supersede update error:', supErr);

  // 5. Email the client the new link.
  const proposalUrl = `${siteConfig.url}/proposal/${token}`;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: siteConfig.email.sender,
        replyTo: siteConfig.email.replyTo,
        to: contact.email,
        subject: refNumber
          ? `Your updated Capucor proposal (${refNumber})`
          : 'Your updated Capucor proposal',
        html: renderAmendEmail({
          firstName: contact.first_name,
          businessName: contact.business_name,
          refNumber,
          monthlyZAR: monthlyTotalZAR,
          proposalUrl,
        }),
      });
    } catch (err) {
      console.error('[PROPOSALS/AMEND] Resend send error:', err);
    }
  } else {
    console.log(`[PROPOSAL AMENDED] business=${contact.business_name} url=${proposalUrl}`);
  }

  return NextResponse.json({
    ok: true,
    proposalUrl,
    ref_number: refNumber,
    version: (original.version ?? 1) + 1,
  });
}

function renderAmendEmail(d: {
  firstName: string;
  businessName: string;
  refNumber: string | null;
  monthlyZAR: number;
  proposalUrl: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;">
      <p style="margin:0 0 24px;font-weight:700;font-size:18px;letter-spacing:-0.01em;color:#0f766e;">Capucor</p>
      ${
        d.refNumber
          ? `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Reference ${escapeHtml(d.refNumber)}</p>`
          : ''
      }
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">Hi ${escapeHtml(d.firstName)}, we&rsquo;ve updated your proposal</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">
        We&rsquo;ve revised the Capucor proposal for <strong>${escapeHtml(d.businessName)}</strong>. The
        updated plan comes to <strong>${formatZAR(d.monthlyZAR)}</strong> per month. Open it to review the
        changes and sign. This replaces any earlier version.
      </p>
      <a href="${d.proposalUrl}" style="display:block;margin:28px 0 8px;background:#0f766e;color:#ffffff;text-decoration:none;text-align:center;font-weight:600;font-size:15px;padding:14px 20px;border-radius:10px;">
        View &amp; sign the updated proposal
      </a>
      <p style="margin:0;font-size:12px;color:#6b7280;text-align:center;">
        Billed monthly in advance · cancel any time with 30 days&rsquo; notice
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
