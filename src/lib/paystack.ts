/**
 * Paystack SDK wrapper — STUB.
 *
 * No real Paystack calls happen here yet. The signatures below describe the
 * surface area we will wire up when the integration goes live. Every
 * function currently returns a deterministic stub so the rest of the
 * activation flow can be built, demoed and tested end-to-end without
 * touching live keys.
 *
 * When Paystack is wired:
 *   - Replace the stub bodies with calls to https://api.paystack.co/...
 *   - Inject PAYSTACK_SECRET_KEY via process.env at the route layer
 *   - Use the HMAC-SHA512 signature on incoming webhooks
 *     (see /api/webhooks/paystack)
 *
 * Why Paystack: ZAR-native, supports debit-order recurring, dominant SA
 * processor. See: https://paystack.com/docs/payments/subscriptions
 *
 * Exception: verifyWebhookSignature below is REAL (not a stub) — it
 * authenticates incoming webhooks with HMAC-SHA512 and fails closed when
 * PAYSTACK_SECRET_KEY is not configured.
 */

import { timingSafeEqual } from '@/lib/security';

export interface PaystackCustomer {
  id: string;
  email: string;
  fullName: string;
}

export interface PaystackPlan {
  /** Paystack plan code, e.g. "PLN_xxxxxxxx" */
  code: string;
  /** Capucor tier slug this plan represents */
  tierSlug: string;
  /** Monthly amount in cents (Paystack expects kobo/cents, never decimals) */
  amountCents: number;
  /** ZAR */
  currency: 'ZAR';
  interval: 'monthly';
}

export interface PaystackInitTransactionResult {
  /** Hosted checkout URL — the customer is redirected here to pay */
  authorizationUrl: string;
  /** Paystack reference (also returned in the webhook) */
  reference: string;
  /** Access code, useful for inline checkout */
  accessCode: string;
}

export interface InitSubscriptionParams {
  email: string;
  fullName: string;
  /** Total charge including VAT, in cents */
  amountCents: number;
  /** Capucor subscription id (so we can correlate webhooks back to our DB) */
  subscriptionId: string;
  /** Optional metadata forwarded back in the webhook */
  metadata?: Record<string, unknown>;
}

/**
 * Create or fetch a customer record in Paystack.
 */
export async function getOrCreateCustomer(input: {
  email: string;
  fullName: string;
}): Promise<PaystackCustomer> {
  // STUB
  return {
    id: `cus_stub_${cryptoRandom()}`,
    email: input.email,
    fullName: input.fullName,
  };
}

/**
 * Initialise a subscription transaction. Returns a hosted checkout URL the
 * customer is redirected to. The actual subscription becomes active once
 * the charge.success webhook fires.
 */
export async function initSubscriptionTransaction(
  params: InitSubscriptionParams,
): Promise<PaystackInitTransactionResult> {
  // STUB
  const ref = `ref_stub_${cryptoRandom()}`;
  return {
    authorizationUrl: `/onboarding?ref=${ref}&subscription=${encodeURIComponent(params.subscriptionId)}`,
    reference: ref,
    accessCode: `acc_stub_${cryptoRandom()}`,
  };
}

/**
 * Verify a webhook signature using HMAC-SHA512 with PAYSTACK_SECRET_KEY.
 *
 * Paystack signs the raw request body and sends the hex digest in the
 * `x-paystack-signature` header. Fails closed: without a configured secret
 * or a signature header the event cannot be authenticated, so it is
 * rejected. Uses Web Crypto (Cloudflare Workers-safe — no Node `crypto`).
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const expectedHex = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(expectedHex, signature.toLowerCase());
}

/**
 * Cancel a subscription with notice. Paystack supports immediate or
 * end-of-period cancellation; we use end-of-period to honour our
 * 30-day-notice promise.
 */
export async function cancelSubscriptionAtPeriodEnd(_paystackSubscriptionCode: string): Promise<{ ok: true }> {
  // STUB
  return { ok: true };
}

// ── internals ──────────────────────────────────────────────────────────
function cryptoRandom() {
  // Edge-runtime-safe random id
  return Math.random().toString(36).slice(2, 10);
}
