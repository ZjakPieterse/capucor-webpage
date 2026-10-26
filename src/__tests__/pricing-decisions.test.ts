// Pricing decisions → code, locked by test (codebase review, 2026-10-07).
//
// Each describe names the decision it locks. The figures in these fixtures are
// test data shaped like the live ladders (the real rows live in the Supabase
// `brackets` table), so these tests prove the RULES, not the live figures:
// a ladder change is a data change and does not need a code change here.
//
// What these tests deliberately do not cover: the live bracket figures, the
// payroll rows' flat Basic price (a data property of the 1000+n rows), and the
// anon read path used by the proposal page and the signed PDF.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';
import {
  CORE_LINE_NAME,
  CORE_LINE_SLUG,
  addonTotal,
  addonsForTier,
  buildAddonLineItems,
  formatBandLabel,
  monthlyTotal,
  payrollOnlyError,
  resolveAddons,
} from '@/lib/pricing';
import { priceProposalSelection, type ProposalSelectionInput } from '@/lib/proposalPricing';
import * as calculatorFlow from '@/lib/calculatorFlow';
import { deriveServices, effectiveAddons } from '@/lib/calculatorFlow';
import * as calculatorCopy from '@/config/calculatorCopy';
import {
  PAYROLL_ONLY_TIER,
  PRICING_ADDONS,
  PROPOSAL_TIER_SLUGS,
  TIERS_BY_APPLICATION,
  TIER_ORDER,
  addonIncludedInTier,
  tierDisplayName,
} from '@/config/tiers';
import { PAYROLL } from '@/config/servicePages';
import { cumulativeInclusions, reviewInclusions } from '@/lib/schedule';
import { CATCHUP_FREE_MONTHS } from '@/config/serviceScope';
import {
  FEES_NOTES,
  PAYROLL_ONLY_TERMS,
  feesNotesFor,
  proposalTermsFor,
  PROPOSAL_TERMS,
  RESPONSIBILITIES_OURS,
  RESPONSIBILITIES_YOURS,
  responsibilitiesFor,
} from '@/config/proposalTerms';
import { renderProposalDocumentHtml } from '@/lib/proposal/renderProposalDocumentHtml';
import { formatZAR } from '@/lib/utils';

// ── Fixtures ────────────────────────────────────────────────────────────────

interface Row {
  service_slug: string;
  ordinal: number;
  label: string;
  basic_price: number;
  pro_price: number;
  premium_price: number;
  active: boolean;
}

const row = (service_slug: string, ordinal: number, label: string, basic: number, pro: number, premium: number, active = true): Row => ({
  service_slug, ordinal, label, basic_price: basic, pro_price: pro, premium_price: premium, active,
});

const ROWS: Row[] = [
  row('accounting', 0, 'Dormant', 500, 650, 1050),
  row('accounting', 1, '0 – 1 Mil', 725, 950, 1525),
  row('accounting', 12, '35 Mil – 50 Mil', 4000, 5200, 8400),
  row('accounting', 13, '50 Mil – 75 Mil', 5000, 6500, 10500),
  row('accounting', 25, '350 Mil+', 6125, 7975, 12875),
  row('bookkeeping', 0, 'Dormant', 0, 0, 0),
  row('bookkeeping', 12, 'Up to 300', 2850, 3700, 6000),
  row('bookkeeping', 13, 'Up to 325', 3050, 3975, 6400),
  // Payroll re-issued at ordinal 1000+n with one flat (Basic) price in every
  // tier; the original 0–100 rows stay, inactive, for proposals sent before.
  row('payroll', 1005, 'Employees: 5', 750, 750, 750),
  row('payroll', 5, 'Employees: 5', 750, 975, 1575, false),
];

// A stand-in for the service-role client: records the query and answers the
// `.in(...)` call the way PostgREST would, with every row (active or not).
function fakeAdmin(rows: Row[] = ROWS, error: unknown = null) {
  const calls: unknown[][] = [];
  const query = {
    select(cols: string) {
      calls.push(['select', cols]);
      return query;
    },
    in(col: string, values: string[]) {
      calls.push(['in', col, values]);
      return Promise.resolve(
        error ? { data: null, error } : { data: rows.filter((r) => values.includes(r.service_slug)), error: null },
      );
    },
  };
  const client = {
    from(table: string) {
      calls.push(['from', table]);
      return query;
    },
  };
  return { admin: client as unknown as SupabaseClient<Database>, calls };
}

