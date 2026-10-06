import { describe, it, expect } from 'vitest';
import {
  TIER_HIGHLIGHTS,
  TIER_CUMULATIVE_LABELS,
  TIER_DISPLAY_NAMES,
  PACKAGE_COMMON_ITEMS,
  TIER_RHYTHM_LABELS,
  TIERS_BY_APPLICATION,
  packageCommonItemsFor,
  tierDisplayName,
  type TierHighlightItem,
} from '@/config/tiers';

// ─── helpers replicating Step2Tiers + TierComparison logic ──────────────────

function visibleItems(tierSlug: 'basic' | 'pro' | 'premium', selected: Set<string>) {
  return (TIER_HIGHLIGHTS[tierSlug] ?? []).filter((i) =>
    i.services.some((s) => selected.has(s))
  );
}

type LowestTier = 'common' | 'basic' | 'pro' | 'premium';

interface MatrixRow {
  text: string;
  lowestTier: LowestTier;
}

function buildMatrix(selected: Set<string>): MatrixRow[] {
  const result: MatrixRow[] = [];
  const seen = new Set<string>();
  for (const item of PACKAGE_COMMON_ITEMS) {
    if (seen.has(item.text)) continue;
    seen.add(item.text);
    result.push({ text: item.text, lowestTier: 'common' });
  }
  const order: LowestTier[] = ['basic', 'pro', 'premium'];
  for (const tierSlug of order) {
    const highlights: TierHighlightItem[] = TIER_HIGHLIGHTS[tierSlug] ?? [];
    for (const h of highlights) {
      if (h.services.length > 0 && !h.services.some((s) => selected.has(s))) continue;
      if (seen.has(h.text)) continue;
      seen.add(h.text);
      result.push({ text: h.text, lowestTier: tierSlug });
    }
  }
  return result;
}

function isCovered(tierSlug: string, lowestTier: LowestTier): boolean {
  if (lowestTier === 'common') return true;
  const rank: Record<string, number> = { basic: 0, pro: 1, premium: 2 };
  return (rank[tierSlug] ?? 0) >= (rank[lowestTier] ?? 0);
}

// ─── cumulative labels ──────────────────────────────────────────────────────

describe('TIER_CUMULATIVE_LABELS', () => {
  it('uses the approved "Everything in Basic, plus:" label for pro', () => {
    expect(TIER_CUMULATIVE_LABELS.pro).toBe('Everything in Basic, plus:');
  });

  it('uses the approved "Everything in Pro, plus:" label for premium', () => {
    expect(TIER_CUMULATIVE_LABELS.premium).toBe('Everything in Pro, plus:');
  });

  it('labels Basic as building on the core services (calculator-v2)', () => {
    expect(TIER_CUMULATIVE_LABELS.basic).toBe('On top of the core services:');
  });
});

// ─── rhythm and application (calculator-v2 Phase 0) ─────────────────────────

describe('package rhythm and Premium by application', () => {
  it('names each package by its processing rhythm', () => {
    expect(TIER_RHYTHM_LABELS).toEqual({
      basic: 'Monthly rhythm',
      pro: 'Weekly rhythm',
      premium: 'Daily rhythm',
    });
  });

  it('sells Premium, and only Premium, by application', () => {
    expect([...TIERS_BY_APPLICATION]).toEqual(['premium']);
  });
});

// ─── display names ──────────────────────────────────────────────────────────

describe('tierDisplayName', () => {
  it('maps each known slug to its display name', () => {
    expect(tierDisplayName('basic')).toBe('Basic');
    expect(tierDisplayName('pro')).toBe('Pro');
    expect(tierDisplayName('premium')).toBe('Premium');
  });

  it('matches the TIER_DISPLAY_NAMES map for known slugs', () => {
    for (const [slug, name] of Object.entries(TIER_DISPLAY_NAMES)) {
      expect(tierDisplayName(slug)).toBe(name);
    }
  });

  it('title-cases an unknown slug as a fallback', () => {
    expect(tierDisplayName('enterprise-plus')).toBe('Enterprise Plus');
  });
});

