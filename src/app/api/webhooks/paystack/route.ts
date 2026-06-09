/**
 * POST /api/webhooks/paystack
 *
 * Paystack webhook receiver — FRAMEWORK STUB.
 *
 * Paystack posts events as JSON with envelope { event: string, data: {...} }
 * and signs the raw body with HMAC-SHA512 in the `x-paystack-signature`
 * header (key = your PAYSTACK_SECRET_KEY).
 *
 * Events we will care about:
 *   - charge.success                       → activate subscription
 *   - subscription.create                  → store paystack_subscription_code
 *   - subscription.disable / .not_renew    → mark as cancelling/cancelled
 *   - invoice.payment_failed               → mark as past_due
 *
 * Reference: https://paystack.com/docs/payments/webhooks
 *
 * IMPORTANT: when Paystack is wired, the body MUST be read as raw text
 * BEFORE JSON.parse, because signature verification is done over the raw
 * bytes Paystack sent (any reformatting will break the HMAC). Express-style
 * verifyRawBody.
 */

import { NextRequest, NextResponse } from 'next/server';
import { PaystackWebhookSchema } from '@/lib/validations';
import { verifyWebhookSignature } from '@/lib/paystack';

export async function POST(req: NextRequest) {
  // 1. Read raw body (required for HMAC signature verification)
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  // 2. Signature check — HMAC-SHA512 over the raw body; fails closed when
  // PAYSTACK_SECRET_KEY is unset (no live webhooks exist until Paystack is wired).
  if (!(await verifyWebhookSignature(rawBody, signature))) {
    console.warn('[WEBHOOK:PAYSTACK] signature mismatch');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 3. Parse + validate envelope
  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PaystackWebhookSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Malformed event' }, { status: 422 });
  }

  const { event } = parsed.data;

  // 4. Dispatch — STUB. Each case is a no-op for now and will be wired up
  // when Paystack goes live. We accept the event and respond 200 so
  // Paystack does not retry indefinitely while the integration is being built.
  switch (event) {
    case 'charge.success':
      // TODO: mark subscription active, send welcome email
      break;
    case 'subscription.create':
      // TODO: store paystack subscription code on our row
      break;
    case 'subscription.disable':
    case 'subscription.not_renew':
      // TODO: transition subscription to cancelling/cancelled
      break;
    case 'invoice.payment_failed':
      // TODO: mark past_due, notify owner + customer
      break;
    default:
      // Silently accept unknown events
      break;
  }

  return NextResponse.json({ ok: true });
}