const CORE = { accounting: 1, bookkeeping: 12 };

async function price(input: Partial<ProposalSelectionInput> & { tierSlug: string }) {
  const { admin } = fakeAdmin();
  const result = await priceProposalSelection(admin, {
    services: ['accounting', 'bookkeeping'],
    brackets: CORE,
    addons: [],
    ...input,
  });
  if (!result.ok) throw new Error(`expected a price, got ${result.status} ${result.error}`);
  return result.data;
}

const sum = (xs: { price: number }[]) => xs.reduce((s, x) => s + x.price, 0);

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ── Package structure: one core line, summed from two ladders ───────────────

describe('core service (calculator-v2 package structure 1; review answers 2)', () => {
  it.each(TIER_ORDER)('on %s, accounting plus bookkeeping is one "Monthly accounting" line at the summed price', async (tier) => {
    const d = await price({ tierSlug: tier });
    const acc = ROWS.find((r) => r.service_slug === 'accounting' && r.ordinal === 1)!;
    const bk = ROWS.find((r) => r.service_slug === 'bookkeeping' && r.ordinal === 12)!;
    const key = `${tier}_price` as 'basic_price' | 'pro_price' | 'premium_price';
    // Premium also lists WhatsApp support, included at no charge (2026-10-18, kept 2026-10-24).
    expect(d.lineItems.filter((l) => l.slug !== 'whatsapp-support')).toEqual([
      { slug: CORE_LINE_SLUG, name: CORE_LINE_NAME, label: 'R0 to R1m · up to 300 transactions', price: acc[key] + bk[key] },
    ]);
    expect(d.lineItems.filter((l) => l.slug === 'whatsapp-support').map((l) => l.price)).toEqual(tier === 'premium' ? [0] : []);
    expect(d.monthlyTotalZAR).toBe(acc[key] + bk[key]);
  });

  it('the core line comes first whatever order the services arrive in', async () => {
    const d = await price({ tierSlug: 'basic', services: ['payroll', 'bookkeeping', 'accounting'], brackets: { ...CORE, payroll: 1005 } });
    expect(d.lineItems.map((l) => l.slug)).toEqual(['payroll', CORE_LINE_SLUG]);
    expect(sum(d.lineItems)).toBe(d.monthlyTotalZAR);
  });

  it('a dormant business still pays the dormant accounting price (bookkeeping dormant is R0)', async () => {
    const d = await price({ tierSlug: 'basic', brackets: { accounting: 0, bookkeeping: 0 } });
    expect(d.monthlyTotalZAR).toBe(500);
    expect(d.lineItems[0]!.label).toBe('Dormant · no transactions');
  });
});

// ── Tier uplift on core only; payroll at the Basic rate ─────────────────────

describe('payroll on and off (package structure 3; pricing figures 2)', () => {
  it('a payroll No drops a remembered headcount, so it is not priced', () => {
    const brackets = { ...CORE, payroll: 1005 };
    const no = [...deriveServices(brackets, { needsAccounting: true, needsPayroll: false })];
    const yes = [...deriveServices(brackets, { needsAccounting: true, needsPayroll: true })];
    expect(no).not.toContain('payroll');
    expect(monthlyTotal(yes, brackets, 'basic', ROWS) - monthlyTotal(no, brackets, 'basic', ROWS)).toBe(750);
  });

  it('with flat payroll rows, the only difference between packages is the core uplift', async () => {
    const withPayroll = { services: ['accounting', 'bookkeeping', 'payroll'], brackets: { ...CORE, payroll: 1005 } };
    for (const tier of TIER_ORDER) {
      const core = (await price({ tierSlug: tier })).monthlyTotalZAR;
      const all = (await price({ tierSlug: tier, ...withPayroll })).monthlyTotalZAR;
      expect(all - core).toBe(750);
    }
  });

  it('payroll shows as its own line with a plain headcount label', async () => {
    const d = await price({ tierSlug: 'pro', services: ['accounting', 'bookkeeping', 'payroll'], brackets: { ...CORE, payroll: 1005 } });
    expect(d.lineItems.find((l) => l.slug === 'payroll')).toMatchObject({ label: '5 employees', price: 750 });
  });
});

// ── Price-list changes are new rows: retired rows still price ───────────────

