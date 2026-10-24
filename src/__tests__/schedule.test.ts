import { describe, it, expect } from 'vitest';
import { buildFairUsage, cumulativeInclusions, reviewInclusions } from '@/lib/schedule';
import { CORE_SERVICES, CORE_SERVICE_LINES, TIER_HIGHLIGHTS, TIER_ORDER } from '@/config/tiers';

// The proposal's Schedule of Services (signing page and signed PDF) follows the
// calculator-v2 Phase 0 rules: VAT201 only for a VAT-registered business, and a
// Basic bookkeeping allowance that does not count supplier bills.

const CORE = ['accounting', 'bookkeeping'];

describe('cumulativeInclusions', () => {
  it('lists VAT201 by default, so proposals stored before the VAT flag are unchanged', () => {
    expect(cumulativeInclusions(CORE, 'basic')).toContain('VAT returns (VAT201)');
    expect(cumulativeInclusions(CORE, 'basic', ['dext'])).toContain('VAT returns (VAT201)');
  });

  it('drops VAT201, and nothing else, when the proposal carries the not-VAT-registered flag', () => {
    const withVat = cumulativeInclusions(CORE, 'pro', ['dext']);
    const noVat = cumulativeInclusions(CORE, 'pro', ['dext', 'not-vat-registered']);
    expect(noVat).toEqual(withVat.filter((t) => t !== 'VAT returns (VAT201)'));
  });

  it('accumulates up the packages: Premium carries Pro and Basic items', () => {
    const premium = cumulativeInclusions(CORE, 'premium');
    expect(premium.filter((t) => t === 'Supplier bills captured and reconciled')).toHaveLength(1);
    expect(premium.join(' ')).not.toMatch(/partner access/i);
    for (const item of ['Weekly KPI pulse', 'Cash-flow forecast and budget', 'Quarterly tax strategy']) {
      expect(premium).toContain(item);
      expect(cumulativeInclusions(CORE, 'pro')).not.toContain(item);
    }
    expect(cumulativeInclusions(CORE, 'basic')).not.toContain('Supplier bills captured and reconciled');
  });

  it('keeps one rhythm and one insights report per schedule: the highest package wins', () => {
    const premium = cumulativeInclusions(CORE, 'premium');
    expect(premium.filter((t) => / processing$/.test(t))).toEqual(['Daily processing']);
    expect(premium.filter((t) => t.includes('insights report'))).toEqual([
      'Monthly insights report and business health check',
    ]);
    const pro = cumulativeInclusions(CORE, 'pro');
    expect(pro).toContain('Monthly insights report and business health check');
    expect(pro).not.toContain('Quarterly insights report and business health check');
    expect(pro).toContain('Weekly processing');
    expect(pro).not.toContain('Monthly processing');
    expect([...premium, ...pro].join(' ')).not.toMatch(/performance review/i);
  });

  it('lists the five core services as the site names them, plus VAT201 for a VAT-registered business', () => {
    const basic = cumulativeInclusions(CORE, 'basic');
    expect(basic.slice(0, 6)).toEqual([
      'Dedicated finance team',
      'Year-round support (email to zjak@capucor.com, Monday to Friday 08:00 to 17:00, reply within 2 business days; calls by appointment)',
      'Annual financial statements',
      'SARS & CIPC submission (income tax and provisional tax returns, CIPC annual return and beneficial ownership filing)',
      'Xero accounting software',
      'VAT returns (VAT201)',
    ]);
    expect(cumulativeInclusions(['payroll', ...CORE], 'basic')).toContain('Payroll processing');
    // Payroll last on every signed schedule, as on the cards (2026-10-24).
    for (const tier of TIER_ORDER) {
      expect(cumulativeInclusions(['payroll', ...CORE], tier).at(-1)).toBe('Payroll processing');
    }
  });

  it('leaves out the card summary line and never mentions Dext', () => {
    for (const tier of ['basic', 'pro', 'premium']) {
      const items = cumulativeInclusions(CORE, tier);
      expect(items).not.toContain('Core services included');
      expect(items.join(' ')).not.toMatch(/dext/i);
    }
  });
});

