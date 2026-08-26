/**
 * GET /api/data-request/confirm?token=...
 *
 * POPIA P1 — magic-link confirmation step. Verifies the data-subject controls
 * the email they submitted, transitions the row from 'pending_confirmation'
 * to 'confirmed', and notifies the owner that the request is now actionable.
 *
 * Token lookup goes through the service-role admin client because the row
 * needs to be updated (no anon UPDATE policy on data_requests).
 */

import { NextRequest } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { DATA_REQUEST_SLA_DAYS } from '@/lib/consent';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp } from '@/lib/getClientIp';
import { siteConfig } from '@/config/site';
import { RENDER_COLORS } from '@/config/renderColors';
import { sendEmail } from '@/lib/email/sendEmail';
import { renderDataRequestConfirmedOwnerText } from '@/lib/email/messages.mjs';

type Outcome = 'confirmed' | 'expired' | 'invalid' | 'already' | 'error' | 'rate_limited';

// Its own bucket. This is a GET reached by clicking a link in an email, so
// mail-client prefetchers and a user clicking twice both land here; sharing the
// submit endpoint's counter let that traffic exhaust unrelated flows. Roomier
// than a form POST for the same reason — the token itself is the real gate.
const RATE_LIMIT_KEY = 'data-request-confirm';
const CONFIRM_LIMIT = 20;

export async function GET(req: NextRequest) {
  // Per-IP rate limit, so the token lookup can't be hammered.
  const ip = getClientIp(req.headers);
  const { allowed } = await checkRateLimit(ip, {
    key: RATE_LIMIT_KEY,
    limit: CONFIRM_LIMIT,
  });
  if (!allowed) {
    return htmlResponse('rate_limited');
  }

  const token = req.nextUrl.searchParams.get('token');

  if (!token || token.length < 16) {
    return htmlResponse('invalid');
  }

  let outcome: Outcome = 'error';
  let email: string | null = null;
  let requestType: string | null = null;

  try {
    const supabase = createSupabaseAdminClient();
    const { data: row, error } = await supabase
      .from('data_requests')
      .select('id, email, request_type, status, token_expires_at')
      .eq('token', token)
      .maybeSingle();

    if (error) throw error;

    if (!row) {
      return htmlResponse('invalid');
    }

    email = row.email as string;
    requestType = row.request_type as string;

    if (row.status === 'confirmed' || row.status === 'processed') {
      outcome = 'already';
    } else if (new Date(row.token_expires_at as string).getTime() < Date.now()) {
      await supabase
        .from('data_requests')
        .update({ status: 'expired' })
        .eq('id', row.id as string);
      outcome = 'expired';
    } else {
      // Guard on the status we read so a concurrent confirm (or expiry
      // sweep) between the check and this update can't double-transition.
      const confirmedAt = new Date().toISOString();
      const { data: updated, error: updErr } = await supabase
        .from('data_requests')
        .update({ status: 'confirmed', confirmed_at: confirmedAt })
        .eq('id', row.id as string)
        .eq('status', row.status as string)
        .select('id');
      if (updErr) throw updErr;
      if (!updated || updated.length === 0) {
        // Someone else won the race — the row is already confirmed/expired.
        return htmlResponse('already');
      }
      outcome = 'confirmed';

      // Owner notification — non-fatal.
      const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;
      if (ownerEmail) {
        await sendEmail({
          sourceType: 'data_request',
          sourceId: String(row.id),
          eventType: 'data_request.confirmed_owner',
          idempotencyKey: `capucor_web_data_request_confirmed_owner_${String(row.id)}`,
          adminClient: supabase,
          message: {
            from: siteConfig.email.senderWebsite,
            to: ownerEmail,
            subject: `Data ${requestType} request CONFIRMED: ${email}`,
            text: renderDataRequestConfirmedOwnerText({
              requestType,
              email,
              confirmedAt,
              slaDays: DATA_REQUEST_SLA_DAYS,
            }),
          },
        });
      }
    }
  } catch (err) {
    console.error('[DATA_REQUEST] confirm route error:', err);
    return htmlResponse('error');
  }

  return htmlResponse(outcome);
}

function htmlResponse(outcome: Outcome): Response {
  const copy: Record<Outcome, { title: string; body: string }> = {
    confirmed: {
      title: 'Request confirmed',
      body: `Thanks. Your request has been verified and forwarded to our team. We will respond within ${DATA_REQUEST_SLA_DAYS} days.`,
    },
    already: {
      title: 'Already confirmed',
      body: 'This request was already confirmed. No further action is needed on your part.',
    },
    expired: {
      title: 'Link expired',
      body: 'This confirmation link is no longer valid. Please submit a new request from the privacy page.',
    },
    invalid: {
      title: 'Invalid link',
      body: 'This confirmation link is not recognised. Please submit a new request from the privacy page.',
    },
    error: {
      title: 'Something went wrong',
      body: `We could not process this confirmation. Please try again later or email ${siteConfig.email.contact}.`,
    },
    rate_limited: {
      title: 'Too many attempts',
      body: 'Please wait a few minutes and open the confirmation link again.',
    },
  };

  const { title, body } = copy[outcome];
  const status = outcome === 'confirmed' || outcome === 'already' ? 200 : outcome === 'rate_limited' ? 429 : 400;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>${title} | Capucor</title>
  <style>
    body { font-family: Geist, system-ui, -apple-system, Segoe UI, sans-serif; background: ${RENDER_COLORS.dark.background}; color: ${RENDER_COLORS.dark.foreground}; margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 2rem; }
    main { max-width: 32rem; text-align: center; }
    h1 { font-size: 1.5rem; margin: 0 0 1rem; letter-spacing: -0.01em; }
    p { color: ${RENDER_COLORS.dark.mutedForeground}; line-height: 1.6; margin: 0 0 1.5rem; }
    a { color: ${RENDER_COLORS.dark.foreground}; text-decoration: underline; text-underline-offset: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${body}</p>
    <p><a href="/privacy">Back to privacy policy</a></p>
  </main>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
