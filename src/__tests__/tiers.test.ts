import { describe, it, expect } from 'vitest';
import {
  TIER_HIGHLIGHTS,
  TIER_DISPLAY_NAMES,
  PACKAGE_COMMON_ITEMS,
  TIERS_BY_APPLICATION,
  packageCommonItemsFor,
  scheduleCommonItemsFor,
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
  for (const item of packageCommonItemsFor(true)) {
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

// ─── card structure and Premium by application ──────────────────────────────

describe('package cards (package simplification, 2026-10-06)', () => {
  it('every card opens with the core services and its processing rhythm', () => {
    const rhythm = { basic: 'Monthly', pro: 'Weekly', premium: 'Daily' } as const;
    for (const t of ['basic', 'pro', 'premium'] as const) {
      const [first, second] = TIER_HIGHLIGHTS[t];
      expect(first!.text).toBe('Core Services Included');
      expect(first!.summary).toBe(true);
      expect(second!.text).toBe(`${rhythm[t]} Processing`);
      expect(second!.group).toBe('rhythm');
    }
  });

  it('no card or core item mentions Dext, and Xero only as the core software line', () => {
    const cardText = Object.values(TIER_HIGHLIGHTS)
      .flat()
      .map((i) => `${i.text} ${i.tooltip}`)
      .join(' ');
    expect(cardText).not.toMatch(/dext|xero/i);
    const coreXero = PACKAGE_COMMON_ITEMS.filter((i) => /xero/i.test(i.text)).map((i) => i.text);
    expect(coreXero).toEqual(['Xero Accounting Software']);
    expect(PACKAGE_COMMON_ITEMS.map((i) => `${i.text} ${i.tooltip}`).join(' ')).not.toMatch(/dext/i);
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

describe('TIER_HIGHLIGHTS ordering (package simplification lists)', () => {
  it('basic: core, monthly processing, quarterly report and review, then payroll', () => {
    expect(TIER_HIGHLIGHTS.basic.map((i) => i.text)).toEqual([
      'Core Services Included',
      'Monthly Processing',
      'Quarterly Insights Report',
      'Quarterly Performance Review',
      'Payroll Services',
    ]);
  });

  it('pro: core, weekly processing, monthly report and review, supplier processing, payroll', () => {
    expect(TIER_HIGHLIGHTS.pro.map((i) => i.text)).toEqual([
      'Core Services Included',
      'Weekly Processing',
      'Monthly Insights Report',
      'Monthly Performance Review',
      'Supplier Processing & Review',
      'Payroll Services',
    ]);
  });

  it('premium: core, daily processing, weekly report and review, supplier processing, planning, partner, payroll', () => {
    expect(TIER_HIGHLIGHTS.premium.map((i) => i.text)).toEqual([
      'Core Services Included',
      'Daily Processing',
      'Weekly Insights Report',
      'Weekly Performance Review',
      'Supplier Processing & Review',
      'Monthly Tax Strategy & Planning',
      'On-call Partner Support',
      'Payroll Services',
    ]);
  });

  it('Basic has no supplier processing', () => {
    expect(TIER_HIGHLIGHTS.basic.map((i) => i.text).join(' ')).not.toMatch(/supplier/i);
  });

  it('on-call partner support promises a same-day reply', () => {
    const item = TIER_HIGHLIGHTS.premium.find((i) => i.text === 'On-call Partner Support');
    expect(item!.tooltip).toMatch(/same business day/);
  });

  it('one Payroll Services line, the same on every card, covering the statutory basics only', () => {
    const payroll = (['basic', 'pro', 'premium'] as const).map((t) =>
      TIER_HIGHLIGHTS[t].filter((i) => i.services.includes('payroll'))
    );
    for (const items of payroll) {
      expect(items.map((i) => i.text)).toEqual(['Payroll Services']);
      expect(items[0]).toBe(payroll[0]![0]);
    }
    const tooltip = payroll[0]![0]!.tooltip;
    for (const word of ['payslips', 'EMP201', 'EMP501', 'UIF', 'COIDA']) expect(tooltip).toContain(word);
    expect(tooltip).not.toMatch(/portal|payment file/i);
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
      // Replaced in tweaks round 1 (2026-10-06)
      'Dext with AI Assist included',
      'Transactions processed monthly',
      // Replaced in the package simplification (2026-10-06)
      'Processing Rhythm: Monthly',
      'Processing Rhythm: Weekly',
      'Processing Rhythm: Daily',
      'Monthly Basic Reports',
      'Monthly 5-Minute Video Explainer',
      'Weekly Reports & Review',
      'Monthly Tax & Financial Planning',
      'Budget vs Actual Reporting',
      'Payroll Processing & Payslips',
      'COIDA Annual Submission',
      'Employee Self-Service Portal',
      'Payroll Payment Files Prepared',
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
  it('shows the five approved core services, none of them repeated as a tier highlight', () => {
    expect(packageCommonItemsFor(true).map((i) => i.text)).toEqual([
      'Dedicated Finance Team',
      'Annual Financials',
      'SARS & CIPC Submission',
      'Xero Accounting Software',
      'Year-round Support',
    ]);
    const allTierTexts = new Set(
      (['basic', 'pro', 'premium'] as const).flatMap((t) => TIER_HIGHLIGHTS[t].map((i) => i.text))
    );
    for (const item of PACKAGE_COMMON_ITEMS) expect(allTierTexts.has(item.text)).toBe(false);
  });

  it('shows the same five whether or not the business is VAT-registered', () => {
    expect(packageCommonItemsFor(false)).toEqual(packageCommonItemsFor(true));
  });

  it('names VAT201 on the schedule only, and only for a VAT-registered business', () => {
    const all = scheduleCommonItemsFor(true).map((i) => i.text);
    const noVat = scheduleCommonItemsFor(false).map((i) => i.text);
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
    expect(basic).toContain('Quarterly Insights Report');
    expect(basic).not.toContain('Monthly Processing');
    expect(basic).not.toContain('Payroll Services');

    const pro = visibleItems('pro', sel).map((i) => i.text);
    expect(pro).not.toContain('Supplier Processing & Review');
    expect(pro).toContain('Monthly Performance Review');
  });

  it('Case 3 — bookkeeping only: shows the processing items', () => {
    const sel = new Set(['bookkeeping']);
    expect(visibleItems('basic', sel).map((i) => i.text)).toContain('Monthly Processing');
    expect(visibleItems('pro', sel).map((i) => i.text)).toContain('Supplier Processing & Review');
    expect(visibleItems('premium', sel).map((i) => i.text)).toContain('Daily Processing');
  });

  it('Case 4 — payroll only: one Payroll Services line on every package', () => {
    const sel = new Set(['payroll']);
    for (const t of ['basic', 'pro', 'premium'] as const) {
      expect(visibleItems(t, sel).map((i) => i.text)).toEqual(['Payroll Services']);
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
    expectCoverage(['Monthly Processing', 'Quarterly Insights Report', 'Quarterly Performance Review'], true, true);
  });

  it('marks pro items as covered in pro and premium only', () => {
    expectCoverage(['Weekly Processing', 'Monthly Performance Review', 'Supplier Processing & Review'], false, true);
  });

  it('marks premium items as covered in premium only', () => {
    expectCoverage(
      ['Daily Processing', 'Weekly Performance Review', 'Monthly Tax Strategy & Planning', 'On-call Partner Support'],
      false,
      false,
    );
  });

  it('places SARS & CIPC Submission on a single common-tier row', () => {
    const sarsRows = rows.filter((r) => r.text === 'SARS & CIPC Submission');
    expect(sarsRows).toHaveLength(1);
    expect(sarsRows[0].lowestTier).toBe('common');
  });

  it('places Xero Accounting Software on a single common-tier row', () => {
    const xeroRows = rows.filter((r) => r.text === 'Xero Accounting Software');
    expect(xeroRows).toHaveLength(1);
    expect(xeroRows[0].lowestTier).toBe('common');
  });

  it('omits all rows when no services are selected', () => {
    expect(buildMatrix(new Set()).filter((r) => r.lowestTier !== 'common')).toEqual([]);
  });
});

// ─── payroll in the comparison matrix ───────────────────────────────────────

describe('payroll in the comparison matrix', () => {
  const rows = buildMatrix(new Set(['payroll']));

  it('places Payroll Services at lowestTier "basic", so every package covers it', () => {
    const row = rows.find((r) => r.text === 'Payroll Services');
    expect(row).toBeDefined();
    expect(row!.lowestTier).toBe('basic');
    for (const t of ['basic', 'pro', 'premium']) expect(isCovered(t, row!.lowestTier)).toBe(true);
  });

  it('contains no legacy "Payroll Included" row', () => {
    expect(rows.find((r) => r.text === 'Payroll Included')).toBeUndefined();
  });
});
