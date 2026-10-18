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
    expect(premium.filter((t) => t === 'Supplier Processing & Review')).toHaveLength(1);
    expect(premium.filter((t) => t.startsWith('Direct Partner Access'))).toEqual([
      'Direct Partner Access (a direct line to your partner, Zjak Pieterse, by WhatsApp, phone or email, Monday to Friday 08:00 to 17:00; messages before 15:00 get a reply the same business day and later ones by 12:00 the next business day, with the answer or when to expect it; a call before big decisions such as hiring, a lease, a vehicle, a loan, a new entity or a large contract; urgent requests such as bank or funder letters, tax clearance and SARS letters handled first)',
    ]);
    expect(cumulativeInclusions(CORE, 'pro').some((t) => t.startsWith('Direct Partner Access'))).toBe(false);
    expect(premium).toContain('Monthly Tax Strategy & Planning');
    expect(cumulativeInclusions(CORE, 'basic')).not.toContain('Supplier Processing & Review');
  });

  it('keeps one rhythm, report and review per schedule: the highest package wins', () => {
    const premium = cumulativeInclusions(CORE, 'premium');
    expect(premium.filter((t) => t.endsWith('Processing') && !t.startsWith('Supplier'))).toEqual(['Daily Processing']);
    expect(premium).not.toContain('Quarterly Performance Review');
    expect(premium).not.toContain('Monthly Performance Review');
    expect(premium).toContain('Weekly Performance Review');
    expect(premium).toContain('Weekly Insights Report');
    const pro = cumulativeInclusions(CORE, 'pro');
    expect(pro).toContain('Monthly Insights Report');
    expect(pro).not.toContain('Quarterly Insights Report');
    expect(pro).toContain('Weekly Processing');
    expect(pro).not.toContain('Monthly Processing');
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
    expect(cumulativeInclusions(['payroll', ...CORE], 'basic')).toContain('Payroll Services');
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
