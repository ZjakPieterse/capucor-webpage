import { describe, it, expect } from 'vitest';
import { buildFairUsage, cumulativeInclusions } from '@/lib/schedule';

// The proposal's Schedule of Services (signing page and signed PDF) follows the
// calculator-v2 Phase 0 rules: VAT201 only for a VAT-registered business, and a
// Basic bookkeeping allowance that does not count supplier bills.

const CORE = ['accounting', 'bookkeeping'];

describe('cumulativeInclusions', () => {
  it('lists VAT201 by default, so proposals stored before the VAT flag are unchanged', () => {
    expect(cumulativeInclusions(CORE, 'basic')).toContain('VAT Returns (VAT201)');
    expect(cumulativeInclusions(CORE, 'basic', ['dext'])).toContain('VAT Returns (VAT201)');
  });

  it('drops VAT201, and nothing else, when the proposal carries the not-VAT-registered flag', () => {
    const withVat = cumulativeInclusions(CORE, 'pro', ['dext']);
    const noVat = cumulativeInclusions(CORE, 'pro', ['dext', 'not-vat-registered']);
    expect(noVat).toEqual(withVat.filter((t) => t !== 'VAT Returns (VAT201)'));
  });

  it('accumulates up the packages: Premium carries Pro and Basic items', () => {
    const premium = cumulativeInclusions(CORE, 'premium');
    expect(premium).toContain('Quarterly Performance Review');
    expect(premium).toContain('Supplier Processing & Review');
    expect(premium).toContain('On-call Partner Support');
    expect(cumulativeInclusions(CORE, 'basic')).not.toContain('Supplier Processing & Review');
  });
});

describe('buildFairUsage', () => {
  const brackets = [{ service_slug: 'bookkeeping', ordinal: 3, label: 'Up to 100' }];

  it('counts bank lines and journals only on Basic', () => {
    const [line] = buildFairUsage(['bookkeeping'], { bookkeeping: 3 }, brackets, 'basic');
    expect(line!.allowance).toMatch(/bank lines and journals/);
    expect(line!.allowance).not.toMatch(/bills/);
    expect(line!.bracketLabel).toBe('Up to 100');
  });

  it('counts supplier bills from Pro, and when no package is given', () => {
    for (const tier of ['pro', 'premium', undefined]) {
      const [line] = buildFairUsage(['bookkeeping'], { bookkeeping: 3 }, brackets, tier);
      expect(line!.allowance).toMatch(/invoices, bills and journals/);
    }
  });
});