describe('retired bracket rows (pricing figures, "How it is implemented")', () => {
  it('server pricing reads brackets with no active filter, so a proposal on a retired ordinal prices as sent', async () => {
    const { admin, calls } = fakeAdmin();
    const r = await priceProposalSelection(admin, {
      services: ['accounting', 'bookkeeping', 'payroll'],
      brackets: { ...CORE, payroll: 5 },
      tierSlug: 'pro',
      addons: [],
    });
    expect(r.ok && r.data.lineItems.find((l) => l.slug === 'payroll')?.price).toBe(975);
    expect(calls.some((c) => c[0] === 'eq')).toBe(false);
  });

  it('a stored ordinal with no row at all is left out rather than priced at zero', async () => {
    const d = await price({ tierSlug: 'basic', services: ['accounting', 'bookkeeping', 'payroll'], brackets: { ...CORE, payroll: 9999 } });
    expect(d.lineItems.map((l) => l.slug)).toEqual([CORE_LINE_SLUG]);
  });

  it('a selection with no priced bracket is refused (422); a fetch error is a 500', async () => {
    const empty = await priceProposalSelection(fakeAdmin([]).admin, { services: ['accounting'], brackets: { accounting: 1 }, tierSlug: 'basic', addons: ['whatsapp-support'] });
    expect(empty).toMatchObject({ ok: false, status: 422 });
    const failed = await priceProposalSelection(fakeAdmin(ROWS, new Error('down')).admin, { services: ['accounting'], brackets: CORE, tierSlug: 'basic', addons: [] });
    expect(failed).toMatchObject({ ok: false, status: 500 });
  });
});

// ── Band boundaries ─────────────────────────────────────────────────────────

// Full-site audit decision 1 (2026-10-13, domains/capucor/wiki/decisions/
// 2026-10-13-full-audit-decisions.md): every revenue, transaction and employee
// band is self-serve; only Premium goes to a call. Supersedes review answers 4
// (revenue above R50m to a call), which this block used to lock.
describe('every band is self-serve (audit decision 1; supersedes review answers 4)', () => {
  it.each([
    [13, 'R50m to R75m'],
    [25, 'R350m+'],
  ])('revenue ordinal %i (%s) prices on Basic and Pro like any other band', async (ordinal, label) => {
    const band = ROWS.find((r) => r.service_slug === 'accounting' && r.ordinal === ordinal)!;
    expect(formatBandLabel('accounting', band.label)).toBe(label);
    for (const tierSlug of ['basic', 'pro'] as const) {
      const d = await price({ tierSlug, brackets: { accounting: ordinal, bookkeeping: 12 } });
      const bk = ROWS.find((r) => r.service_slug === 'bookkeeping' && r.ordinal === 12)!;
      expect(d.monthlyTotalZAR).toBe(band[`${tierSlug}_price`] + bk[`${tierSlug}_price`]);
    }
  });

  it('no revenue gate is left in the calculator flow or its copy', () => {
    expect('revenueNeedsCall' in calculatorFlow).toBe(false);
    expect('REVENUE_CALL_FROM_ORDINAL' in calculatorCopy).toBe(false);
    expect('REVENUE_CALL_COPY' in calculatorCopy).toBe(false);
    expect(TIERS_BY_APPLICATION).toEqual(['premium']);
  });

  it('adjacent transaction bands price independently (up to 300 vs up to 325)', () => {
    const at = (bk: number) => monthlyTotal(['bookkeeping'], { bookkeeping: bk }, 'basic', ROWS);
    expect(at(13) - at(12)).toBe(200);
    expect(formatBandLabel('bookkeeping', 'Up to 1000')).toBe('up to 1,000 transactions');
  });
});

// ── Packages sold by application ───────────────────────────────────────────

describe('Premium by application (package structure 6; tweaks round 1 item 6)', () => {
  it('only Premium is sold by application, and it is the top package', () => {
    expect([...TIERS_BY_APPLICATION]).toEqual(['premium']);
    expect(TIER_ORDER[TIER_ORDER.length - 1]).toBe('premium');
  });

  it('the Premium "from" price is the calculated price: no floor (premium floor decision 1)', async () => {
    const d = await price({ tierSlug: 'premium', brackets: { accounting: 0, bookkeeping: 0 } });
    expect(d.monthlyTotalZAR).toBe(1050);
  });
});

// ── Add-on catalogue and combinations ──────────────────────────────────────

