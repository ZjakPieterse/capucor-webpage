import { describe, it, expect } from 'vitest';
import { buildFairUsage, cumulativeInclusions } from '@/lib/schedule';

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
    expect(premium).toContain('Monthly 5-Minute Video Explainer');
    expect(premium).toContain('Supplier Processing & Review');
    expect(premium).toContain('On-Call Partner Support');
    expect(cumulativeInclusions(CORE, 'basic')).not.toContain('Supplier Processing & Review');
  });

  it('keeps one rhythm, report and review per schedule: the highest package wins', () => {
    const premium = cumulativeInclusions(CORE, 'premium');
    expect(premium.filter((t) => t.startsWith('Processing Rhythm'))).toEqual(['Processing Rhythm: Daily']);
    expect(premium).not.toContain('Quarterly Performance Review');
    expect(premium).not.toContain('Monthly Performance Review');
    expect(premium).toContain('Weekly Reports & Review');
    const pro = cumulativeInclusions(CORE, 'pro');
    expect(pro).toContain('Monthly Insights Report');
    expect(pro).not.toContain('Monthly Basic Reports');
    expect(pro.filter((t) => t.startsWith('Processing Rhythm'))).toEqual(['Processing Rhythm: Weekly']);
  });

  it('leaves out the card summary line and never mentions Dext', () => {
    for (const tier of ['basic', 'pro', 'premium']) {
      const items = cumulativeInclusions(CORE, tier);
      expect(items).not.toContain('Core Services Included');
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
