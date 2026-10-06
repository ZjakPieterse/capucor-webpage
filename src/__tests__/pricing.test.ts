import { describe, it, expect } from 'vitest';
import {
  addonTotal,
  addonsForTier,
  bracketPrice,
  addonToken,
  buildAddonLineItems,
  coreServiceError,
  foldAddonsIntoLines,
  formatBandLabel,
  mergeCoreLines,
  monthlyTotal,
  hasEnterpriseService,
  notVatRegistered,
  parseAddonToken,
  resolveAddons,
} from '@/lib/pricing';
import { formatZAR } from '@/lib/utils';

// Minimal bracket fixtures matching PDF price list
const accDormant  = { service_slug: 'accounting', ordinal: 0, basic_price: 500,  pro_price: 650,  premium_price: 1050  };
const acc0to1Mil  = { service_slug: 'accounting', ordinal: 1, basic_price: 725,  pro_price: 950,  premium_price: 1525  };
const acc5to10Mil = { service_slug: 'accounting', ordinal: 4, basic_price: 1400, pro_price: 1825, premium_price: 2950  };

const bkDormant   = { service_slug: 'bookkeeping', ordinal: 0, basic_price: 0,    pro_price: 0,    premium_price: 0     };
const bkUp50      = { service_slug: 'bookkeeping', ordinal: 1, basic_price: 850,  pro_price: 1125, premium_price: 1800  };

const payDormant  = { service_slug: 'payroll', ordinal: 0,  basic_price: 250,  pro_price: 325,  premium_price: 525   };
const pay1        = { service_slug: 'payroll', ordinal: 1,  basic_price: 450,  pro_price: 600,  premium_price: 950   };
const pay10       = { service_slug: 'payroll', ordinal: 10, basic_price: 1125, pro_price: 1475, premium_price: 2375  };

const allBrackets = [accDormant, acc0to1Mil, acc5to10Mil, bkDormant, bkUp50, payDormant, pay1, pay10];

// ─── bracketPrice ─────────────────────────────────────────────────────────────

describe('bracketPrice', () => {
  it('returns basic_price for basic tier', () => {
    expect(bracketPrice(acc0to1Mil, 'basic')).toBe(725);
  });

  it('returns pro_price for pro tier', () => {
    expect(bracketPrice(acc0to1Mil, 'pro')).toBe(950);
  });

  it('returns premium_price for premium tier', () => {
    expect(bracketPrice(acc0to1Mil, 'premium')).toBe(1525);
  });

  it('falls back to basic_price for unknown tier slug', () => {
    expect(bracketPrice(acc0to1Mil, 'unknown')).toBe(725);
  });

  it('returns 0 for dormant bookkeeping at any tier', () => {
    expect(bracketPrice(bkDormant, 'basic')).toBe(0);
    expect(bracketPrice(bkDormant, 'pro')).toBe(0);
    expect(bracketPrice(bkDormant, 'premium')).toBe(0);
  });

  it('returns correct prices for payroll: 10 employees — PDF spot-check', () => {
    expect(bracketPrice(pay10, 'basic')).toBe(1125);
    expect(bracketPrice(pay10, 'pro')).toBe(1475);
    expect(bracketPrice(pay10, 'premium')).toBe(2375);
  });
});

// ─── monthlyTotal ─────────────────────────────────────────────────────────────