describe('add-on figures (Phase 0 figures; tweaks round 1 item 7; premium floor decision 2 parked)', () => {
  const bySlug = Object.fromEntries(PRICING_ADDONS.map((a) => [a.slug, a]));

  it('the add-ons step offers exactly WhatsApp, category tracking and personal tax', () => {
    expect(PRICING_ADDONS.filter((a) => !a.hidden).map((a) => a.slug)).toEqual([
      'whatsapp-support',
      'category-tracking',
      'personal-tax',
    ]);
  });

  it('carries the decided figures', () => {
    expect(bySlug['whatsapp-support']!.priceZAR).toBe(750);
    // 25% of the transaction price, minimum R 750, is decided but parked until
    // a client asks; until then the flat R 1 200 stays live.
    expect(bySlug['category-tracking']!.priceZAR).toBe(1200);
    expect(bySlug['personal-tax']!.priceZAR * 12).toBe(900);
    expect(bySlug['personal-tax']!.unit).toMatchObject({ max: 10 });
    expect(bySlug.dext).toMatchObject({ priceZAR: 375, includedFromTier: 'pro', hidden: true });
    expect(bySlug['xero-invoicing']).toMatchObject({ priceZAR: 200, includedFromTier: 'pro', hidden: true, foldIntoService: 'accounting' });
    expect(bySlug['not-vat-registered']).toMatchObject({ priceZAR: 0, scopeFlag: true, hidden: true });
  });

  it('WhatsApp is included in Premium only (2026-10-18, kept 2026-10-24); every other visible add-on is charged on every package', () => {
    for (const addon of PRICING_ADDONS.filter((a) => !a.hidden)) {
      for (const tier of TIER_ORDER) {
        expect(addonIncludedInTier(addon, tier)).toBe(addon.slug === 'whatsapp-support' && tier === 'premium');
      }
    }
  });

  it.each(TIER_ORDER)('all three visible add-ons together on %s: totals and lines agree', async (tier) => {
    const addons = ['whatsapp-support', 'category-tracking', 'personal-tax:3'];
    const core = (await price({ tierSlug: tier })).monthlyTotalZAR;
    const d = await price({ tierSlug: tier, addons });
    expect(d.monthlyTotalZAR - core).toBe((tier === 'premium' ? 0 : 750) + 1200 + 3 * 75);
    expect(sum(d.lineItems)).toBe(d.monthlyTotalZAR);
    expect(d.lineItems.find((l) => l.slug === 'personal-tax')).toMatchObject({ label: '3 people', price: 225 });
    expect(d.addonSlugs).toEqual(['whatsapp-support', 'category-tracking', 'personal-tax:3']);
  });

  it('personal tax: one person is singular; a count above 10 is capped; 0 or a bad count reads as 1', () => {
    expect(buildAddonLineItems(['personal-tax:1'], 'basic')[0]).toMatchObject({ label: '1 person', price: 75 });
    expect(addonTotal(['personal-tax:99'], 'basic')).toBe(750);
    expect(addonTotal(['personal-tax:0'], 'basic')).toBe(75);
    expect(resolveAddons(['personal-tax:2', 'personal-tax:5'])).toEqual([{ addon: expect.objectContaining({ slug: 'personal-tax' }), quantity: 5 }]);
  });

  it('a repeated flat add-on is charged once', () => {
    expect(addonTotal(['whatsapp-support', 'whatsapp-support'], 'pro')).toBe(750);
  });
});

// ── VAT and Xero: scope, never price ───────────────────────────────────────

describe('VAT and Xero answers (package structure 8; review answers 1)', () => {
  it.each(TIER_ORDER)('a VAT No on %s adds a scope flag at no charge and no line', async (tier) => {
    const yes = await price({ tierSlug: tier, addons: effectiveAddons([], { vatRegistered: true }) });
    const no = await price({ tierSlug: tier, addons: effectiveAddons([], { vatRegistered: false }) });
    expect(no.monthlyTotalZAR).toBe(yes.monthlyTotalZAR);
    expect(no.addonSlugs).toContain('not-vat-registered');
    expect(no.lineItems).toEqual(yes.lineItems);
  });

  it('the calculator can no longer produce the Xero token', () => {
    expect(effectiveAddons(['xero-invoicing', 'whatsapp-support'], { vatRegistered: true })).toEqual(['whatsapp-support']);
  });
});

// ── Legacy tokens on proposals already sent ────────────────────────────────

