import { describe, it, expect } from 'vitest';
import {
  addonTotal,
  bracketPrice,
  buildAddonLineItems,
  monthlyTotal,
  hasEnterpriseService,
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
  it('prices the Dext add-on at a flat R375', () => {
    expect(addonTotal(['dext'])).toBe(375);
  });

  it('ignores unknown add-on slugs', () => {
    expect(addonTotal(['dext', 'mystery-addon'])).toBe(375);
  });

  it('returns 0 for an empty selection', () => {
    expect(addonTotal([])).toBe(0);
  });
});

describe('buildAddonLineItems', () => {
  it('builds a flat-fee line for the Dext add-on', () => {
    expect(buildAddonLineItems(['dext'])).toEqual([
      { slug: 'dext', name: 'Dext Software Access', label: null, price: 375 },
    ]);
  });

  it('skips unknown slugs and returns nothing for an empty selection', () => {
    expect(buildAddonLineItems(['mystery-addon'])).toEqual([]);
    expect(buildAddonLineItems([])).toEqual([]);
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
