/**
 * POST /api/proposals/resend?secret=REVALIDATE_SECRET
 *
 * Staff-side "send it again" for a proposal that's still open (sent / viewed)
 * or has expired. Issues a fresh token + 30-day expiry, resets the status to
 * `sent`, and emails the client the link again. The reference number stays the
 * same — it's the same proposal, just re-sent.
 *
 * Secret-guarded (same REVALIDATE_SECRET as the cron routes) until a proper
 * staff-auth surface exists. Not a public endpoint, so no honeypot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ResendProposalSchema } from '@/lib/validations';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { generateOpaqueToken } from '@/lib/token';
import { timingSafeEqual } from '@/lib/security';
import { siteConfig } from '@/config/site';
import { formatZAR } from '@/lib/utils';

const PROPOSAL_TTL_DAYS = 30;
const RESENDABLE = new Set(['sent', 'viewed', 'expired']);

interface Row {
  id: string;
  ref_number: string | null;
  first_name: string;
  business_name: string;
  email: string;
  status: string;
  monthly_total_zar: number;
}

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (
    !process.env.REVALIDATE_SECRET ||
    !secret ||
    !timingSafeEqual(secret, process.env.REVALIDATE_SECRET)
  ) {
    return NextResponse.json({ error: 'Invalid secret.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = ResendProposalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  }

  const admin = createSupabaseAdminClient();

  let row: Row;
  try {
    const { data, error } = await admin
      .from('proposals')
      .select('id, ref_number, first_name, business_name, email, status, monthly_total_zar')
      .eq('id', parsed.data.proposalId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Proposal not found.' }, { status: 404 });
    row = data as unknown as Row;
  } catch (err) {
    console.error('[PROPOSALS/RESEND] lookup error:', err);
    return NextResponse.json({ error: 'Could not load the proposal.' }, { status: 500 });
  }

  if (!RESENDABLE.has(row.status)) {
    return NextResponse.json(
      { error: `A ${row.status} proposal can't be re-sent. Amend it instead.` },
      { status: 409 },
    );
  }

  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + PROPOSAL_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  try {
    const { error } = await admin
      .from('proposals')
      .update({ token, status: 'sent', sent_at: nowIso, viewed_at: null, expires_at: expiresAt })
      .eq('id', row.id);
    if (error) throw error;
  } catch (err) {
    console.error('[PROPOSALS/RESEND] update error:', err);
    return NextResponse.json({ error: 'Could not re-send the proposal.' }, { status: 500 });
  }

  const proposalUrl = `${siteConfig.url}/proposal/${token}`;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: siteConfig.email.sender,
        replyTo: siteConfig.email.replyTo,
        to: row.email,
        subject: row.ref_number
          ? `Your Capucor proposal (${row.ref_number})`
          : 'Your Capucor proposal',
        html: renderResendEmail({
          firstName: row.first_name,
          businessName: row.business_name,
          refNumber: row.ref_number,
          monthlyZAR: Number(row.monthly_total_zar),
          proposalUrl,
        }),
      });
    } catch (err) {
      console.error('[PROPOSALS/RESEND] Resend send error:', err);
    }
  } else {
    console.log(`[PROPOSAL RESENT] business=${row.business_name} url=${proposalUrl}`);
  }

  return NextResponse.json({ ok: true, proposalUrl, ref_number: row.ref_number });
}

function renderResendEmail(d: {
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
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">Hi ${escapeHtml(d.firstName)}, here&rsquo;s your proposal again</h1>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">
        Here&rsquo;s a fresh link to the Capucor proposal for <strong>${escapeHtml(d.businessName)}</strong>
        at <strong>${formatZAR(d.monthlyZAR)}</strong> per month. Open it to review the full details and sign.
      </p>
      <a href="${d.proposalUrl}" style="display:block;margin:28px 0 8px;background:#0f766e;color:#ffffff;text-decoration:none;text-align:center;font-weight:600;font-size:15px;padding:14px 20px;border-radius:10px;">
        View &amp; sign your proposal
      </a>
      <p style="margin:0;font-size:12px;color:#6b7280;text-align:center;">
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
