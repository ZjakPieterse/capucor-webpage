/**
 * POST /api/proposals/sign  —  Step A of email-bound signing
 *
 * The signer types/draws/uploads a signature at /proposal/<token>; the client
 * normalises it to a PNG data URL and posts it here. We do NOT commit the
 * signature on this request. Instead we stash it as a *pending* signature, mint
 * a one-time `sign_confirm_token`, and email a "Confirm & sign" link to the
 * proposal's own address. Only someone with access to that inbox can finalise
 * (Step B = POST /api/proposals/sign/confirm), which binds the legally-binding
 * act of signing to the real recipient — a forwarded /proposal/<token> link is
 * no longer enough to sign.
 *
 * Flow:
 *   1. Rate-limit per IP (same bucket as /api/leads).
 *   2. Honeypot → silently succeed for bots.
 *   3. Validate body with SignProposalSchema + a decoded byte-size check.
 *   4. Look up the proposal by its opaque token (service-role admin client; no
 *      anon RLS). Guard on status — only `sent`/`viewed` can be signed.
 *   5. Stash the pending signature + a fresh confirm token (30-min expiry);
 *      status stays `viewed`. Nothing is committed yet.
 *   6. Email the confirm link to the proposal address (or log it in dev).
 *
 * The actual commit (record signature → provision → archive → emails) lives in
 * /lib/portal/finalizeSign.ts, run by the confirm route.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SignProposalSchema, MAX_SIGNATURE_BYTES } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/getClientIp';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { generateOpaqueToken } from '@/lib/token';
import { renderSignConfirmEmail } from '@/lib/portal/signEmails';
import { maskEmail } from '@/lib/maskEmail';
import { siteConfig } from '@/config/site';

// Minutes a "Confirm & sign" link stays valid.
const CONFIRM_TTL_MINUTES = 30;

interface ProposalSignRow {
  id: string;
  ref_number: string | null;
  first_name: string;
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
  if (
    body &&
    typeof body === 'object' &&
    'website' in body &&
    (body as Record<string, unknown>).website
  ) {
    return NextResponse.json({ ok: true, pendingConfirmation: true });
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
      .select('id, ref_number, first_name, business_name, email, status, expires_at')
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

  // 8. Stash the pending signature + a fresh one-time confirm token. The status
  //    filter repeats the guard so we never overwrite a proposal that was signed
  //    between the read and this write. Status stays `viewed` — nothing is
  //    committed until the recipient confirms from their inbox.
  const confirmToken = generateOpaqueToken();
  const confirmExpiresAt = new Date(Date.now() + CONFIRM_TTL_MINUTES * 60 * 1000).toISOString();
  try {
    const { data: updated, error } = await admin
      .from('proposals')
      .update({
        pending_signature_name: input.signatureName,
        pending_signature_method: input.method,
        pending_signature_image: input.imageDataUrl,
        pending_signature_ip: ip === 'unknown' ? null : ip,
        sign_confirm_token: confirmToken,
        sign_confirm_expires_at: confirmExpiresAt,
      })
      .eq('id', row.id)
      .in('status', ['sent', 'viewed'])
      .select('id');

    if (error) throw error;
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: 'This proposal has already been signed.' },
        { status: 409 },
      );
    }
  } catch (err) {
    console.error('[PROPOSALS/SIGN] pending-signature write error:', err);
    return NextResponse.json(
      { error: 'Could not start the signing confirmation. Please try again.' },
      { status: 500 },
    );
  }

  // 9. Email the confirm link to the proposal's OWN address only (never anything
  //    the submitter supplies). Clicking it is what finalises the signature.
  //    Non-fatal: the pending signature is already saved; in dev we log the URL.
  const confirmUrl = `${siteConfig.marketingUrl}/proposal/confirm/${confirmToken}`;
  const resendKey = process.env.RESEND_API_KEY;

  if (resendKey) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: siteConfig.email.sender,
        replyTo: siteConfig.email.replyTo,
        to: row.email,
        subject: 'Confirm your Capucor signature',
        html: renderSignConfirmEmail({
          firstName: row.first_name,
          businessName: row.business_name,
          refNumber: row.ref_number,
          confirmUrl,
        }),
      });
    } catch (err) {
      console.error('[PROPOSALS/SIGN] confirm-email send error:', err);
    }
  } else {
    console.log(`[PROPOSAL SIGN CONFIRM] email=${row.email} confirmUrl=${confirmUrl}`);
  }

  return NextResponse.json({
    ok: true,
    pendingConfirmation: true,
    maskedEmail: maskEmail(row.email),
  });
}