describe('buildFairUsage', () => {
  const brackets = [{ service_slug: 'bookkeeping', ordinal: 3, label: 'Up to 100' }];

  it('counts all transactions on every package, with one wording (decision 2026-10-06)', () => {
    const allowances = ['basic', 'pro', 'premium', undefined].map(
      (tier) => buildFairUsage(['bookkeeping'], { bookkeeping: 3 }, brackets, tier)[0]!.allowance,
    );
    expect(new Set(allowances).size).toBe(1);
    expect(allowances[0]).toMatch(/bank line, invoice, supplier bill and journal/);
    expect(allowances[0]).not.toMatch(/Basic/);
  });

  it('shows the band label in plain form (F17)', () => {
    const [line] = buildFairUsage(['bookkeeping'], { bookkeeping: 3 }, brackets, 'basic');
    expect(line!.bracketLabel).toBe('up to 100 transactions');
  });
});

// The review's "What your <package> subscription includes" card (Zjak,
// 2026-10-18): the signed schedule's items in the comparison table's short
// wording, so the card, the table and the contract never name different things.
describe('reviewInclusions', () => {
  const VAT_NO = ['not-vat-registered'];
  const WITH_PAYROLL = ['payroll', ...CORE];

  it('lists the short wording of exactly the schedule items', () => {
    const short = (t: string) =>
      [...CORE_SERVICES, ...Object.values(TIER_HIGHLIGHTS).flat()].find((i) => (i.scheduleText ?? i.text) === t)?.text ?? t;
    for (const tier of TIER_ORDER) {
      for (const addons of [[], VAT_NO]) {
        for (const services of [CORE, WITH_PAYROLL]) {
          expect([...reviewInclusions(services, tier, addons).items].sort()).toEqual(
            cumulativeInclusions(services, tier, addons).map(short).sort(),
          );
        }
      }
    }
  });

  it('takes every item from the comparison table rows, plus VAT201 for a VAT-registered business', () => {
    const rows = new Set([...CORE_SERVICE_LINES, ...Object.values(TIER_HIGHLIGHTS).flat()].map((i) => i.text));
    for (const tier of TIER_ORDER) {
      for (const item of reviewInclusions(WITH_PAYROLL, tier).items) {
        expect(rows.has(item) || item === 'VAT returns (VAT201)').toBe(true);
      }
    }
    expect(reviewInclusions(CORE, 'pro').items.slice(0, CORE_SERVICE_LINES.length)).toEqual(
      CORE_SERVICE_LINES.map((i) => i.text),
    );
  });

  it('shows VAT201 only for a VAT-registered business', () => {
    expect(reviewInclusions(CORE, 'basic').items).toContain('VAT returns (VAT201)');
    for (const tier of TIER_ORDER) {
      expect(reviewInclusions(CORE, tier, VAT_NO).items).not.toContain('VAT returns (VAT201)');
    }
  });

  it("keeps one rhythm and one report: the package's own, never a lower one beside it", () => {
    const pro = reviewInclusions(CORE, 'pro').items;
    expect(pro).toContain('Weekly processing');
    expect(pro).toContain('Monthly insights report and business health check');
    expect(pro).not.toContain('Monthly processing');
    expect(pro).not.toContain('Quarterly insights report and business health check');
    const premium = reviewInclusions(CORE, 'premium').items;
    expect(premium.filter((t) => / processing$/.test(t))).toEqual(['Daily processing']);
    expect(premium).not.toContain('Direct Partner Access');
    expect(premium).not.toContain('Core services included');
  });

  it('lists payroll only when payroll is chosen, and never an add-on', () => {
    for (const tier of TIER_ORDER) {
      expect(reviewInclusions(CORE, tier).items).not.toContain('Payroll processing');
      expect(reviewInclusions(WITH_PAYROLL, tier).items.at(-1)).toBe('Payroll processing');
      expect(reviewInclusions(CORE, tier, ['whatsapp-support', 'personal-tax:2']).items).toEqual(
        reviewInclusions(CORE, tier).items,
      );
    }
  });

  it('names the package in the heading', () => {
    expect(reviewInclusions(CORE, 'basic').heading).toBe('What your Basic subscription includes');
    expect(reviewInclusions(CORE, 'pro').heading).toBe('What your Pro subscription includes');
    expect(reviewInclusions(CORE, 'premium').heading).toBe('What your Premium subscription includes');
  });
});
