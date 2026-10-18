/**
 * A retried proposal email lists the same lines as the first send.
 *
 * The first send is POST /api/proposals (priced by priceProposalSelection); the
 * retry is scripts/reconcile-deliveries.mjs, which reloads the stored proposal
 * row and rebuilds the email. Until 2026-10-18 the retry built its own lines
 * (brackets plus Dext only), so a retried email dropped WhatsApp Support,
 * Category Tracking and Personal Tax Returns while its total still counted
 * them. Both now use buildProposalLineItems (src/lib/pricing.ts).
 */
import { execFileSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeJsonRequest } from './helpers/request';
import { siteConfig } from '@/config/site';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}));
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }));
const { sendEmailMock } = vi.hoisted(() => ({ sendEmailMock: vi.fn() }));
vi.mock('@/lib/email/sendEmail', () => ({ sendEmail: sendEmailMock }));

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { POST } from '@/app/api/proposals/route';
import { priceProposalSelection } from '@/lib/proposalPricing';
import { tierDisplayName } from '@/config/tiers';
import { renderCreatedProposalClientEmail } from '@/lib/email/messages.mjs';
import { buildDeliveryMessage } from '../../scripts/reconcile-deliveries.mjs';

const PROPOSAL_ID = '11111111-1111-4111-8111-111111111111';
const REF = 'FT-2026-10-0042';
const OWNER = 'owner@capucor.com';

// Raw labels as the `brackets` table holds them, so the band formatting shows.
const BRACKETS = [
  { service_slug: 'accounting', ordinal: 1, label: '0 – 1 Mil', basic_price: 725, pro_price: 950, premium_price: 1525 },
  { service_slug: 'bookkeeping', ordinal: 2, label: 'Up to 100', basic_price: 300, pro_price: 450, premium_price: 700 },
  { service_slug: 'payroll', ordinal: 3, label: 'Employees: 3', basic_price: 450, pro_price: 600, premium_price: 950 },
];

const proposalInsert = vi.fn((_payload: Record<string, unknown>) => ({
  select: () => ({ single: async () => ({ data: { id: PROPOSAL_ID, ref_number: REF }, error: null }) }),
}));

function adminDouble() {
  return {
    from: (table: string) => {
      if (table === 'brackets') return { select: () => ({ in: async () => ({ data: BRACKETS, error: null }) }) };
      if (table === 'leads') {
        return { insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'lead_1' }, error: null }) }) }) };
      }
      if (table === 'proposals') return { insert: proposalInsert };
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as ReturnType<typeof createSupabaseAdminClient>;
}

// The runner's PostgREST client, serving the row the first send stored.
function runnerDb(stored: Record<string, unknown>) {
  return {
    one: vi.fn(async (table: string) => {
      if (table === 'proposals') return stored;
      throw new Error(`unexpected one(${table})`);
    }),
    request: vi.fn(async (table: string) => {
      if (table === 'brackets') return BRACKETS;
      throw new Error(`unexpected request(${table})`);
    }),
    deliveryStatusAt: vi.fn(async () => 'accepted'),
  };
}

function retry(stored: Record<string, unknown>, event_type: string, recipient: string) {
  return buildDeliveryMessage(
    { source_type: 'proposal', source_id: PROPOSAL_ID, event_type, recipient, created_at: stored.sent_at },
    runnerDb(stored),
    { marketingUrl: siteConfig.marketingUrl },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sendEmailMock.mockResolvedValue({
    deliveryStatus: 'accepted',
    deliveryId: 'delivery_1',
    providerId: 'email_1',
    errorCode: null,
    errorMessage: null,
  });
  process.env.RESEND_API_KEY = 're_test';
  process.env.OWNER_NOTIFICATION_EMAIL = OWNER;
  vi.mocked(createSupabaseAdminClient).mockReturnValue(adminDouble());
});

