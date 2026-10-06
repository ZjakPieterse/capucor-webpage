import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeJsonRequest } from './helpers/request';
import { siteConfig } from '@/config/site';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));
vi.mock('@/lib/email/sendEmail', () => ({
  sendEmail: sendEmailMock,
}));

import { checkRateLimit } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { POST } from '@/app/api/proposals/route';

// Pro prices: accounting ordinal 1 = 950, bookkeeping Dormant = 0, payroll
// ordinal 1 = 600 → 1550 monthly. Bookkeeping is there because Monthly
// accounting (accounting plus bookkeeping) is required on every proposal.
const PRO_BRACKETS = [
  {
    service_slug: 'accounting',
    ordinal: 1,
    label: '0–1 Mil',
    basic_price: 725,
    pro_price: 950,
    premium_price: 1525,
  },
  {
    service_slug: 'bookkeeping',
    ordinal: 0,
    label: 'Dormant',
    basic_price: 0,
    pro_price: 0,
    premium_price: 0,
  },
  {
    service_slug: 'accounting',
    ordinal: 13,
    label: '50 Mil – 75 Mil',
    basic_price: 3425,
    pro_price: 4475,
    premium_price: 7200,
  },
  {
    service_slug: 'accounting',
    ordinal: 12,
    label: '45 Mil – 50 Mil',
    basic_price: 3200,
    pro_price: 4175,
    premium_price: 6725,
  },
  {
    service_slug: 'payroll',
    ordinal: 1,
    label: '1 employee',
    basic_price: 450,
    pro_price: 600,
    premium_price: 950,
  },
];
const DORMANT_BRACKETS = [
  {
    service_slug: 'bookkeeping',
    ordinal: 0,
    label: 'Dormant',
    basic_price: 0,
    pro_price: 0,
    premium_price: 0,
  },
];