describe('monthlyTotal', () => {
  it('returns accounting 0-1Mil + payroll 1emp at Pro', () => {
    const total = monthlyTotal(
      ['accounting', 'payroll'],
      { accounting: 1, payroll: 1 },
      'pro',
      allBrackets
    );
    expect(total).toBe(950 + 600); // 1550
  });

  it('returns correct total for single service at Basic', () => {
    const total = monthlyTotal(
      ['accounting'],
      { accounting: 4 },
      'basic',
      allBrackets
    );
    expect(total).toBe(1400);
  });

  it('skips enterprise brackets', () => {
    const total = monthlyTotal(
      ['accounting'],
      { accounting: 'enterprise' },
      'pro',
      allBrackets
    );
    expect(total).toBe(0);
  });

  it('includes regular and excludes enterprise in mixed selection', () => {
    const total = monthlyTotal(
      ['accounting', 'payroll'],
      { accounting: 4, payroll: 'enterprise' },
      'pro',
      allBrackets
    );
    expect(total).toBe(1825); // only accounting 5-10Mil Pro
  });

  it('returns 0 for empty service list', () => {
    expect(monthlyTotal([], {}, 'pro', allBrackets)).toBe(0);
  });

  it('returns 0 for dormant bookkeeping', () => {
    const total = monthlyTotal(
      ['bookkeeping'],
      { bookkeeping: 0 },
      'premium',
      allBrackets
    );
    expect(total).toBe(0);
  });

  it('handles three services together at Premium — spot-check', () => {
    const total = monthlyTotal(
      ['accounting', 'bookkeeping', 'payroll'],
      { accounting: 0, bookkeeping: 1, payroll: 1 },
      'premium',
      allBrackets
    );
    // Accounting Dormant Premium: 1050
    // Bookkeeping Up to 50 Premium: 1800
    // Payroll 1 Employee Premium: 950
    expect(total).toBe(1050 + 1800 + 950); // 3800
  });

  it('skips not_required selections (explicit opt-out from the scope step)', () => {
    const total = monthlyTotal(
      ['accounting', 'payroll'],
      { accounting: 4, payroll: 'not_required' },
      'pro',
      allBrackets
    );
    expect(total).toBe(1825); // only accounting 5-10Mil Pro
  });
});

// ─── add-ons ──────────────────────────────────────────────────────────────────

describe('addonTotal', () => {
  it('prices the Dext add-on at a flat R375 on Basic', () => {
    expect(addonTotal(['dext'], 'basic')).toBe(375);
  });

  it('charges nothing for Dext from Pro up (included in the package)', () => {
    expect(addonTotal(['dext'], 'pro')).toBe(0);
    expect(addonTotal(['dext'], 'premium')).toBe(0);
  });

  it('ignores unknown add-on slugs', () => {
    expect(addonTotal(['dext', 'mystery-addon'], 'basic')).toBe(375);
  });

  it('returns 0 for an empty selection', () => {
    expect(addonTotal([], 'basic')).toBe(0);
  });
});

describe('addonsForTier', () => {
  it('keeps only whitelisted, de-duplicated slugs on Basic', () => {
    expect(addonsForTier(['dext', 'dext', 'mystery-addon'], 'basic')).toEqual(['dext']);
    expect(addonsForTier([], 'basic')).toEqual([]);
  });

  it('adds Dext from Pro up even when it was not selected', () => {
    expect(addonsForTier([], 'pro')).toEqual(['dext']);
    expect(addonsForTier(['dext'], 'premium')).toEqual(['dext']);
  });
});

describe('buildAddonLineItems', () => {
  it('builds a flat-fee line for the Dext add-on on Basic', () => {
    expect(buildAddonLineItems(['dext'], 'basic')).toEqual([
      { slug: 'dext', name: 'Dext with AI Assist', label: 'Software access, you process the items', price: 375 },
    ]);
  });

  it('shows Dext as included at no charge from Pro up', () => {
    expect(buildAddonLineItems(['dext'], 'pro')).toEqual([
      { slug: 'dext', name: 'Dext with AI Assist', label: 'Included in Pro', price: 0 },
    ]);
  });

  it('skips unknown slugs and returns nothing for an empty selection', () => {
    expect(buildAddonLineItems(['mystery-addon'], 'basic')).toEqual([]);
    expect(buildAddonLineItems([], 'basic')).toEqual([]);
  });
});

// ─── hasEnterpriseService ─────────────────────────────────────────────────────

