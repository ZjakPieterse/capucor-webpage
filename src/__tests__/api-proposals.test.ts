import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeJsonRequest } from './helpers/request';
import { siteConfig } from '@/config/site';

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

import { checkRateLimit } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { POST } from '@/app/api/proposals/route';

// Pro prices: accounting ordinal 1 = 950, payroll ordinal 1 = 600 → 1550 monthly
const PRO_BRACKETS = [
  { service_slug: 'accounting', ordinal: 1, label: '0–1 Mil', basic_price: 725, pro_price: 950, premium_price: 1525 },
  { service_slug: 'payroll', ordinal: 1, label: '1 employee', basic_price: 450, pro_price: 600, premium_price: 950 },
];
const DORMANT_BRACKETS = [
  { service_slug: 'bookkeeping', ordinal: 0, label: 'Dormant', basic_price: 0, pro_price: 0, premium_price: 0 },
];

// Mutable per-test results, read at call time by the from() closures below.
let bracketRows: unknown = PRO_BRACKETS;
let bracketError: unknown = null;
let leadResult: { data: { id: string } | null; error: unknown } = { data: { id: 'lead_1' }, error: null };
// The route reads the trigger-assigned ref_number back via .select().single().
let proposalResult: { data: { ref_number: string } | null; error: unknown } = {
  data: { ref_number: 'FT-2026-06-0001' },
  error: null,
};

const leadInsert = vi.fn((_payload: Record<string, unknown>) => ({
  select: () => ({ single: async () => leadResult }),
}));
const proposalInsert = vi.fn((_payload: Record<string, unknown>) => ({
  select: () => ({ single: async () => proposalResult }),
}));

function mountAdmin() {
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    from: (table: string) => {
      if (table === 'brackets') {
        return {
          select: () => ({
            in: () => ({ returns: async () => ({ data: bracketRows, error: bracketError }) }),
          }),
        };
      }
      if (table === 'leads') return { insert: leadInsert };
      if (table === 'proposals') return { insert: proposalInsert };
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as ReturnType<typeof createSupabaseAdminClient>);
}

const validBody = {
  services: ['accounting', 'payroll'],
  brackets: { accounting: 1, payroll: 1 },
  tierSlug: 'pro',
  firstName: 'Pat',
  lastName: 'Patterson',
  businessName: 'Pat Trading Co',
  email: 'pat@example.com',
  consentGiven: true as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  bracketRows = PRO_BRACKETS;
  bracketError = null;
  leadResult = { data: { id: 'lead_1' }, error: null };
  proposalResult = { data: { ref_number: 'FT-2026-06-0001' }, error: null };
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfter: 0 });
  sendMock.mockResolvedValue({ data: { id: 'email_1' }, error: null });
  process.env.RESEND_API_KEY = 're_test';
  process.env.OWNER_NOTIFICATION_EMAIL = 'owner@capucor.com';
  mountAdmin();
});

describe('POST /api/proposals', () => {
  it('1. happy path — persists lead + proposal, returns proposalUrl', async () => {
    const res = await POST(makeJsonRequest('http://test/api/proposals', validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.proposalUrl).toMatch(new RegExp(`^${siteConfig.url}/proposal/.+`));

    // Lead captured
    const leadPayload = leadInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(leadPayload).toMatchObject({
      source: 'proposal',
      name: 'Pat Patterson',
      business: 'Pat Trading Co',
      email: 'pat@example.com',
    });

    // Proposal priced server-side
    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(propPayload).toMatchObject({
      status: 'sent',
      monthly_total_zar: 1550,
      vat_zar: 0,
      total_charge_zar: 1550,
      tier_slug: 'pro',
    });
    expect(typeof propPayload.token).toBe('string');

    // Two emails attempted (client + owner)
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('2. tamper — server ignores client-supplied prices and recomputes', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        monthly_total_zar: 1,
        total_charge_zar: 1,
      }),
    );
    expect(res.status).toBe(200);
    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(propPayload.monthly_total_zar).toBe(1550);
  });

  it('3. honeypot — silently succeeds, no DB calls', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', { ...validBody, website: 'http://spam.example' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('4. rate limited — 429 with Retry-After, no DB calls', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, retryAfter: 17 });
    const res = await POST(makeJsonRequest('http://test/api/proposals', validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('17');
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('5. malformed JSON — 400', async () => {
    const res = await POST(makeJsonRequest('http://test/api/proposals', null, { raw: '{nope' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid request body.' });
  });

  it('6. zod invalid — empty services returns 422 with field', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', { ...validBody, services: [] }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('services');
  });

  it('7. zod invalid — consentGiven:false returns 422 with field', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', { ...validBody, consentGiven: false }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('consentGiven');
  });

  it('8. zod invalid — missing firstName returns 422 with field', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', { ...validBody, firstName: '' }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('firstName');
  });

  it('9. brackets fetch error — 500, no proposal insert', async () => {
    bracketError = new Error('db boom');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/proposals', validBody));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/price your proposal/i);
    expect(proposalInsert).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('10. dormant-only selection priced at 0 — 422', async () => {
    bracketRows = DORMANT_BRACKETS;
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        services: ['bookkeeping'],
        brackets: { bookkeeping: 0 },
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/no priced services/i);
    expect(proposalInsert).not.toHaveBeenCalled();
  });

  it('11. lead insert error — 500, no proposal insert', async () => {
    leadResult = { data: null, error: new Error('lead boom') };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/proposals', validBody));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/save your details/i);
    expect(proposalInsert).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('12. proposal insert error — 500', async () => {
    proposalResult = { data: null, error: new Error('proposal boom') };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeJsonRequest('http://test/api/proposals', validBody));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/generate your proposal/i);
    errorSpy.mockRestore();
  });

  it('13. addons omitted — defaults to empty, no addon charge', async () => {
    const res = await POST(makeJsonRequest('http://test/api/proposals', validBody));
    expect(res.status).toBe(200);
    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(propPayload.addons).toEqual([]);
    expect(propPayload.monthly_total_zar).toBe(1550);
  });

  it('14. dext add-on — flat R375 added to the recomputed total and persisted', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', { ...validBody, addons: ['dext'] }),
    );
    expect(res.status).toBe(200);

    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    const expectedMonthly = 1550 + 375;
    expect(propPayload).toMatchObject({
      addons: ['dext'],
      monthly_total_zar: expectedMonthly,
      vat_zar: 0,
      total_charge_zar: expectedMonthly,
    });

    const leadPayload = leadInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect((leadPayload.config as Record<string, unknown>).addons).toEqual(['dext']);
  });

  it('15. unknown addon slugs are filtered out, not priced', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        addons: ['dext', 'mystery-addon'],
      }),
    );
    expect(res.status).toBe(200);
    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(propPayload.addons).toEqual(['dext']);
    expect(propPayload.monthly_total_zar).toBe(1550 + 375);
  });

  it('16. an add-on alone cannot carry a proposal — dormant selection still 422', async () => {
    bracketRows = DORMANT_BRACKETS;
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        services: ['bookkeeping'],
        brackets: { bookkeeping: 0 },
        addons: ['dext'],
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/no priced services/i);
    expect(proposalInsert).not.toHaveBeenCalled();
  });
});