describe('legacy slugs on proposals already sent (tweaks round 1 item 7; review answers 1)', () => {
  it('Basic with the retired Xero charge: +R200 inside the one core line, no line of its own', async () => {
    const plain = await price({ tierSlug: 'basic' });
    const legacy = await price({ tierSlug: 'basic', addons: ['xero-invoicing'] });
    expect(legacy.monthlyTotalZAR - plain.monthlyTotalZAR).toBe(200);
    expect(legacy.lineItems).toEqual([{ ...plain.lineItems[0]!, price: plain.lineItems[0]!.price + 200 }]);
  });

  it('Pro or Premium with the retired Xero token: no charge and the token is dropped', async () => {
    for (const tier of ['pro', 'premium']) {
      const legacy = await price({ tierSlug: tier, addons: ['xero-invoicing'] });
      expect(legacy.monthlyTotalZAR).toBe((await price({ tierSlug: tier })).monthlyTotalZAR);
      expect(legacy.addonSlugs).not.toContain('xero-invoicing');
    }
  });

  it('Basic with the withdrawn Dext add-on still prices R375 on its own labelled line', async () => {
    const d = await price({ tierSlug: 'basic', addons: ['dext'] });
    expect(d.lineItems.find((l) => l.slug === 'dext')).toMatchObject({ price: 375, label: 'Software access, you process the items' });
    expect(sum(d.lineItems)).toBe(d.monthlyTotalZAR);
  });

  it('Pro with an old Dext token: still free, and no longer listed', async () => {
    const d = await price({ tierSlug: 'pro', addons: ['dext'] });
    expect(d.monthlyTotalZAR).toBe((await price({ tierSlug: 'pro' })).monthlyTotalZAR);
    expect(d.addonSlugs).toEqual([]);
    expect(addonsForTier([], 'premium')).not.toContain('dext');
  });

  it('every legacy combination on Basic still sums line by line', async () => {
    const d = await price({
      tierSlug: 'basic',
      services: ['accounting', 'bookkeeping', 'payroll'],
      brackets: { ...CORE, payroll: 5 },
      addons: ['xero-invoicing', 'dext', 'not-vat-registered', 'whatsapp-support', 'personal-tax:2'],
    });
    expect(d.monthlyTotalZAR).toBe(725 + 2850 + 200 + 750 + 375 + 750 + 150);
    expect(sum(d.lineItems)).toBe(d.monthlyTotalZAR);
  });
});

// ── All-in prices and rounding ─────────────────────────────────────────────

describe('all-in prices and display (pricing model: not VAT-registered; review answers 6)', () => {
  it('no VAT is added: the charge is the monthly total', async () => {
    const d = await price({ tierSlug: 'pro', addons: ['whatsapp-support'] });
    expect(d.vatZAR).toBe(0);
    expect(d.totalChargeZAR).toBe(d.monthlyTotalZAR);
  });

  // Audit decision 2 (2026-10-13): "R 5 750", no cents; supersedes review
  // answers 6 ("R 6,200"). Spaces are no-break spaces (U+00A0).
  it('prices read "R 6 200": a space between thousands and no cents', () => {
    expect(formatZAR(6200)).toBe('R\u00a06\u00a0200');
    expect(formatZAR(0.1 + 0.2)).toBe('R\u00a00.30');
  });
});

// ── Catch-up ───────────────────────────────────────────────────────────────

describe('catch-up (pricing figures 4)', () => {
  it('the proposal terms promise the same number of free months as the config', () => {
    const phrase = `${CATCHUP_FREE_MONTHS} months before you accept`;
    expect(CATCHUP_FREE_MONTHS).toBe(3);
    expect(FEES_NOTES.some((n) => n.includes(phrase))).toBe(true);
    expect(JSON.stringify(PROPOSAL_TERMS)).toContain(phrase);
  });
});

// ── Payroll on its own (Zjak, 2026-10-18) ──────────────────────────────────
//
// Supersedes package structure 2 ("payroll-only buyers go to a fit call") for
// payroll: "Do you need monthly accounting services?" No prices payroll alone
// at the payroll bracket price (the Basic column, flat across packages), with
// no add-ons, and the client gets a proposal to sign online like any package.