describe('hasEnterpriseService', () => {
  it('returns false when all brackets are numeric', () => {
    expect(hasEnterpriseService(['accounting', 'payroll'], { accounting: 1, payroll: 1 })).toBe(false);
  });

  it('returns true when any bracket is enterprise', () => {
    expect(hasEnterpriseService(['accounting', 'payroll'], { accounting: 1, payroll: 'enterprise' })).toBe(true);
  });

  it('returns true when all brackets are enterprise', () => {
    expect(hasEnterpriseService(['accounting'], { accounting: 'enterprise' })).toBe(true);
  });

  it('returns false for empty selection', () => {
    expect(hasEnterpriseService([], {})).toBe(false);
  });
});

// ─── formatZAR ────────────────────────────────────────────────────────────────

describe('formatZAR', () => {
  it('formats whole numbers without decimals', () => {
    expect(formatZAR(1550)).toBe('R 1,550');
  });

  it('formats decimals to 2dp', () => {
    expect(formatZAR(1527.5)).toBe('R 1,527.50');
  });

  it('handles zero', () => {
    expect(formatZAR(0)).toBe('R 0');
  });

  it('handles sub-1000 values', () => {
    expect(formatZAR(725)).toBe('R 725');
  });

  it('uses comma-thousands and period-decimal (SA accounting convention)', () => {
    expect(formatZAR(1234567.89)).toBe('R 1,234,567.89');
  });
});

// ─── calculator-v2 Phase 0 add-ons (2026-10-06) ─────────────────────────────

describe('add-on tokens', () => {
  it('reads a bare slug as a count of 1, and "slug:n" as n', () => {
    expect(parseAddonToken('dext')).toEqual({ slug: 'dext', quantity: 1 });
    expect(parseAddonToken('personal-tax:3')).toEqual({ slug: 'personal-tax', quantity: 3 });
  });

  it('treats a missing, zero, negative or fractional count as 1', () => {
    for (const t of ['personal-tax:', 'personal-tax:0', 'personal-tax:-2', 'personal-tax:1.5', 'personal-tax:x']) {
      expect(parseAddonToken(t).quantity).toBe(1);
    }
  });

  it('writes a count only for a per-unit add-on', () => {
    expect(addonToken('personal-tax', 2)).toBe('personal-tax:2');
    expect(addonToken('dext', 2)).toBe('dext');
  });

  it('caps a per-unit count at the add-on maximum and keeps the largest repeat', () => {
    const [sel] = resolveAddons(['personal-tax:2', 'personal-tax:99']);
    expect(sel!.quantity).toBe(10);
  });
});

describe('new add-on figures', () => {
  it('prices WhatsApp at R750 and Category Tracking at R1 200 a month on every package', () => {
    for (const tier of ['basic', 'pro', 'premium']) {
      expect(addonTotal(['whatsapp-support'], tier)).toBe(750);
      expect(addonTotal(['category-tracking'], tier)).toBe(1200);
    }
  });

  it('prices personal tax returns at R75 a month per person (R900 a year)', () => {
    expect(addonTotal(['personal-tax:1'], 'basic')).toBe(75);
    expect(addonTotal(['personal-tax:3'], 'pro')).toBe(225);
    expect(addonTotal(['personal-tax:3'], 'pro') * 12).toBe(3 * 900);
  });

  it('labels a per-unit line with its count', () => {
    expect(buildAddonLineItems(['personal-tax:2'], 'basic')).toEqual([
      { slug: 'personal-tax', name: 'Personal Tax Returns', label: '2 people', price: 150 },
    ]);
    expect(buildAddonLineItems(['personal-tax:1'], 'basic')[0]!.label).toBe('1 person');
  });
});