describe('a retried proposal email matches the first send', () => {
  it.each(['basic', 'pro'])('%s: client and owner emails, every add-on line', async (tierSlug) => {
    const res = await POST(
      makeJsonRequest('http://test/api/proposals', {
        services: ['accounting', 'bookkeeping', 'payroll'],
        brackets: { accounting: 1, bookkeeping: 2, payroll: 3 },
        tierSlug,
        addons: ['whatsapp-support', 'category-tracking', 'personal-tax:3'],
        answers: { vatRegistered: false },
        firstName: 'Pat',
        lastName: 'Patterson',
        businessName: 'Pat Trading Co',
        email: 'pat@example.com',
        consentGiven: true,
      }),
    );
    expect(res.status).toBe(200);
    const firstClient = sendEmailMock.mock.calls.find((c) => c[0].eventType === 'proposal.created_client')![0].message;
    const firstOwner = sendEmailMock.mock.calls.find((c) => c[0].eventType === 'proposal.created_owner')![0].message;
    const stored = { id: PROPOSAL_ID, ref_number: REF, ...proposalInsert.mock.calls[0]![0] };

    const retriedClient = await retry(stored, 'proposal.created_client', 'pat@example.com');
    const retriedOwner = await retry(stored, 'proposal.created_owner', OWNER);

    expect(retriedClient).toEqual(firstClient);
    expect(retriedOwner).toEqual(firstOwner);
    // Not vacuous: the add-on lines are there, and the scope flag is not a line.
    for (const text of ['WhatsApp Support', 'Category Tracking', 'Personal Tax Returns', '3 people', 'Monthly accounting']) {
      expect(retriedClient.html).toContain(text);
      expect(retriedOwner.text).toContain(text);
    }
    expect(retriedClient.html).not.toContain('Not VAT-registered');
  });

  // Rows written before the catalogue changed (Dext on Basic, the retired Xero
  // invoicing charge folded into accounting, a token with no count) and a
  // Premium row: the retry shows the lines the proposal page and PDF show,
  // both priced by priceProposalSelection from the stored tokens.
  it.each([
    ['basic', ['dext', 'xero-invoicing', 'personal-tax', 'whatsapp-support']],
    ['pro', ['dext', 'category-tracking', 'personal-tax:2']],
    ['premium', ['dext', 'whatsapp-support', 'category-tracking']],
  ])('%s: a stored row with %j', async (tierSlug, addons) => {
    const selection = { services: ['accounting', 'bookkeeping', 'payroll'], brackets: { accounting: 1, bookkeeping: 2, payroll: 3 } };
    const priced = await priceProposalSelection(adminDouble(), { ...selection, tierSlug, addons });
    if (!priced.ok) throw new Error(priced.error);
    const stored = {
      id: PROPOSAL_ID,
      ref_number: REF,
      token: 'proposal-token',
      first_name: 'Pat',
      last_name: 'Patterson',
      business_name: 'Pat Trading Co',
      email: 'pat@example.com',
      ...selection,
      tier_slug: tierSlug,
      addons,
      total_charge_zar: priced.data.totalChargeZAR,
      sent_at: '2026-10-01T08:00:00+00:00',
    };

    const retried = await retry(stored, 'proposal.created_client', 'pat@example.com');

    expect(retried.html).toBe(
      renderCreatedProposalClientEmail({
        firstName: 'Pat',
        businessName: 'Pat Trading Co',
        tierName: tierDisplayName(tierSlug),
        refNumber: REF,
        lineItems: priced.data.lineItems,
        totalChargeZAR: priced.data.totalChargeZAR,
        proposalUrl: `${siteConfig.marketingUrl}/proposal/proposal-token`,
        firstDebitFrom: stored.sent_at,
      }),
    );
    // Not vacuous: add-on lines beyond Monthly accounting and Payroll.
    expect(priced.data.lineItems.length).toBeGreaterThan(2);
    for (const line of priced.data.lineItems) expect(retried.html).toContain(line.name);
  });

  it('still refuses a proposal whose bracket is gone', async () => {
    const stored = {
      id: PROPOSAL_ID,
      token: 'proposal-token',
      email: 'pat@example.com',
      services: ['accounting'],
      brackets: { accounting: 99 },
      tier_slug: 'pro',
      addons: [],
      total_charge_zar: 950,
    };
    await expect(retry(stored, 'proposal.created_client', 'pat@example.com')).rejects.toMatchObject({
      code: 'pricing_source_missing',
    });
  });
});

describe('the runner loads the shared pricing code the way the workflow runs it', () => {
  // The workflow runs the script with plain Node and no `npm ci`: no Vite, no
  // `@/` alias. An alias import or non-erasable TypeScript in pricing.ts or
  // tiers.ts would pass every other test here and fail every retry in production.
  it('imports under plain Node', () => {
    const out = execFileSync(
      process.execPath,
      [
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
        '--input-type=module',
        '-e',
        "const m = await import('./scripts/reconcile-deliveries.mjs'); console.log(typeof m.buildDeliveryMessage);",
      ],
      { cwd: process.cwd(), encoding: 'utf8' },
    );
    expect(out.trim()).toBe('function');
  });
});
