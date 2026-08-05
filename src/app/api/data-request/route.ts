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
import { getClientIp } from '@/lib/getClientIp';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { generateDataRequestToken } from '@/lib/data-request-token';
import { CONSENT_VERSION, CONSENT_LANGUAGE, DATA_REQUEST_SLA_DAYS, DATA_REQUEST_TOKEN_TTL_HOURS } from '@/lib/consent';
import { siteConfig } from '@/config/site';
import { sendEmail } from '@/lib/email/sendEmail';
import { renderDataRequestConfirmationText, renderDataRequestPendingOwnerText } from '@/lib/email/messages.mjs';

// Its own bucket, so a POPIA request cannot be starved by — or starve — the
// contact form or the signing path.
const RATE_LIMIT_KEY = 'data-request';

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

  // 2. Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  // 3. Honeypot
  if (body && typeof body === 'object' && 'website' in body && (body as Record<string, unknown>).website) {
    return NextResponse.json({ ok: true });
  }

  // 4. Zod validation
  const parsed = DataRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue.message, field: issue.path[0]?.toString() }, { status: 422 });
  }

  const { email, request_type } = parsed.data;

  // 5. Insert + generate token
  const dataRequestId = crypto.randomUUID();
  const token = generateDataRequestToken();
  const tokenExpiresAt = new Date(Date.now() + DATA_REQUEST_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();

  try {
    const supabase = await createSupabaseServerClient();
    const { error: dbError } = await supabase.from('data_requests').insert({
      id: dataRequestId,
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
    return NextResponse.json({ error: 'Could not save your request. Please try again.' }, { status: 500 });
  }

  // 6. Send confirmation email to the requester + notify the owner.
  //    Failures here are non-fatal — the row is already persisted, and the
  //    owner can manually follow up using the dashboard if mail breaks.
  const confirmUrl = `${siteConfig.marketingUrl}/api/data-request/confirm?token=${encodeURIComponent(token)}`;
  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;

  const requesterSubject =
    request_type === 'delete' ? 'Confirm your data deletion request' : 'Confirm your data access request';

  const requesterBody = renderDataRequestConfirmationText({
    requestType: request_type,
    confirmUrl,
    tokenTtlHours: DATA_REQUEST_TOKEN_TTL_HOURS,
    slaDays: DATA_REQUEST_SLA_DAYS,
  });

  const requesterDelivery = await sendEmail({
    sourceType: 'data_request',
    sourceId: dataRequestId,
    eventType: 'data_request.confirmation_client',
    idempotencyKey: `capucor_web_data_request_confirm_client_${dataRequestId}`,
    message: {
      from: siteConfig.email.senderPrivacy,
      replyTo: siteConfig.email.replyTo,
      to: email,
      subject: requesterSubject,
      text: requesterBody,
    },
  });
  const deliveryStatus = requesterDelivery.deliveryStatus;

  if (ownerEmail) {
    await sendEmail({
      sourceType: 'data_request',
      sourceId: dataRequestId,
      eventType: 'data_request.pending_owner',
      idempotencyKey: `capucor_web_data_request_pending_owner_${dataRequestId}`,
      message: {
        from: siteConfig.email.senderWebsite,
        to: ownerEmail,
        subject: `Data ${request_type} request: ${email}`,
        text: renderDataRequestPendingOwnerText({
          requestType: request_type,
          email,
          ipAddress: ip === 'unknown' ? null : ip,
          tokenTtlHours: DATA_REQUEST_TOKEN_TTL_HOURS,
          requesterDeliveryStatus: deliveryStatus,
        }),
      },
    });
  }

  if (requesterDelivery.errorCode === 'missing_api_key') {
    console.log(`[DATA_REQUEST] type=${request_type} email=${email} confirm=${confirmUrl}`);
  }

  return NextResponse.json({ ok: true, deliveryStatus });
}
