import { describe, it, expect } from 'vitest';
import {
  TIER_HIGHLIGHTS,
  TIER_CUMULATIVE_LABELS,
  PACKAGE_COMMON_ITEMS,
  type TierHighlightItem,
} from '@/config/tiers';

// ─── helpers replicating Step3Tiers + TierComparison logic ──────────────────

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

  it('uses the approved "Your compliance foundation:" label for basic', () => {
    expect(TIER_CUMULATIVE_LABELS.basic).toBe('Your compliance foundation:');
  });
});

// ─── ordering + legacy absence ──────────────────────────────────────────────

describe('TIER_HIGHLIGHTS ordering', () => {
  it('basic uses the approved order (accounting+bookkeeping order, payroll last)', () => {
    expect(TIER_HIGHLIGHTS.basic.map((i) => i.text)).toEqual([
      'Annual Financial Statements',
      'SARS & CIPC Compliance',
      'VAT Reporting & Submission',
      'Xero Software Included',
      'Bookkeeping & Monthly Close',
      'Monthly Financial Reports',
      'Payroll Processing & Payslips',
      'EMP201 & EMP501 Submissions',
      'UIF Compliance',
      'COIDA Annual Submission',
    ]);
  });

  it('pro uses the approved order', () => {
    expect(TIER_HIGHLIGHTS.pro.map((i) => i.text)).toEqual([
      'Quarterly Performance Review',
      'Supplier Processing with Dext',
      'Core Business Metrics Overview',
      'Monthly 5-Min Video Walkthrough',
      'Employee Self-Service Portal',
      'Leave Management & Approvals',
    ]);
  });

  it('premium uses the approved order', () => {
    expect(TIER_HIGHLIGHTS.premium.map((i) => i.text)).toEqual([
      'Monthly Strategy Session',
      'Budget vs Actual Review',
      'Advanced KPI Dashboard',
      'Rolling Cashflow Forecast',
      'Payroll Payment File Preparation',
      'Direct Employee Payroll Support',
    ]);
  });

  it('contains no legacy package wording', () => {
    const legacy = [
      'VAT Reports & Submission',
      'Xero Business Software',
      'Monthly Bookkeeping',
      'Quarterly Reports',
      'Annual Tax Planning',
      'Weekly Processing',
      'Suppliers Processing',
      'Monthly Reports',
      'Monthly Tax Strategy',
      'Daily Processing',
      'Budget vs Actuals',
      'Live KPI Dashboard',
      'SARS and CIPC Compliance',
    ];
    const allText = (['basic', 'pro', 'premium'] as const).flatMap((t) =>
      TIER_HIGHLIGHTS[t].map((i) => i.text)
    );
    for (const phrase of legacy) {
      expect(allText).not.toContain(phrase);
    }
  });
});

// ─── service-filter cases ───────────────────────────────────────────────────

describe('service-filter behaviour', () => {
  it('Case 1 — accounting + bookkeeping: all approved non-payroll items show', () => {
    const sel = new Set(['accounting', 'bookkeeping']);
    expect(visibleItems('basic', sel).map((i) => i.text)).toEqual([
      'Annual Financial Statements',
      'SARS & CIPC Compliance',
      'VAT Reporting & Submission',
      'Xero Software Included',
      'Bookkeeping & Monthly Close',
      'Monthly Financial Reports',
    ]);
    expect(visibleItems('pro', sel).map((i) => i.text)).toEqual([
      'Quarterly Performance Review',
      'Supplier Processing with Dext',
      'Core Business Metrics Overview',
      'Monthly 5-Min Video Walkthrough',
    ]);
    expect(visibleItems('premium', sel).map((i) => i.text)).toEqual([
      'Monthly Strategy Session',
      'Budget vs Actual Review',
      'Advanced KPI Dashboard',
      'Rolling Cashflow Forecast',
    ]);
  });

  it('Case 2 — accounting only: hides bookkeeping-only items', () => {
    const sel = new Set(['accounting']);
    const basic = visibleItems('basic', sel).map((i) => i.text);
    expect(basic).toContain('Annual Financial Statements');
    expect(basic).toContain('SARS & CIPC Compliance');
    expect(basic).toContain('VAT Reporting & Submission');
    expect(basic).toContain('Monthly Financial Reports');
    expect(basic).not.toContain('Xero Software Included');
    expect(basic).not.toContain('Bookkeeping & Monthly Close');
    expect(basic).not.toContain('Payroll Processing & Payslips');
    expect(basic).not.toContain('EMP201 & EMP501 Submissions');
    expect(basic).not.toContain('UIF Compliance');
    expect(basic).not.toContain('COIDA Annual Submission');

    const pro = visibleItems('pro', sel).map((i) => i.text);
    expect(pro).not.toContain('Supplier Processing with Dext');
    expect(pro).not.toContain('Employee Self-Service Portal');
    expect(pro).not.toContain('Leave Management & Approvals');
    expect(pro).toContain('Quarterly Performance Review');

    const premium = visibleItems('premium', sel).map((i) => i.text);
    expect(premium).not.toContain('Payroll Payment File Preparation');
    expect(premium).not.toContain('Direct Employee Payroll Support');
  });

  it('Case 3 — bookkeeping only: hides accounting-only items', () => {
    const sel = new Set(['bookkeeping']);
    const basic = visibleItems('basic', sel).map((i) => i.text);
    expect(basic).toContain('Xero Software Included');
    expect(basic).toContain('Bookkeeping & Monthly Close');
    expect(basic).toContain('Monthly Financial Reports');
    expect(basic).not.toContain('Annual Financial Statements');
    expect(basic).not.toContain('SARS & CIPC Compliance');
    expect(basic).not.toContain('VAT Reporting & Submission');

    const pro = visibleItems('pro', sel).map((i) => i.text);
    expect(pro).toContain('Supplier Processing with Dext');
  });

  it('Case 4 — payroll only: shows each tier’s approved payroll items in order', () => {
    const sel = new Set(['payroll']);

    expect(visibleItems('basic', sel).map((i) => i.text)).toEqual([
      'Payroll Processing & Payslips',
      'EMP201 & EMP501 Submissions',
      'UIF Compliance',
      'COIDA Annual Submission',
    ]);

    expect(visibleItems('pro', sel).map((i) => i.text)).toEqual([
      'Employee Self-Service Portal',
      'Leave Management & Approvals',
    ]);

    expect(visibleItems('premium', sel).map((i) => i.text)).toEqual([
      'Payroll Payment File Preparation',
      'Direct Employee Payroll Support',
    ]);

    for (const t of ['basic', 'pro', 'premium'] as const) {
      const items = visibleItems(t, sel).map((i) => i.text);
      expect(items).not.toContain('Payroll Included');
      expect(items).not.toContain('Annual Financial Statements');
      expect(items).not.toContain('Bookkeeping & Monthly Close');
    }
  });
});