// Retired 2026-10-06: nothing adds this token any more, but proposals sent
// before then carry it and must still price and render exactly as signed.
describe('retired Xero invoicing charge (proposals sent before 2026-10-06)', () => {
  const lines = [
    { slug: 'accounting', name: 'Accounting', label: '0–1 Mil', price: 725 },
    { slug: 'bookkeeping', name: 'Bookkeeping', label: 'Up to 50', price: 450 },
  ];

  it('adds R200 on Basic and nothing from Pro up', () => {
    expect(addonTotal(['xero-invoicing'], 'basic')).toBe(200);
    expect(addonTotal(['xero-invoicing'], 'pro')).toBe(0);
    expect(addonTotal(['xero-invoicing'], 'premium')).toBe(0);
  });

  it('gets no line of its own; the Accounting line carries it, so lines still sum to the total', () => {
    const addons = ['xero-invoicing', 'dext'];
    expect(buildAddonLineItems(addons, 'basic').map((l) => l.slug)).toEqual(['dext']);
    const folded = foldAddonsIntoLines(lines, addons, 'basic');
    expect(folded[0]).toEqual({ ...lines[0], price: 925 });
    expect(folded[1]).toEqual(lines[1]);
    const sum = [...folded, ...buildAddonLineItems(addons, 'basic')].reduce((s, l) => s + l.price, 0);
    expect(sum).toBe(725 + 450 + addonTotal(addons, 'basic'));
  });

  it('does not change the lines from Pro up', () => {
    expect(foldAddonsIntoLines(lines, ['xero-invoicing'], 'pro')).toEqual(lines);
  });

  it('falls back to its own line when there is no Accounting line', () => {
    const folded = foldAddonsIntoLines([lines[1]!], ['xero-invoicing'], 'basic');
    expect(folded.map((l) => [l.slug, l.price])).toEqual([
      ['bookkeeping', 450],
      ['xero-invoicing', 200],
    ]);
  });

  it('is dropped from the stored add-ons where the package includes it', () => {
    expect(addonsForTier(['xero-invoicing'], 'basic')).toEqual(['xero-invoicing']);
    expect(addonsForTier(['xero-invoicing'], 'pro')).toEqual(['dext']);
  });

  it('is never added by the package alone', () => {
    expect(addonsForTier([], 'basic')).toEqual([]);
    expect(addonsForTier([], 'premium')).toEqual(['dext']);
  });
});

describe('not-VAT-registered scope flag', () => {
  it('is kept on every package, costs nothing and has no line', () => {
    for (const tier of ['basic', 'pro', 'premium']) {
      expect(addonsForTier(['not-vat-registered'], tier)).toContain('not-vat-registered');
      expect(addonTotal(['not-vat-registered'], tier)).toBe(0);
      expect(buildAddonLineItems(['not-vat-registered'], tier)).toEqual([]);
    }
  });

  it('is what notVatRegistered reads', () => {
    expect(notVatRegistered(['dext', 'not-vat-registered'])).toBe(true);
    expect(notVatRegistered(['dext'])).toBe(false);
  });
});

// ─── Monthly accounting: one core line on every surface ──────────────────────