// ─── ordering + legacy absence ──────────────────────────────────────────────

describe('TIER_HIGHLIGHTS ordering (calculator-v2 Phase 0 inclusions)', () => {
  it('basic: monthly rhythm, basic reports, quarterly review, then payroll', () => {
    expect(TIER_HIGHLIGHTS.basic.map((i) => i.text)).toEqual([
      'Transactions processed monthly',
      'Basic monthly reports',
      'Quarterly performance review',
      'Payroll processing & payslips',
      'COIDA annual submission',
    ]);
  });

  it('pro: weekly rhythm, monthly review, richer reports, supplier processing, Dext', () => {
    expect(TIER_HIGHLIGHTS.pro.map((i) => i.text)).toEqual([
      'Transactions processed weekly',
      'Monthly performance review',
      'Monthly insights report',
      'Monthly 5-min video explainer',
      'Supplier processing & review',
      'Dext with AI Assist included',
      'Employee self-service portal',
    ]);
  });

  it('premium: daily rhythm, weekly review, planning, on-call partner, budget vs actual', () => {
    expect(TIER_HIGHLIGHTS.premium.map((i) => i.text)).toEqual([
      'Transactions processed daily',
      'Weekly reports & review',
      'Monthly tax & financial planning',
      'On-call partner support',
      'Budget vs actual reporting',
      'Payroll payment files prepared',
    ]);
  });

  it('Basic has no supplier processing', () => {
    expect(TIER_HIGHLIGHTS.basic.map((i) => i.text).join(' ')).not.toMatch(/supplier/i);
  });

  it('on-call partner support promises a same-day reply', () => {
    const item = TIER_HIGHLIGHTS.premium.find((i) => i.text === 'On-call partner support');
    expect(item!.tooltip).toMatch(/same business day/);
  });

  it('merged EMP/UIF wording lives in the Payroll Processing tooltip', () => {
    const payrollItem = TIER_HIGHLIGHTS.basic.find(
      (i) => i.text === 'Payroll processing & payslips'
    );
    expect(payrollItem).toBeDefined();
    expect(payrollItem!.tooltip).toContain('EMP201');
    expect(payrollItem!.tooltip).toContain('UIF');
  });

  it('contains no legacy or dropped package wording', () => {
    const legacy = [
      'VAT Reports & Submission',
      'Xero Business Software',
      'Monthly Bookkeeping',
      'Quarterly Reports',
      'Annual Tax Planning',
      'Suppliers Processing',
      'Monthly Reports',
      'Monthly Tax Strategy',
      'Budget vs Actuals',
      'Live KPI Dashboard',
      'SARS and CIPC Compliance',
      'Monthly Financial Reports',
      'Supplier Processing with Dext',
      'Core Business Metrics Overview',
      'Monthly 5-Min Video Walkthrough',
      'EMP & UIF Compliance',
      'Leave Management & Approvals',
      'Budget vs Actual Review',
      'Rolling Cashflow Forecast',
      'Payroll Payment File Preparation',
      'Direct Employee Payroll Support',
      'Monthly 5min Video Walkthrough',
      // Dropped from Premium or replaced in calculator-v2 Phase 0 (2026-10-06)
      'Advanced KPI Dashboard',
      'Benchmark Analysis',
      'Monthly Strategy Session',
      'Quarterly Review Meeting',
      'Accounts Payable Management',
      'Core Monthly Financials',
    ];
    const allText = (['basic', 'pro', 'premium'] as const).flatMap((t) =>
      TIER_HIGHLIGHTS[t].map((i) => i.text)
    );
    for (const phrase of legacy) {
      expect(allText).not.toContain(phrase);
    }
  });
});

// ─── common items ───────────────────────────────────────────────────────────

