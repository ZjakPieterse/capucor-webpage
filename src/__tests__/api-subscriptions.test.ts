import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeJsonRequest } from './helpers/request';

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock('@/lib/paystack', () => ({
  getOrCreateCustomer: vi.fn(async () => ({
    id: 'cus_test',
    email: 'a@b.co',
    fullName: 'A B',
  })),
  initSubscriptionTransaction: vi.fn(async () => ({
    authorizationUrl: 'https://paystack.test/checkout/xyz',
    reference: 'ref_test',
    accessCode: 'acc_test',
  })),
}));

import { checkRateLimit } from '@/lib/rate-limit';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrCreateCustomer, initSubscriptionTransaction } from '@/lib/paystack';
import { POST } from '@/app/api/subscriptions/route';

type SupabaseStub = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Pro prices: accounting 0-1Mil = 950, payroll 1emp = 600 → 1550 monthly
const PRO_BRACKETS = [
  { service_slug: 'accounting', ordinal: 1, basic_price: 725, pro_price: 950, premium_price: 1525 },
  { service_slug: 'payroll',    ordinal: 1, basic_price: 450, pro_price: 600, premium_price: 950  },
];
const DORMANT_BRACKETS = [
  { service_slug: 'bookkeeping', ordinal: 0, basic_price: 0, pro_price: 0, premium_price: 0 },
];

function mountBrackets(rows: unknown, error: unknown = null) {
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    from: () => ({
      select: () => ({
        in: () => ({
          returns: async () => ({ data: rows, error }),
        }),
      }),
    }),
  } as unknown as SupabaseStub);
}

const validBody = {
  services: ['accounting', 'payroll'],
  brackets: { accounting: 1, payroll: 1 },
  tierSlug: 'pro',
  email: 'pat@example.com',
  fullName: 'Pat Patterson',
  business: {
    legalName: 'Pat Trading Co',
    cipcNumber: '',
    vatNumber: '',
    sector: 'Tech / SaaS',
  },
  consentGiven: true as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfter: 0 });
  mountBrackets(PRO_BRACKETS);
});

describe('POST /api/subscriptions', () => {
  it('1. happy path — returns 200 with computed totals and paystack url', async () => {
    const res = await POST(makeJsonRequest('http://test/api/subscriptions', validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      authorizationUrl: 'https://paystack.test/checkout/xyz',
      monthlyTotalZAR: 1550,           // 950 + 600
      vatZAR: Math.round(1550 * 0.15), // 233
      totalChargeZAR: 1550 + Math.round(1550 * 0.15),
    });
    expect(body.subscriptionId).toMatch(/^sub_stub_/);
    expect(getOrCreateCustomer).toHaveBeenCalledTimes(1);
    expect(initSubscriptionTransaction).toHaveBeenCalledTimes(1);
  });

  it('2. C5 tamper — server ignores client-supplied prices and recomputes', async () => {
    const tampered = {
      ...validBody,
      // Extra junk client might try to inject:
      monthlyTotalZAR: 1,
      totalChargeZAR: 1,
      amountCents: 100,
    };
    const res = await POST(makeJsonRequest('http://test/api/subscriptions', tampered));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.monthlyTotalZAR).toBe(1550); // server-computed, not 1
    const initCall = vi.mocked(initSubscriptionTransaction).mock.calls[0]![0];
    const serverTotal = 1550 + Math.round(1550 * 0.15);
    expect(initCall.amountCents).toBe(serverTotal * 100);
    expect(initCall.amountCents).not.toBe(100);
  });

  it('3. honeypot — silently returns bot path, no supabase/paystack calls', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/subscriptions', {
        ...validBody,
        website: 'http://spam.example',
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      authorizationUrl: '/onboarding?ref=bot',
    });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(getOrCreateCustomer).not.toHaveBeenCalled();
    expect(initSubscriptionTransaction).not.toHaveBeenCalled();
  });

  it('4. rate limited — 429 with Retry-After, no downstream calls', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, retryAfter: 17 });
    const res = await POST(makeJsonRequest('http://test/api/subscriptions', validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('17');
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
    expect(initSubscriptionTransaction).not.toHaveBeenCalled();
  });

  it('5. malformed JSON — 400', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/subscriptions', null, { raw: '{nope' }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid request body.' });
  });

  it('6. zod invalid — empty services array returns 422 with field', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/subscriptions', { ...validBody, services: [] }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('services');
  });

  it('7. zod invalid — consentGiven:false returns 422 with field', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/subscriptions', { ...validBody, consentGiven: false }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('consentGiven');
  });

  it('8. brackets fetch error — 500', async () => {
    mountBrackets(null, new Error('db boom'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/subscriptions', validBody));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/price your subscription/i);
    expect(errorSpy).toHaveBeenCalled();
    expect(initSubscriptionTransaction).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('9. dormant-only selection priced at 0 — 422', async () => {
    mountBrackets(DORMANT_BRACKETS);
    const res = await POST(
      makeJsonRequest('http://test/api/subscriptions', {
        ...validBody,
        services: ['bookkeeping'],
        brackets: { bookkeeping: 0 },
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/no priced services/i);
    expect(initSubscriptionTransaction).not.toHaveBeenCalled();
  });

  it('10. paystack init throws — 502', async () => {
    vi.mocked(initSubscriptionTransaction).mockRejectedValueOnce(new Error('paystack down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/subscriptions', validBody));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/start checkout/i);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