// ─── accumulation matrix ────────────────────────────────────────────────────

describe('TierComparison accumulation', () => {
  const sel = new Set(['accounting', 'bookkeeping']);
  const rows = buildMatrix(sel);

  it('marks every basic item as covered in basic, pro, and premium', () => {
    const basicTexts = [
      'Annual Financial Statements',
      'VAT Reporting & Submission',
      'Xero Software Included',
      'Bookkeeping & Monthly Close',
      'Monthly Financial Reports',
    ];
    for (const text of basicTexts) {
      const row = rows.find((r) => r.text === text);
      expect(row, `expected row "${text}"`).toBeDefined();
      expect(isCovered('basic', row!.lowestTier)).toBe(true);
      expect(isCovered('pro', row!.lowestTier)).toBe(true);
      expect(isCovered('premium', row!.lowestTier)).toBe(true);
    }
  });

  it('marks pro items as covered in pro and premium only', () => {
    const proTexts = [
      'Quarterly Performance Review',
      'Supplier Processing with Dext',
      'Core Business Metrics Overview',
      'Monthly 5-Min Video Walkthrough',
    ];
    for (const text of proTexts) {
      const row = rows.find((r) => r.text === text);
      expect(row, `expected row "${text}"`).toBeDefined();
      expect(isCovered('basic', row!.lowestTier)).toBe(false);
      expect(isCovered('pro', row!.lowestTier)).toBe(true);
      expect(isCovered('premium', row!.lowestTier)).toBe(true);
    }
  });

  it('marks premium items as covered in premium only', () => {
    const premiumTexts = [
      'Monthly Strategy Session',
      'Budget vs Actual Review',
      'Advanced KPI Dashboard',
      'Rolling Cashflow Forecast',
    ];
    for (const text of premiumTexts) {
      const row = rows.find((r) => r.text === text);
      expect(row, `expected row "${text}"`).toBeDefined();
      expect(isCovered('basic', row!.lowestTier)).toBe(false);
      expect(isCovered('pro', row!.lowestTier)).toBe(false);
      expect(isCovered('premium', row!.lowestTier)).toBe(true);
    }
  });

  it('deduplicates SARS & CIPC Compliance to a single common-tier row', () => {
    const sarsRows = rows.filter((r) => r.text === 'SARS & CIPC Compliance');
    expect(sarsRows).toHaveLength(1);
    expect(sarsRows[0].lowestTier).toBe('common');
  });

  it('omits all rows when no services are selected', () => {
    expect(buildMatrix(new Set()).filter((r) => r.lowestTier !== 'common')).toEqual([]);
  });
});

// ─── payroll accumulation in the comparison matrix ──────────────────────────

describe('payroll accumulation in the comparison matrix', () => {
  const sel = new Set(['payroll']);
  const rows = buildMatrix(sel);

  const basicPayrollTexts = [
    'Payroll Processing & Payslips',
    'EMP201 & EMP501 Submissions',
    'UIF Compliance',
    'COIDA Annual Submission',
  ];
  const proPayrollTexts = ['Employee Self-Service Portal', 'Leave Management & Approvals'];
  const premiumPayrollTexts = [
    'Payroll Payment File Preparation',
    'Direct Employee Payroll Support',
  ];

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
