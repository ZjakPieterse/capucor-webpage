/**
 * POST /api/subscriptions
 *
 * Endpoint for Step 4 (Activate) of the pricing calculator.
 *
 * FRAMEWORK STUB — Paystack is not wired yet. This route currently:
 *   1. Rate-limits per IP
 *   2. Validates the request with SubscriptionRequestSchema
 *   3. Returns a deterministic stub response so Step4Activate can render
 *      the success state end-to-end
 *
 * When Paystack goes live, the body of this route will:
 *   - Persist a subscription row to Supabase with status='pending_payment'
 *   - Call paystack.getOrCreateCustomer(...)
 *   - Call paystack.initSubscriptionTransaction(...)
 *   - Return { authorizationUrl } so the client can redirect to checkout
 *
 * Pricing math is performed server-side from the calculator config so the
 * client cannot tamper with prices in the request body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { SubscriptionRequestSchema } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limit';
import { initSubscriptionTransaction, getOrCreateCustomer } from '@/lib/paystack';
import { createSupabaseAnonClient } from '@/lib/supabase/anon';
import { monthlyTotal } from '@/lib/pricing';
import type { Bracket } from '@/types';

const VAT_RATE = 0.15;

export async function POST(req: NextRequest) {
  // 1. Rate limit
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  const rl = await checkRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again in a few minutes.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  // 2. Parse + honeypot
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (
    body &&
    typeof body === 'object' &&
    'website' in body &&
    (body as Record<string, unknown>).website
  ) {
    // Silently succeed for bots
    return NextResponse.json({ ok: true, authorizationUrl: '/onboarding?ref=bot' });
  }

  // 3. Zod validation
  const parsed = SubscriptionRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue.message, field: issue.path.join('.') },
      { status: 422 },
    );
  }

  const input = parsed.data;

  // 4. Pricing math — recompute server-side. The client payload is treated
  //    as configuration only (services, brackets, tier). Prices come from
  //    the live Supabase `brackets` table so the client cannot tamper.
  let monthlyTotalZAR = 0;
  try {
    // Public pricing data — read as `anon` (brackets only grant select to anon).
    const supabase = createSupabaseAnonClient();
    const { data: bracketRows, error } = await supabase
      .from('brackets')
      .select('service_slug, ordinal, basic_price, pro_price, premium_price')
      .in('service_slug', input.services)
      .returns<Pick<Bracket, 'service_slug' | 'ordinal' | 'basic_price' | 'pro_price' | 'premium_price'>[]>();

    if (error || !bracketRows) {
      throw error ?? new Error('Brackets fetch returned no rows');
    }

    monthlyTotalZAR = monthlyTotal(
      input.services,
      input.brackets,
      input.tierSlug,
      bracketRows
    );
  } catch (err) {
    console.error('[SUBSCRIPTIONS] price recomputation failed:', err);
    return NextResponse.json(
      { error: 'Could not price your subscription. Please try again.' },
      { status: 500 },
    );
  }

  if (monthlyTotalZAR <= 0) {
    return NextResponse.json(
      { error: 'No priced services in your selection. Please pick at least one regular bracket.' },
      { status: 422 },
    );
  }

  const vatZAR = Math.round(monthlyTotalZAR * VAT_RATE);
  const totalChargeZAR = monthlyTotalZAR + vatZAR;

  // 5. Persist subscription — STUB
  const subscriptionId = `sub_stub_${Math.random().toString(36).slice(2, 10)}`;
  // TODO: insert into Supabase `subscriptions` table:
  //   { id, email, full_name, business, services, brackets, tier_slug,
  //     monthly_total_zar, vat_zar, total_charge_zar, status: 'pending_payment',
  //     created_at }

  // 6. Initialise Paystack transaction — STUB
  let authorizationUrl: string;
  try {
    await getOrCreateCustomer({ email: input.email, fullName: input.fullName });
    const tx = await initSubscriptionTransaction({
      email: input.email,
      fullName: input.fullName,
      amountCents: totalChargeZAR * 100,
      subscriptionId,
      metadata: {
        capucorSubscriptionId: subscriptionId,
        services: input.services,
        tierSlug: input.tierSlug,
      },
    });
    authorizationUrl = tx.authorizationUrl;
  } catch (err) {
    console.error('[SUBSCRIPTIONS] Paystack init error:', err);
    return NextResponse.json(
      { error: 'Could not start checkout. Please try again.' },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    subscriptionId,
    authorizationUrl,
    monthlyTotalZAR,
    vatZAR,
    totalChargeZAR,
  });
}