describe('PACKAGE_COMMON_ITEMS (core services included)', () => {
  it('uses "Year-round Support" (not the retired "Year-round Advisory")', () => {
    const texts = PACKAGE_COMMON_ITEMS.map((i) => i.text);
    expect(texts).toContain('Year-round support');
    expect(texts).not.toContain('Year-round Advisory');
  });

  it('lists the approved core services, none of them repeated as a tier highlight', () => {
    expect(PACKAGE_COMMON_ITEMS.map((i) => i.text)).toEqual([
      'Your own accountant',
      'Xero software included',
      'SARS & CIPC compliance',
      'Annual financial statements',
      'VAT returns (VAT201)',
      'Bookkeeping & monthly close',
      'Year-round support',
    ]);
    const allTierTexts = new Set(
      (['basic', 'pro', 'premium'] as const).flatMap((t) => TIER_HIGHLIGHTS[t].map((i) => i.text))
    );
    for (const item of PACKAGE_COMMON_ITEMS) expect(allTierTexts.has(item.text)).toBe(false);
  });

  it('hides only VAT201 for a business that is not VAT-registered', () => {
    const all = packageCommonItemsFor(true).map((i) => i.text);
    const noVat = packageCommonItemsFor(false).map((i) => i.text);
    expect(all).toContain('VAT returns (VAT201)');
    expect(noVat).toEqual(all.filter((t) => t !== 'VAT returns (VAT201)'));
  });
});

// ─── service-filter cases ───────────────────────────────────────────────────

describe('service-filter behaviour', () => {
  it('Case 1 — core (accounting + bookkeeping): every non-payroll item shows', () => {
    const sel = new Set(['accounting', 'bookkeeping']);
    for (const t of ['basic', 'pro', 'premium'] as const) {
      expect(visibleItems(t, sel).map((i) => i.text)).toEqual(
        TIER_HIGHLIGHTS[t].filter((i) => !i.services.includes('payroll')).map((i) => i.text)
      );
    }
  });

  it('Case 2 — accounting only: hides bookkeeping-only items', () => {
    const sel = new Set(['accounting']);
    const basic = visibleItems('basic', sel).map((i) => i.text);
    expect(basic).toContain('Basic monthly reports');
    expect(basic).not.toContain('Transactions processed monthly');
    expect(basic).not.toContain('Payroll processing & payslips');

    const pro = visibleItems('pro', sel).map((i) => i.text);
    expect(pro).not.toContain('Supplier processing & review');
    expect(pro).not.toContain('Employee self-service portal');
    expect(pro).toContain('Monthly performance review');
  });

  it('Case 3 — bookkeeping only: shows the processing rhythm items', () => {
    const sel = new Set(['bookkeeping']);
    expect(visibleItems('basic', sel).map((i) => i.text)).toContain('Transactions processed monthly');
    expect(visibleItems('pro', sel).map((i) => i.text)).toContain('Supplier processing & review');
    expect(visibleItems('premium', sel).map((i) => i.text)).toContain('Transactions processed daily');
  });

  it('Case 4 — payroll only: shows each tier’s approved payroll items in order', () => {
    const sel = new Set(['payroll']);

    expect(visibleItems('basic', sel).map((i) => i.text)).toEqual([
      'Payroll processing & payslips',
      'COIDA annual submission',
    ]);

    expect(visibleItems('pro', sel).map((i) => i.text)).toEqual([
      'Employee self-service portal',
    ]);

    expect(visibleItems('premium', sel).map((i) => i.text)).toEqual([
      'Payroll payment files prepared',
    ]);

    for (const t of ['basic', 'pro', 'premium'] as const) {
      const items = visibleItems(t, sel).map((i) => i.text);
      expect(items).not.toContain('Payroll Included');
      expect(items).not.toContain('Transactions processed monthly');
    }
  });
});

// ─── accumulation matrix ────────────────────────────────────────────────────