describe('payroll-only package (2026-10-18)', () => {
  const PAYROLL_ONLY = { tierSlug: PAYROLL_ONLY_TIER, services: ['payroll'], brackets: { payroll: 1005 } };

  it('prices payroll alone at its Basic price, as one "Payroll" line', async () => {
    const d = await price(PAYROLL_ONLY);
    expect(d.lineItems).toEqual([{ slug: 'payroll', name: 'Payroll', label: '5 employees', price: 750 }]);
    expect(d.monthlyTotalZAR).toBe(750);
    expect(d.addonSlugs).toEqual([]);
  });

  it('costs exactly what payroll adds to any package', async () => {
    const only = (await price(PAYROLL_ONLY)).monthlyTotalZAR;
    for (const tier of TIER_ORDER) {
      const core = (await price({ tierSlug: tier })).monthlyTotalZAR;
      const all = (await price({ tierSlug: tier, services: ['accounting', 'bookkeeping', 'payroll'], brackets: { ...CORE, payroll: 1005 } })).monthlyTotalZAR;
      expect(all - core).toBe(only);
    }
  });

  it('a retired payroll row prices at its Basic column, never Pro or Premium', async () => {
    const d = await price({ ...PAYROLL_ONLY, brackets: { payroll: 5 } });
    expect(d.monthlyTotalZAR).toBe(750);
  });

  it('carries no add-ons and no VAT flag; Premium-only inclusions do not apply', () => {
    expect(effectiveAddons(['whatsapp-support', 'personal-tax:2'], { needsAccounting: false, vatRegistered: false })).toEqual([]);
    expect(addonsForTier([], PAYROLL_ONLY_TIER)).toEqual([]);
    for (const addon of PRICING_ADDONS) expect(addonIncludedInTier(addon, PAYROLL_ONLY_TIER)).toBe(false);
  });

  it('is self-serve, shown as the "Payroll" package, and only payroll with a headcount qualifies', () => {
    expect(TIERS_BY_APPLICATION).not.toContain(PAYROLL_ONLY_TIER);
    expect(PROPOSAL_TIER_SLUGS).toEqual([...TIER_ORDER, PAYROLL_ONLY_TIER]);
    expect(tierDisplayName(PAYROLL_ONLY_TIER)).toBe('Payroll');
    expect(payrollOnlyError(['payroll'], { payroll: 1005 })).toBeNull();
    expect(payrollOnlyError(['payroll'], {})).not.toBeNull();
    expect(payrollOnlyError(['accounting', 'bookkeeping', 'payroll'], { ...CORE, payroll: 1005 })).not.toBeNull();
  });

  it('No to accounting drops remembered core bands from the priced services', () => {
    const remembered = { ...CORE, payroll: 1005 };
    expect([...deriveServices(remembered, { needsAccounting: false, needsPayroll: true })]).toEqual(['payroll']);
  });

  it('the review and the signed schedule list the /payroll page items, and only those', () => {
    const items = PAYROLL.items.map((i) => i.title);
    expect(items).toEqual([
      'Payroll processing and payslips',
      'PAYE and UIF filed every month',
      'EMP501 recons and certificates',
      'COIDA annual compliance',
    ]);
    expect(cumulativeInclusions(['payroll'], PAYROLL_ONLY_TIER, [])).toEqual(items);
    expect(reviewInclusions(['payroll'], PAYROLL_ONLY_TIER, [])).toEqual({
      heading: 'What your Payroll subscription includes',
      items,
    });
  });

  it('the calculator asks about accounting first', () => {
    expect(calculatorFlow.FIRST_STEP).toBe('accounting');
    expect(calculatorCopy.QUESTION_COPY.accounting.title).toBe('Do you need monthly accounting services?');
  });

  it('the signed proposal speaks of payroll, not books, reports or Xero, and keeps the shared service standards', () => {
    const { ours, yours } = responsibilitiesFor(PAYROLL_ONLY_TIER);
    const all = [...ours, ...yours].join(' ');
    expect(all).not.toMatch(/books|reports|Xero|bank statements|CIPC/);
    expect(yours.join(' ')).toContain('by the agreed cut-off');
    expect(yours.join(' ')).toMatch(/new starter/);
    expect(ours).toEqual(expect.arrayContaining(RESPONSIBILITIES_OURS.filter((t) => /zjak@capucor.com|service standards|SAICA/.test(t))));
    expect(responsibilitiesFor('pro')).toEqual({ ours: RESPONSIBILITIES_OURS, yours: RESPONSIBILITIES_YOURS });
  });

  it('the payroll-only PDF carries the payroll responsibilities and the same 3-month catch-up', () => {
    const base = {
      businessName: 'Pat Co', firstName: 'Pat', lastName: 'P', tierName: 'Payroll', refNumber: null, version: 1,
      sentAt: null, expiresAt: null, firstDebitFrom: null, signedAt: null, signatureName: null, signatureMethod: null,
      signatureImage: null, signatureIp: null, inclusions: [], fairUsage: [], outOfScope: [], lineItems: [], totalChargeZAR: 750,
    };
    const html = renderProposalDocumentHtml({ ...base, tierSlug: PAYROLL_ONLY_TIER });
    expect(html).toContain('by the agreed cut-off');
    expect(html).not.toContain('Keep your books reconciled');
    expect(html).toContain('3 months before you accept');
    expect(renderProposalDocumentHtml(base)).toContain('Keep your books reconciled');
  });
});