describe('mergeCoreLines', () => {
  const lines = [
    { slug: 'accounting', name: 'Accounting', label: 'R1m to R2.5m', price: 1000 },
    { slug: 'bookkeeping', name: 'Bookkeeping', label: 'up to 75 transactions', price: 850.5 },
    { slug: 'payroll', name: 'Payroll', label: '3 employees', price: 450 },
  ];
  const sum = (xs: { price: number }[]) => xs.reduce((s, x) => s + x.price, 0);

  it('shows accounting and bookkeeping as one "Monthly accounting" line with the summed price', () => {
    const merged = mergeCoreLines(lines);
    expect(merged.map((l) => l.slug)).toEqual(['core', 'payroll']);
    expect(merged[0]).toEqual({
      slug: 'core',
      name: 'Monthly accounting',
      label: 'R1m to R2.5m · up to 75 transactions',
      price: 1850.5,
    });
    expect(sum(merged)).toBe(sum(lines));
  });

  it('renames a lone core line rather than showing the split', () => {
    const merged = mergeCoreLines(lines.filter((l) => l.slug !== 'bookkeeping'));
    expect(merged[0]).toMatchObject({ slug: 'core', name: 'Monthly accounting', price: 1000 });
  });

  it('leaves a selection without core alone', () => {
    const payrollOnly = lines.filter((l) => l.slug === 'payroll');
    expect(mergeCoreLines(payrollOnly)).toEqual(payrollOnly);
  });

  it('a Basic proposal sent with the retired Xero charge still totals as signed, inside the one line', () => {
    const served = [
      { slug: 'accounting', name: 'Accounting', label: 'R10m to R15m', price: 1625 },
      { slug: 'bookkeeping', name: 'Bookkeeping', label: 'up to 200 transactions', price: 2250 },
    ];
    const addons = addonsForTier(['xero-invoicing'], 'basic');
    expect(addons).toEqual(['xero-invoicing']);
    const merged = [
      ...mergeCoreLines(foldAddonsIntoLines(served, addons, 'basic')),
      ...buildAddonLineItems(addons, 'basic'),
    ];
    expect(merged).toEqual([
      { slug: 'core', name: 'Monthly accounting', label: 'R10m to R15m · up to 200 transactions', price: 4075 },
    ]);
    expect(sum(merged)).toBe(1625 + 2250 + addonTotal(addons, 'basic'));
    expect(addonTotal(addons, 'basic')).toBe(200);
  });
});

describe('formatBandLabel (F17: plain band labels, rows unchanged)', () => {
  it('formats revenue bands', () => {
    expect(formatBandLabel('accounting', '10 Mil – 15 Mil')).toBe('R10m to R15m');
    expect(formatBandLabel('accounting', '0 – 1 Mil')).toBe('R0 to R1m');
    expect(formatBandLabel('accounting', '1 Mil – 2.5 Mil')).toBe('R1m to R2.5m');
    expect(formatBandLabel('accounting', '350 Mil+')).toBe('R350m+');
    expect(formatBandLabel('accounting', 'Dormant')).toBe('Dormant');
  });

  it('formats transaction and employee bands', () => {
    expect(formatBandLabel('bookkeeping', 'Up to 200')).toBe('up to 200 transactions');
    expect(formatBandLabel('bookkeeping', 'Up to 1500')).toBe('up to 1,500 transactions');
    expect(formatBandLabel('bookkeeping', 'Dormant')).toBe('no transactions');
    expect(formatBandLabel('payroll', 'Employees: 19')).toBe('19 employees');
    expect(formatBandLabel('payroll', 'Employees: 1')).toBe('1 employee');
  });

  it('passes unrecognised labels and null through unchanged', () => {
    expect(formatBandLabel('accounting', 'Custom band')).toBe('Custom band');
    expect(formatBandLabel('payroll', 'Dormant')).toBe('Dormant');
    expect(formatBandLabel('bookkeeping', null)).toBeNull();
  });
});

describe('coreServiceError (F30: Monthly accounting is required)', () => {
  it('accepts accounting and bookkeeping with priced brackets', () => {
    expect(coreServiceError(['accounting', 'bookkeeping', 'payroll'], { accounting: 1, bookkeeping: 0, payroll: 2 })).toBeNull();
  });

  it('refuses a selection missing either core service or its bracket', () => {
    expect(coreServiceError(['accounting', 'payroll'], { accounting: 1, payroll: 2 })).toMatch(/Monthly accounting/);
    expect(coreServiceError(['payroll'], { payroll: 2 })).toMatch(/Monthly accounting/);
    expect(coreServiceError(['accounting', 'bookkeeping'], { accounting: 1 })).toMatch(/Monthly accounting/);
    expect(coreServiceError(['accounting', 'bookkeeping'], { accounting: 1, bookkeeping: 'enterprise' })).toMatch(
      /Monthly accounting/,
    );
  });
});
