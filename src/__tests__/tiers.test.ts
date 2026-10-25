import { describe, it, expect } from 'vitest';
import {
  TIER_HIGHLIGHTS,
  TIER_DISPLAY_NAMES,
  CORE_SERVICES,
  TIERS_BY_APPLICATION,
  CORE_SERVICE_LINES,
  scheduleCommonItemsFor,
  tierDisplayName,
  type TierHighlightItem,
} from '@/config/tiers';
import { RESPONSIBILITIES_OURS } from '@/config/proposalTerms';

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
  for (const item of CORE_SERVICE_LINES) {
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
      expect(first!.text).toBe('Core services included');
      expect(first!.summary).toBe(true);
      expect(second!.text).toBe(`${rhythm[t]} processing`);
      expect(second!.group).toBe('rhythm');
    }
  });

  it('no card or core item mentions Dext, and Xero only as the core software line', () => {
    const cardText = Object.values(TIER_HIGHLIGHTS)
      .flat()
      .map((i) => `${i.text} ${i.tooltip}`)
      .join(' ');
    expect(cardText).not.toMatch(/dext|xero/i);
    const coreXero = CORE_SERVICES.filter((i) => /xero/i.test(i.text)).map((i) => i.text);
    expect(coreXero).toEqual(['Xero accounting software']);
    expect(CORE_SERVICES.map((i) => `${i.text} ${i.tooltip}`).join(' ')).not.toMatch(/dext/i);
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

describe('card lines (Premium redesign "more for better", Zjak 2026-10-24)', () => {
  const ALL = new Set(['accounting', 'bookkeeping', 'payroll']);
  const card = (t: 'basic' | 'pro' | 'premium') => visibleItems(t, ALL).map((i) => i.text);

  it('basic: core, monthly processing, quarterly insights and health check, payroll', () => {
    expect(card('basic')).toEqual([
      'Core services included',
      'Monthly processing',
      'Quarterly insights report and business health check',
      'Payroll processing',
    ]);
  });

  it('pro: adds supplier bills, monthly insights and health check', () => {
    expect(card('pro')).toEqual([
      'Core services included',
      'Weekly processing',
      'Supplier bills captured and reconciled',
      'Monthly insights report and business health check',
      'Payroll processing',
    ]);
  });

  it('premium: adds the weekly KPI pulse, forecast and budget, and quarterly tax strategy', () => {
    expect(card('premium')).toEqual([
      'Core services included',
      'Daily processing',
      'Supplier bills captured and reconciled',
      'Monthly insights report and business health check',
      'Weekly KPI pulse',
      'Cash-flow forecast and budget',
      'Quarterly tax strategy',
      'Payroll processing',
    ]);
  });

  it('cards grow in the same order: only the cadence word differs on shared lines', () => {
    const shape = (t: 'basic' | 'pro' | 'premium') =>
      card(t)
        .filter((x) => x !== 'Payroll processing')
        .map((x) => x.replace(/^(Monthly|Weekly|Daily|Quarterly) /, ''));
    expect(card('basic').length).toBeLessThan(card('pro').length);
    expect(card('pro').length).toBeLessThan(card('premium').length);
    expect(shape('premium').slice(0, shape('pro').length)).toEqual(shape('pro'));
    expect(shape('basic')).toEqual(shape('pro').filter((x) => !x.startsWith('Supplier')));
  });

  it('Direct Partner Access is gone from every list (Zjak, 2026-10-24)', () => {
    const all = Object.values(TIER_HIGHLIGHTS).flat();
    expect(all.map((i) => `${i.text} ${i.tooltip} ${i.scheduleText ?? ''}`).join(' ')).not.toMatch(/partner access/i);
  });

  it('Basic has no supplier processing', () => {
    expect(TIER_HIGHLIGHTS.basic.map((i) => i.text).join(' ')).not.toMatch(/supplier/i);
  });

  it('carries the comparison-table tooltips word for word (redesign note, 2026-10-24)', () => {
    const tip = (text: string) =>
      Object.values(TIER_HIGHLIGHTS).flat().find((i) => i.text === text)?.tooltip;
    expect(tip('Supplier bills captured and reconciled')).toBe(
      'Supplier bills and receipts captured, matched to payments and checked against supplier statements.',
    );
    expect(tip('Weekly KPI pulse')).toBe(
      'A short weekly note on the handful of numbers that matter most to your business, agreed with you at the start, and what to act on this week.',
    );
    expect(tip('Cash-flow forecast and budget')).toBe(
      "An annual budget, and a 12-month cash-flow forecast updated every month, so you can see what's coming before it arrives.",
    );
    expect(tip('Quarterly tax strategy')).toBe(
      'Each quarter, a sit-down with your partner on your tax position: provisional tax estimates, year-end planning and practical steps to pay no more tax than the law requires, timed around SARS deadlines.',
    );
  });
  it('one Payroll processing line, the same on every card, covering the statutory basics only', () => {
    const payroll = (['basic', 'pro', 'premium'] as const).map((t) =>
      TIER_HIGHLIGHTS[t].filter((i) => i.services.includes('payroll'))
    );
    for (const items of payroll) {
      expect(items.map((i) => i.text)).toEqual(['Payroll processing']);
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
      // Replaced in the Premium redesign (2026-10-24)
      'Quarterly Insights Report',
      'Monthly Insights Report',
      'Weekly Insights Report',
      'Quarterly Performance Review',
      'Monthly Performance Review',
      'Weekly Performance Review',
      'Supplier Processing & Review',
      'Monthly Tax Strategy & Planning',
      'Direct Partner Access',
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

describe('CORE_SERVICES (core services included)', () => {
  it('lists the core services as rows in the comparison, worded as Zjak set them', () => {
    expect(CORE_SERVICE_LINES.map((i) => i.text)).toEqual([
      'Dedicated finance team',
      'Year-round support',
      'Annual financial statements',
      'SARS & CIPC submission',
      'Xero accounting software',
    ]);
  });

  it('states the year-round support level Zjak set (2026-10-17) on the site and the schedule', () => {
    const support = CORE_SERVICE_LINES.find((i) => i.text === 'Year-round support')!;
    const term = RESPONSIBILITIES_OURS.find((t) => t.includes('zjak@capucor.com'));
    expect(term).toBeDefined();
    for (const copy of [support.tooltip, support.scheduleText!, term!]) {
      expect(copy).not.toContain('—');
      expect(copy).toContain('zjak@capucor.com');
      expect(copy).toContain('Monday to Friday');
      expect(copy).toContain('08:00 to 17:00');
      expect(copy).toContain('2 business days');
    }
    expect(support.scheduleText).toContain('calls by appointment');
  });

  it('the engagement terms say reply times are service standards, not guarantees (Zjak, 2026-10-18)', () => {
    expect(RESPONSIBILITIES_OURS).toContain(
      'Reply times are our service standards, not guarantees. We meet them in the normal course and tell you when something will take longer.',
    );
  });

  it('puts the same core services on the signed schedule as the site, plus VAT201', () => {
    const site = CORE_SERVICE_LINES.map((i) => i.scheduleText ?? i.text);
    expect(scheduleCommonItemsFor(true).map((i) => i.text)).toEqual([...site, 'VAT returns (VAT201)']);
    expect(CORE_SERVICE_LINES.map((i) => i.text)).not.toContain('VAT returns (VAT201)');
  });

  it('repeats no core service as a tier highlight, so the schedule never drops one', () => {
    const allTierTexts = new Set(
      (['basic', 'pro', 'premium'] as const).flatMap((t) => TIER_HIGHLIGHTS[t].map((i) => i.text))
    );
    for (const item of scheduleCommonItemsFor(true)) expect(allTierTexts.has(item.text)).toBe(false);
  });

  it('says what the SARS & CIPC submission row covers and what is quoted separately', () => {
    const sars = CORE_SERVICE_LINES.find((i) => i.text === 'SARS & CIPC submission');
    expect(sars?.tooltip).toMatch(/provisional tax/);
    expect(sars?.tooltip).toMatch(/quoted separately/);
  });

  it('names the SARS and CIPC returns on the signed schedule, never an open-ended SARS promise', () => {
    const sars = scheduleCommonItemsFor(true).find((i) => i.text.startsWith('SARS & CIPC submission'));
    expect(sars?.text).toMatch(/income tax and provisional tax returns/);
    expect(sars?.text).toMatch(/CIPC annual return and beneficial ownership/);
    expect(scheduleCommonItemsFor(true).map((i) => i.text).join(' ')).not.toMatch(/—/);
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
    expect(basic).toContain('Quarterly insights report and business health check');
    expect(basic).not.toContain('Monthly processing');
    expect(basic).not.toContain('Payroll processing');

    const pro = visibleItems('pro', sel).map((i) => i.text);
    expect(pro).not.toContain('Supplier bills captured and reconciled');
    expect(pro).toContain('Monthly insights report and business health check');
  });

  it('Case 3 — bookkeeping only: shows the processing items', () => {
    const sel = new Set(['bookkeeping']);
    expect(visibleItems('basic', sel).map((i) => i.text)).toContain('Monthly processing');
    expect(visibleItems('pro', sel).map((i) => i.text)).toContain('Supplier bills captured and reconciled');
    expect(visibleItems('premium', sel).map((i) => i.text)).toContain('Daily processing');
  });

  it('Case 4 — payroll only: one Payroll processing line on every package', () => {
    const sel = new Set(['payroll']);
    for (const t of ['basic', 'pro', 'premium'] as const) {
      expect(visibleItems(t, sel).map((i) => i.text)).toEqual(['Payroll processing']);
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
    expectCoverage(['Monthly processing', 'Quarterly insights report and business health check'], true, true);
  });

  it('marks pro items as covered in pro and premium only', () => {
    expectCoverage(['Weekly processing', 'Supplier bills captured and reconciled'], false, true);
  });

  it('marks premium items as covered in premium only', () => {
    expectCoverage(
      ['Daily processing', 'Weekly KPI pulse', 'Cash-flow forecast and budget', 'Quarterly tax strategy'],
      false,
      false,
    );
  });

  it('places SARS & CIPC submission on a single common-tier row', () => {
    const sarsRows = rows.filter((r) => r.text === 'SARS & CIPC submission');
    expect(sarsRows).toHaveLength(1);
    expect(sarsRows[0].lowestTier).toBe('common');
  });

  it('places the Xero line on a single common-tier row', () => {
    const xeroRows = rows.filter((r) => r.text === 'Xero accounting software');
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

  it('places Payroll processing at lowestTier "basic", so every package covers it', () => {
    const row = rows.find((r) => r.text === 'Payroll processing');
    expect(row).toBeDefined();
    expect(row!.lowestTier).toBe('basic');
    for (const t of ['basic', 'pro', 'premium']) expect(isCovered(t, row!.lowestTier)).toBe(true);
  });

  it('contains no legacy "Payroll Included" row', () => {
    expect(rows.find((r) => r.text === 'Payroll Included')).toBeUndefined();
  });
});