describe('payroll-only fee note and terms (#163 follow-up)', () => {
  it('payroll-only drops the "first close" note; the accounting packages keep it unchanged', () => {
    for (const slug of ['basic', 'pro', 'premium']) {
      expect(feesNotesFor(slug)).toBe(FEES_NOTES);
    }
    expect(FEES_NOTES[0]).toBe('Billed monthly in advance. Your first close runs in the following new month.');
    const payroll = feesNotesFor(PAYROLL_ONLY_TIER);
    expect(payroll.join(' ')).not.toMatch(/close/);
    expect(payroll[0]).toMatch(/^Billed monthly in advance\./);
    expect(payroll.slice(1)).toEqual(FEES_NOTES.slice(1));
  });

  it('only payroll-only terms carry the payroll block; the accounting terms are unchanged', () => {
    expect(proposalTermsFor('pro')).toBe(PROPOSAL_TERMS);
    expect(proposalTermsFor(PAYROLL_ONLY_TIER)).toEqual([PAYROLL_ONLY_TERMS, ...PROPOSAL_TERMS]);
    expect(JSON.stringify(PROPOSAL_TERMS)).not.toContain('SimplePay');
    const text = PAYROLL_ONLY_TERMS.paragraphs.join(' ');
    expect(text).toContain('SimplePay');
    expect(text).toContain('EMP201');
    expect(text).not.toContain('—');
  });

  it('the payroll-only PDF carries the payroll fee note and block; an accounting PDF does not', () => {
    const base = {
      businessName: 'Pat Co', firstName: 'Pat', lastName: 'P', tierName: 'Payroll', refNumber: null, version: 1,
      sentAt: null, expiresAt: null, firstDebitFrom: null, signedAt: null, signatureName: null, signatureMethod: null,
      signatureImage: null, signatureIp: null, inclusions: [], fairUsage: [], outOfScope: [], lineItems: [], totalChargeZAR: 750,
    };
    const payroll = renderProposalDocumentHtml({ ...base, tierSlug: PAYROLL_ONLY_TIER });
    expect(payroll).toContain('How your payroll works');
    expect(payroll).not.toContain('first close');
    const pro = renderProposalDocumentHtml({ ...base, tierName: 'Pro', tierSlug: 'pro' });
    expect(pro).toContain('Your first close runs in the following new month.');
    expect(pro).not.toContain('How your payroll works');
  });
});

// ── Firm-wide terms (Zjak, 2026-10-26) ─────────────────────────────────────
//
// One set of shared terms for every client: no package versions of the shared
// blocks, and fair usage, records and scope speak of payroll as well as books.

describe('firm-wide shared terms (2026-10-26)', () => {
  const block = (id: string) => PROPOSAL_TERMS.find((b) => b.id === id)!.paragraphs.join(' ');

  it('every package signs the same shared blocks', () => {
    expect(proposalTermsFor(PAYROLL_ONLY_TIER).slice(1)).toEqual(PROPOSAL_TERMS);
    for (const slug of ['basic', 'pro', 'premium']) {
      expect(proposalTermsFor(slug)).toBe(PROPOSAL_TERMS);
    }
  });

  it('fair usage, records and scope cover payroll as well as accounting', () => {
    expect(block('fair-usage')).toContain('the number of employees on your payroll');
    expect(block('ownership')).toContain('financial statements, returns, payslips and reports');
    expect(block('scope-limits')).toContain('any financial statements we compile and the payroll we run');
    expect(block('scope-limits')).not.toContain('Our work is a compilation');
    expect(JSON.stringify(PROPOSAL_TERMS)).not.toContain('—');
  });
});
