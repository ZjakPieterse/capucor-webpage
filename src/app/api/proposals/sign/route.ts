/**
 * POST /api/proposals/sign
 *
 * PR7 — electronic sign-off for a proposal at /proposal/<token>. The signer can
 * type, draw, or upload an image of their signature; the client normalises all
 * three to a single PNG data URL before posting here.
 *
 * Flow (mirrors /api/proposals):
 *   1. Rate-limit per IP (same bucket as /api/leads).
 *   2. Honeypot → silently succeed for bots.
 *   3. Validate body with SignProposalSchema + a decoded byte-size check on the
 *      signature image.
 *   4. Look up the proposal by its opaque token via the service-role admin
 *      client (no anon RLS policy). Guard on status — only `sent`/`viewed`
 *      proposals can be signed; expired/already-signed/declined are rejected.
 *   5. Flip the row to `status='signed'` and record signed_at / signature_name /
 *      signature_method / signature_image / signature_ip.
 *   6. Email a confirmation to the client + a copy (with the signature inline) to
 *      the central inbox. Non-fatal — the row is already saved.
 *
 * On-accept provisioning (PR9) and payment-for-discount (PR8) are out of scope:
 * after signing we simply confirm and tell the client we'll be in touch.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SignProposalSchema, MAX_SIGNATURE_BYTES } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { siteConfig } from '@/config/site';

interface ProposalSignRow {
  id: string;
  first_name: string;
  last_name: string;
  business_name: string;
  email: string;
  status: string;
  expires_at: string | null;
}

// Decoded byte length of a base64 data URL, computed from the string length so
// we never materialise the whole binary. (length * 3 / 4) minus padding bytes.
function decodedByteLength(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if (!base64) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
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
  const parsed = SignProposalSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue.message, field: issue.path.join('.') },
      { status: 422 },
    );
  }
  const input = parsed.data;

  // 5. Hard byte-size guard (the zod char cap is intentionally looser).
  if (decodedByteLength(input.imageDataUrl) > MAX_SIGNATURE_BYTES) {
    return NextResponse.json(
      { error: 'Your signature image is too large.', field: 'imageDataUrl' },
      { status: 422 },
    );
  }

  const admin = createSupabaseAdminClient();

  // 6. Look up the proposal by token.
  let row: ProposalSignRow;
  try {
    const { data, error } = await admin
      .from('proposals')
      .select('id, first_name, last_name, business_name, email, status, expires_at')
      .eq('token', input.token)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: 'Proposal not found.' }, { status: 404 });
    }
    row = data as unknown as ProposalSignRow;
  } catch (err) {
    console.error('[PROPOSALS/SIGN] lookup error:', err);
    return NextResponse.json(
      { error: 'Could not load this proposal. Please try again.' },
      { status: 500 },
    );
  }

  // 7. Status guards.
  const expired =
    row.status === 'expired' ||
    (!!row.expires_at && new Date(row.expires_at).getTime() < Date.now());
  if (expired) {
    return NextResponse.json(
      { error: 'This proposal has expired. Please request a fresh one.' },
      { status: 410 },
    );
  }
  if (row.status === 'signed' || row.status === 'paid' || row.status === 'active') {
    return NextResponse.json(
      { error: 'This proposal has already been signed.' },
      { status: 409 },
    );
  }
  if (row.status !== 'sent' && row.status !== 'viewed') {
    return NextResponse.json(
      { error: 'This proposal can no longer be signed.' },
      { status: 409 },
    );
  }

  // 8. Record the signature.
  const nowIso = new Date().toISOString();
  try {
    const { error } = await admin
      .from('proposals')
      .update({
        status: 'signed',
        signed_at: nowIso,
        signature_name: input.signatureName,
        signature_method: input.method,
        signature_image: input.imageDataUrl,
        signature_ip: ip === 'unknown' ? null : ip,
      })
      .eq('id', row.id);

    if (error) throw error;
  } catch (err) {
    console.error('[PROPOSALS/SIGN] update error:', err);
    return NextResponse.json(
      { error: 'Could not record your signature. Please try again.' },
      { status: 500 },
    );
  }

  // 9. Confirmation emails — non-fatal. The signature is already saved.
  const fullName = `${row.first_name} ${row.last_name}`.trim();
  const proposalUrl = `${siteConfig.url}/proposal/${input.token}`;
  const resendKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;

  if (resendKey) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);

      await resend.emails.send({
        from: siteConfig.email.sender,
        replyTo: siteConfig.email.replyTo,
        to: row.email,
        subject: 'We’ve received your signed proposal',
        html: renderSignedClientEmail({
          firstName: row.first_name,
          businessName: row.business_name,
        }),
      });

      if (ownerEmail) {
        await resend.emails.send({
          from: siteConfig.email.senderWebsite,
          to: ownerEmail,
          subject: `Proposal signed — ${row.business_name}`,
          html: renderSignedOwnerEmail({
            fullName,
            businessName: row.business_name,
            email: row.email,
            method: input.method,
            signedAt: nowIso,
            signatureImage: input.imageDataUrl,
            proposalUrl,
          }),
        });
      }

      await admin
        .from('proposals')
        .update({ signed_email_sent_at: new Date().toISOString() })
        .eq('id', row.id);
    } catch (err) {
      console.error('[PROPOSALS/SIGN] Resend send error:', err);
    }
  } else {
    console.log(`[PROPOSAL SIGNED] business=${row.business_name} email=${row.email} method=${input.method}`);
  }

  return NextResponse.json({ ok: true });
}

function renderSignedClientEmail(d: { firstName: string; businessName: string }): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;">
      <p style="margin:0 0 24px;font-weight:700;font-size:18px;letter-spacing:-0.01em;color:#0f766e;">Capucor</p>
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#111827;">Thanks, ${escapeHtml(d.firstName)} — that&rsquo;s signed</h1>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">
        We&rsquo;ve recorded your acceptance of the Capucor proposal for
        <strong>${escapeHtml(d.businessName)}</strong>. There&rsquo;s nothing more you need to do right now.
      </p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#4b5563;">
        Someone from our team will be in touch shortly to set up your onboarding and get your first month underway.
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
        Questions in the meantime? Just reply to this email.
      </p>
    </div>
    <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
      Capucor Business Solutions · Outsourced finance for growing SMEs
    </p>
  </div>
</body>
</html>`;
}

function renderSignedOwnerEmail(d: {
  fullName: string;
  businessName: string;
  email: string;
  method: string;
  signedAt: string;
  signatureImage: string;
  proposalUrl: string;
}): string {
  const when = new Date(d.signedAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /></head>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 16px;font-size:18px;color:#111827;">Proposal signed</h1>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1f2937;">
        <tr><td style="padding:4px 0;color:#6b7280;">Business</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.businessName)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Signed by</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.fullName)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Email</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.email)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">Method</td><td style="padding:4px 0;text-align:right;">${escapeHtml(d.method)}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280;">When</td><td style="padding:4px 0;text-align:right;">${escapeHtml(when)}</td></tr>
      </table>
      <p style="margin:20px 0 8px;font-size:12px;color:#6b7280;">Signature</p>
      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px;text-align:center;background:#fafafa;">
        <img src="${d.signatureImage}" alt="Signature" style="max-width:100%;max-height:160px;" />
      </div>
      <a href="${d.proposalUrl}" style="display:inline-block;margin-top:20px;font-size:13px;color:#0f766e;">Open the proposal &rarr;</a>
    </div>
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
