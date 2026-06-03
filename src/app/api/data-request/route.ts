/**
 * POST /api/data-request
 *
 * POPIA P1 — submit a data-subject access or deletion request.
 *
 * Flow:
 *   1. Rate-limit per IP (same bucket as /api/leads).
 *   2. Validate body with DataRequestSchema.
 *   3. Generate a random magic-link token + 24h expiry.
 *   4. Insert into public.data_requests with status='pending_confirmation'.
 *   5. Email the requester a confirmation link (proves email control).
 *   6. Notify the owner that a request is pending verification.
 *
 * The actual access/delete action only happens after the user clicks the
 * magic link and we set status='confirmed' (see ./confirm/route.ts).
 */

import { NextRequest, NextResponse } from 'next/server';
import { DataRequestSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateDataRequestToken } from '@/lib/data-request-token';
import {
  CONSENT_VERSION,
  CONSENT_LANGUAGE,
  DATA_REQUEST_SLA_DAYS,
  DATA_REQUEST_TOKEN_TTL_HOURS,
} from '@/lib/consent';
import { siteConfig } from '@/config/site';

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

  // 3. Honeypot
  if (
    body &&
    typeof body === 'object' &&
    'website' in body &&
    (body as Record<string, unknown>).website
  ) {
    return NextResponse.json({ ok: true });
  }

  // 4. Zod validation
  const parsed = DataRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue.message, field: issue.path[0]?.toString() },
      { status: 422 },
    );
  }

  const { email, request_type } = parsed.data;

  // 5. Insert + generate token
  const token = generateDataRequestToken();
  const tokenExpiresAt = new Date(
    Date.now() + DATA_REQUEST_TOKEN_TTL_HOURS * 60 * 60 * 1000,
  ).toISOString();

  try {
    const supabase = await createSupabaseServerClient();
    const { error: dbError } = await supabase.from('data_requests').insert({
      email,
      request_type,
      status: 'pending_confirmation',
      token,
      token_expires_at: tokenExpiresAt,
      consent_version: CONSENT_VERSION,
      consent_language: CONSENT_LANGUAGE,
      ip_address: ip === 'unknown' ? null : ip,
      user_agent: req.headers.get('user-agent') ?? null,
    });

    if (dbError) throw dbError;
  } catch (err) {
    console.error('[DATA_REQUEST] Supabase insert error:', err);
    return NextResponse.json(
      { error: 'Could not save your request. Please try again.' },
      { status: 500 },
    );
  }

  // 6. Send confirmation email to the requester + notify the owner.
  //    Failures here are non-fatal — the row is already persisted, and the
  //    owner can manually follow up using the dashboard if mail breaks.
  const confirmUrl = `${siteConfig.url}/api/data-request/confirm?token=${encodeURIComponent(token)}`;
  const resendKey = process.env.RESEND_API_KEY;
  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;

  if (resendKey) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendKey);

      const requesterSubject =
        request_type === 'delete'
          ? 'Confirm your data deletion request'
          : 'Confirm your data access request';

      const requesterBody = [
        `Hi,`,
        ``,
        `We received a POPIA ${request_type === 'delete' ? 'deletion' : 'access'} request for this email address from the Capucor website.`,
        ``,
        `To confirm it was you, please click the link below within ${DATA_REQUEST_TOKEN_TTL_HOURS} hours:`,
        ``,
        confirmUrl,
        ``,
        `Once confirmed, we will respond within ${DATA_REQUEST_SLA_DAYS} days.`,
        ``,
        `If you did not make this request, you can safely ignore this email — no action will be taken without confirmation.`,
        ``,
        `— Capucor Business Solutions`,
      ].join('\n');

      await resend.emails.send({
        from: siteConfig.email.senderPrivacy,
        replyTo: siteConfig.email.replyTo,
        to: email,
        subject: requesterSubject,
        text: requesterBody,
      });

      if (ownerEmail) {
        await resend.emails.send({
          from: siteConfig.email.senderWebsite,
          to: ownerEmail,
          subject: `Data ${request_type} request: ${email}`,
          text: [
            `A new POPIA ${request_type} request was submitted.`,
            ``,
            `Email: ${email}`,
            `Type: ${request_type}`,
            `IP: ${ip}`,
            `Status: pending_confirmation (24h)`,
            ``,
            `The requester has been sent a confirmation link. You will be notified again once they confirm.`,
          ].join('\n'),
        });
      }
    } catch (err) {
      console.error('[DATA_REQUEST] Resend send error:', err);
    }
  } else {
    console.log(
      `[DATA_REQUEST] type=${request_type} email=${email} confirm=${confirmUrl}`,
    );
  }

  return NextResponse.json({ ok: true });
}