describe('TierComparison accumulation', () => {
  const sel = new Set(['accounting', 'bookkeeping']);
  const rows = buildMatrix(sel);

  const expectCoverage = (texts: string[], basic: boolean, pro: boolean) => {
    for (const text of texts) {
      const row = rows.find((r) => r.text === text);
      expect(row, `expected row "${text}"`).toBeDefined();
      expect(isCovered('basic', row!.lowestTier)).toBe(basic);
      expect(isCovered('pro', row!.lowestTier)).toBe(pro);
      expect(isCovered('premium', row!.lowestTier)).toBe(true);
    }
  };

  it('marks every basic item as covered in basic, pro, and premium', () => {
    expectCoverage(['Transactions processed monthly', 'Basic monthly reports', 'Quarterly performance review'], true, true);
  });

  it('marks pro items as covered in pro and premium only', () => {
    expectCoverage(
      ['Transactions processed weekly', 'Monthly performance review', 'Supplier processing & review', 'Dext with AI Assist included'],
      false,
      true,
    );
  });

  it('marks premium items as covered in premium only', () => {
    expectCoverage(
      ['Transactions processed daily', 'Weekly reports & review', 'Monthly tax & financial planning', 'On-call partner support', 'Budget vs actual reporting'],
      false,
      false,
    );
  });

  it('places SARS & CIPC Compliance on a single common-tier row', () => {
    const sarsRows = rows.filter((r) => r.text === 'SARS & CIPC compliance');
    expect(sarsRows).toHaveLength(1);
    expect(sarsRows[0].lowestTier).toBe('common');
  });

  it('places Xero Software Included on a single common-tier row', () => {
    const xeroRows = rows.filter((r) => r.text === 'Xero software included');
    expect(xeroRows).toHaveLength(1);
    expect(xeroRows[0].lowestTier).toBe('common');
  });

  it('omits all rows when no services are selected', () => {
    expect(buildMatrix(new Set()).filter((r) => r.lowestTier !== 'common')).toEqual([]);
  });
});

// ─── payroll accumulation in the comparison matrix ──────────────────────────

describe('payroll accumulation in the comparison matrix', () => {
  const sel = new Set(['payroll']);
  const rows = buildMatrix(sel);

  const basicPayrollTexts = ['Payroll processing & payslips', 'COIDA annual submission'];
  const proPayrollTexts = ['Employee self-service portal'];
  const premiumPayrollTexts = ['Payroll payment files prepared'];

  it('places basic payroll items at lowestTier "basic" and covers them in all three tiers', () => {
    for (const text of basicPayrollTexts) {
      const row = rows.find((r) => r.text === text);
      expect(row, `expected row "${text}"`).toBeDefined();
      expect(row!.lowestTier).toBe('basic');
      expect(isCovered('basic', row!.lowestTier)).toBe(true);
      expect(isCovered('pro', row!.lowestTier)).toBe(true);
      expect(isCovered('premium', row!.lowestTier)).toBe(true);
    }
  });

  it('places pro payroll items at lowestTier "pro" and covers them in pro and premium only', () => {
    for (const text of proPayrollTexts) {
      const row = rows.find((r) => r.text === text);
      expect(row, `expected row "${text}"`).toBeDefined();
      expect(row!.lowestTier).toBe('pro');
      expect(isCovered('basic', row!.lowestTier)).toBe(false);
      expect(isCovered('pro', row!.lowestTier)).toBe(true);
      expect(isCovered('premium', row!.lowestTier)).toBe(true);
    }
  });

  it('places premium payroll items at lowestTier "premium" and covers them in premium only', () => {
    for (const text of premiumPayrollTexts) {
      const row = rows.find((r) => r.text === text);
      expect(row, `expected row "${text}"`).toBeDefined();
      expect(row!.lowestTier).toBe('premium');
      expect(isCovered('basic', row!.lowestTier)).toBe(false);
      expect(isCovered('pro', row!.lowestTier)).toBe(false);
      expect(isCovered('premium', row!.lowestTier)).toBe(true);
    }
  });

  it('contains no legacy "Payroll Included" row', () => {
    expect(rows.find((r) => r.text === 'Payroll Included')).toBeUndefined();
  });
});