// Mutable per-test results, read at call time by the from() closures below.
let bracketRows: unknown = PRO_BRACKETS;
let bracketError: unknown = null;
let leadResult: { data: { id: string } | null; error: unknown } = {
  data: { id: 'lead_1' },
  error: null,
};
// The route reads the trigger-assigned ref_number back via .select().single().
let proposalResult: { data: { id: string; ref_number: string } | null; error: unknown } = {
  data: { id: '11111111-1111-4111-8111-111111111111', ref_number: 'FT-2026-06-0001' },
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
            // ⚠️ Resolves at `.in()`, mirroring production. Until 2026-09-04 it
            // resolved at `.returns()`, which meant this mock REQUIRED the
            // production code to keep the type override that disabled the
            // select-string check. A mock shaped around an escape hatch pins it
            // in place — see src/__tests__/supabase-query-typing.test.ts.
            in: async () => ({ data: bracketRows, error: bracketError }),
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
  services: ['accounting', 'bookkeeping', 'payroll'],
  brackets: { accounting: 1, bookkeeping: 0, payroll: 1 },
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
  proposalResult = {
    data: { id: '11111111-1111-4111-8111-111111111111', ref_number: 'FT-2026-06-0001' },
    error: null,
  };
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfter: 0 });
  sendEmailMock.mockResolvedValue({
    deliveryStatus: 'accepted',
    deliveryId: 'delivery_1',
    providerId: 'email_1',
    errorCode: null,
    errorMessage: null,
  });
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
    expect(body.deliveryStatus).toBe('accepted');
    expect(body.proposalUrl).toMatch(new RegExp(`^${siteConfig.marketingUrl}/proposal/.+`));

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
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    expect(sendEmailMock.mock.calls[0]![0]).toMatchObject({
      sourceType: 'proposal',
      sourceId: '11111111-1111-4111-8111-111111111111',
      eventType: 'proposal.created_client',
      idempotencyKey: 'capucor_web_proposal_created_client_11111111-1111-4111-8111-111111111111',
    });
    expect(sendEmailMock.mock.calls[0]![0].idempotencyKey).not.toContain(String(propPayload.token));
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
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        website: 'http://spam.example',
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('4. rate limited — 429 with Retry-After, no DB calls', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      retryAfter: 17,
    });
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
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        services: [],
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('services');
  });

  it('7. zod invalid — consentGiven:false returns 422 with field', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        consentGiven: false,
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('consentGiven');
  });

  it('8. zod invalid — missing firstName returns 422 with field', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        firstName: '',
      }),
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
        services: ['accounting', 'bookkeeping'],
        brackets: { accounting: 0, bookkeeping: 0 },
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

  it('13. addons omitted on Pro — nothing is stored (Dext is delivered but not listed since 2026-10-06)', async () => {
    const res = await POST(makeJsonRequest('http://test/api/proposals', validBody));
    expect(res.status).toBe(200);
    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(propPayload.addons).toEqual([]);
    expect(propPayload.monthly_total_zar).toBe(1550);
  });

  it('13b. addons omitted on Basic — defaults to empty, no addon charge', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', { ...validBody, tierSlug: 'basic' }),
    );
    expect(res.status).toBe(200);
    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(propPayload.addons).toEqual([]);
    expect(propPayload.monthly_total_zar).toBe(1175);
  });

  it('14. a stale page cannot add the withdrawn Dext add-on on Basic (tweaks round 1)', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        tierSlug: 'basic',
        addons: ['dext'],
      }),
    );
    expect(res.status).toBe(200);

    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(propPayload).toMatchObject({
      addons: [],
      monthly_total_zar: 1175,
      vat_zar: 0,
      total_charge_zar: 1175,
    });

    const leadPayload = leadInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect((leadPayload.config as Record<string, unknown>).addons).toEqual([]);
  });

  it('15. unknown addon slugs are filtered out, not priced', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        tierSlug: 'basic',
        addons: ['whatsapp-support', 'mystery-addon'],
      }),
    );
    expect(res.status).toBe(200);
    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(propPayload.addons).toEqual(['whatsapp-support']);
    expect(propPayload.monthly_total_zar).toBe(1175 + 750);
  });

  it('16. an add-on alone cannot carry a proposal — dormant selection still 422', async () => {
    bracketRows = DORMANT_BRACKETS;
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        services: ['accounting', 'bookkeeping'],
        brackets: { accounting: 0, bookkeeping: 0 },
        addons: ['dext'],
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/no priced services/i);
    expect(proposalInsert).not.toHaveBeenCalled();
  });

  it('17. returned provider error — proposal persists and response reports pending', async () => {
    sendEmailMock.mockResolvedValueOnce({
      deliveryStatus: 'pending',
      deliveryId: 'delivery_1',
      providerId: null,
      errorCode: 'validation_error',
      errorMessage: 'recipient rejected',
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(makeJsonRequest('http://test/api/proposals', validBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      deliveryStatus: 'pending',
    });
    expect(proposalInsert).toHaveBeenCalledOnce();
    // The owner copy is independent and is still attempted after client rejection.
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });

  // ── calculator-v2 (Phase 1): VAT / Xero-invoicing answers and the review action ──

  it('18. answers and intent are stored in leads.config and change neither price nor the proposal row', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        answers: { vatRegistered: false, xeroInvoicing: true },
        intent: 'accept',
      }),
    );
    expect(res.status).toBe(200);

    const config = (leadInsert.mock.calls[0]![0] as Record<string, unknown>).config as Record<string, unknown>;
    // The withdrawn Xero-invoicing answer is accepted from a stale page but not stored.
    expect(config.answers).toEqual({ vatRegistered: false });
    expect(config.intent).toBe('accept');

    // Same price and same stored services as without the answers.
    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(propPayload).toMatchObject({ monthly_total_zar: 1550, services: ['accounting', 'bookkeeping', 'payroll'] });
    expect(propPayload).not.toHaveProperty('answers');
    expect(propPayload).not.toHaveProperty('intent');
  });

  it('19. answers omitted — leads.config carries no answers or intent keys', async () => {
    const res = await POST(makeJsonRequest('http://test/api/proposals', validBody));
    expect(res.status).toBe(200);
    const config = (leadInsert.mock.calls[0]![0] as Record<string, unknown>).config as Record<string, unknown>;
    expect(config).not.toHaveProperty('answers');
    expect(config).not.toHaveProperty('intent');
  });

  it('20. an unknown answer key or intent is rejected with 422, nothing persisted', async () => {
    const bad = await POST(
      makeJsonRequest('http://test/api/proposals', { ...validBody, answers: { discount: true } }),
    );
    expect(bad.status).toBe(422);
    const badIntent = await POST(
      makeJsonRequest('http://test/api/proposals', { ...validBody, intent: 'buy-now' }),
    );
    expect(badIntent.status).toBe(422);
    expect(leadInsert).not.toHaveBeenCalled();
  });

  // ── calculator-v2 Phase 2: Premium by call, answer-driven add-ons, per-person add-ons ──

  it('21. Premium is refused for self-serve with 422, nothing persisted', async () => {
    for (const intent of [undefined, 'send', 'accept']) {
      const res = await POST(makeJsonRequest('http://test/api/proposals', { ...validBody, tierSlug: 'premium', intent }));
      expect(res.status).toBe(422);
      expect((await res.json()).field).toBe('tierSlug');
    }
    expect(leadInsert).not.toHaveBeenCalled();
    expect(proposalInsert).not.toHaveBeenCalled();
  });

  it('21b. a Premium request stores a call lead with the estimate and tells Capucor, but creates no proposal', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', { ...validBody, tierSlug: 'premium', intent: 'request' }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, requested: true });
    expect(proposalInsert).not.toHaveBeenCalled();
    const leadPayload = leadInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(leadPayload).toMatchObject({ source: 'call', business: 'Pat Trading Co' });
    // Premium prices: accounting 1525 + bookkeeping 0 + payroll 950.
    expect(leadPayload.config).toMatchObject({ tier: 'premium', intent: 'request', estimatedMonthlyZAR: 2475 });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const mail = sendEmailMock.mock.calls[0]![0];
    expect(mail).toMatchObject({ sourceType: 'lead', sourceId: 'lead_1', eventType: 'lead.owner_notification' });
    expect(mail.message.to).toBe('owner@capucor.com');
    expect(mail.message.subject).toBe('Premium request: Pat Trading Co');
    expect(mail.message.text).toMatch(/R\s?2,475/);
  });

  it('21c. a request for a self-serve package is refused with 422, nothing persisted', async () => {
    const res = await POST(makeJsonRequest('http://test/api/proposals', { ...validBody, intent: 'request' }));
    expect(res.status).toBe(422);
    expect((await res.json()).field).toBe('intent');
    expect(leadInsert).not.toHaveBeenCalled();
  });

  it('22. the withdrawn Xero-invoicing answer adds nothing on Basic (decision 2026-10-06)', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        tierSlug: 'basic',
        addons: [],
        answers: { xeroInvoicing: true },
      }),
    );
    expect(res.status).toBe(200);
    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(propPayload).toMatchObject({ addons: [], monthly_total_zar: 1175 });
  });

  it('22b. a proposal without Monthly accounting is refused with 422, nothing persisted (F30)', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        services: ['accounting', 'payroll'],
        brackets: { accounting: 1, payroll: 1 },
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.field).toBe('services');
    expect(body.error).toMatch(/Monthly accounting/);
    expect(leadInsert).not.toHaveBeenCalled();
    expect(proposalInsert).not.toHaveBeenCalled();
  });

  it('22c. revenue from "50 Mil – 75 Mil" upward goes to a call: 422, nothing persisted', async () => {
    for (const tierSlug of ['basic', 'pro']) {
      const res = await POST(
        makeJsonRequest('http://test/api/proposals', {
          ...validBody,
          tierSlug,
          brackets: { accounting: 13, bookkeeping: 0, payroll: 1 },
        }),
      );
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.field).toBe('brackets.accounting');
      expect(body.error).toMatch(/above R50m/);
    }
    expect(leadInsert).not.toHaveBeenCalled();
    expect(proposalInsert).not.toHaveBeenCalled();
  });

  it('22d. the band just below R50m stays self-serve', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        brackets: { accounting: 12, bookkeeping: 0, payroll: 1 },
      }),
    );
    expect(res.status).toBe(200);
    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(propPayload.monthly_total_zar).toBe(4175 + 600);
  });

  it('22e. the client and owner emails show one "Monthly accounting" line', async () => {
    const res = await POST(makeJsonRequest('http://test/api/proposals', validBody));
    expect(res.status).toBe(200);
    const clientHtml = sendEmailMock.mock.calls[0]![0].message.html as string;
    const ownerText = sendEmailMock.mock.calls[1]![0].message.text as string;
    for (const body of [clientHtml, ownerText]) {
      expect(body).toContain('Monthly accounting');
      expect(body).toContain('R0 to R1m');
      expect(body).not.toMatch(/>Accounting<|>Bookkeeping<|· Accounting|· Bookkeeping/);
    }
    expect(ownerText).toContain('Monthly accounting (R0 to R1m · no transactions): R 950');
  });

  it('23. a client cannot add the Xero charge or the VAT flag without the answers', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        tierSlug: 'basic',
        addons: ['xero-invoicing', 'not-vat-registered'],
        answers: { xeroInvoicing: false, vatRegistered: true },
      }),
    );
    expect(res.status).toBe(200);
    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(propPayload).toMatchObject({ addons: [], monthly_total_zar: 1175 });
  });

  it('24. a Xero invoicing Yes on Pro costs nothing and is not stored', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', { ...validBody, answers: { xeroInvoicing: true } }),
    );
    expect(res.status).toBe(200);
    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(propPayload).toMatchObject({ addons: [], monthly_total_zar: 1550 });
  });

  it('25. a VAT No stores the not-VAT-registered flag at no charge', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        tierSlug: 'basic',
        answers: { vatRegistered: false },
      }),
    );
    expect(res.status).toBe(200);
    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(propPayload).toMatchObject({ addons: ['not-vat-registered'], monthly_total_zar: 1175 });
  });

  it('26. personal tax returns are priced per person from the stored count', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        ...validBody,
        tierSlug: 'basic',
        addons: ['personal-tax:3', 'whatsapp-support'],
      }),
    );
    expect(res.status).toBe(200);
    const propPayload = proposalInsert.mock.calls[0]![0] as Record<string, unknown>;
    expect(propPayload).toMatchObject({
      addons: ['whatsapp-support', 'personal-tax:3'],
      monthly_total_zar: 1175 + 750 + 3 * 75,
    });
  });

  it('27. a malformed add-on token is rejected with 422', async () => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', { ...validBody, addons: ['personal-tax:abc'] }),
    );
    expect(res.status).toBe(422);
    expect(leadInsert).not.toHaveBeenCalled();
  });
});
