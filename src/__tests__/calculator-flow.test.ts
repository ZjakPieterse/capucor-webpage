import { describe, it, expect } from 'vitest';
import {
  canProceed,
  deriveServices,
  mergeCoreLines,
  nextStep,
  prevStep,
  scopeComplete,
} from '@/lib/calculatorFlow';
import { CALCULATOR_STAGE_OF } from '@/config/calculatorCopy';
import type { CalculatorAnswers, CalculatorStep } from '@/types';

const answers = (over: Partial<CalculatorAnswers> = {}): CalculatorAnswers => ({
  vatRegistered: null,
  xeroInvoicing: null,
  needsPayroll: null,
  ...over,
});

// Walks Continue from the first screen to review, as a visitor would.
function walk(a: CalculatorAnswers): CalculatorStep[] {
  const path: CalculatorStep[] = ['revenue'];
  while (path[path.length - 1] !== 'review') {
    path.push(nextStep(path[path.length - 1]!, { answers: a }));
  }
  return path;
}

describe('calculator-v2 navigation', () => {
  it('payroll Yes asks for the headcount', () => {
    expect(walk(answers({ needsPayroll: true }))).toEqual([
      'revenue', 'transactions', 'vat', 'invoicing', 'payroll', 'employees', 'package', 'addons', 'review',
    ]);
  });

  it('payroll No skips the headcount, and Back from the package returns to the payroll question', () => {
    const a = answers({ needsPayroll: false });
    expect(walk(a)).not.toContain('employees');
    expect(nextStep('payroll', { answers: a })).toBe('package');
    expect(prevStep('package', { answers: a })).toBe('payroll');
    expect(prevStep('package', { answers: answers({ needsPayroll: true }) })).toBe('employees');
  });

  it('Back retraces Continue screen by screen', () => {
    for (const needsPayroll of [true, false]) {
      const a = answers({ needsPayroll });
      const path = walk(a);
      for (let i = path.length - 1; i > 0; i--) {
        expect(prevStep(path[i]!, { answers: a })).toBe(path[i - 1]);
      }
    }
  });

  it('every screen belongs to one of the five progress stages, in order', () => {
    const stages = walk(answers({ needsPayroll: true })).map((s) => CALCULATOR_STAGE_OF[s]);
    expect(stages).toEqual([1, 1, 1, 1, 2, 2, 3, 4, 5]);
  });
});

describe('calculator-v2 gating', () => {
  const empty = { selectedBrackets: {}, answers: answers(), selectedTier: null };

  it('no screen proceeds unanswered; core has no opt-out', () => {
    for (const step of ['revenue', 'transactions', 'vat', 'invoicing', 'payroll', 'employees', 'package'] as const) {
      expect(canProceed(step, empty)).toBe(false);
    }
    // 'not_required' is not a bracket: core stays unanswered.
    expect(canProceed('revenue', { ...empty, selectedBrackets: { accounting: 'not_required' } })).toBe(false);
  });

  it('scope is complete without a headcount only when payroll is No', () => {
    const base = {
      selectedBrackets: { accounting: 3, bookkeeping: 0 },
      selectedTier: null,
    };
    const filled = { vatRegistered: true, xeroInvoicing: false };
    expect(scopeComplete({ ...base, answers: answers({ ...filled, needsPayroll: false }) })).toBe(true);
    expect(scopeComplete({ ...base, answers: answers({ ...filled, needsPayroll: true }) })).toBe(false);
    expect(
      scopeComplete({
        ...base,
        selectedBrackets: { ...base.selectedBrackets, payroll: 2 },
        answers: answers({ ...filled, needsPayroll: true }),
      }),
    ).toBe(true);
    expect(scopeComplete({ ...base, answers: answers({ needsPayroll: false }) })).toBe(false);
  });
});

describe('deriveServices', () => {
  it('prices core once both brackets are set', () => {
    expect([...deriveServices({ accounting: 1 }, { needsPayroll: null })]).toEqual(['accounting']);
    expect([...deriveServices({ accounting: 1, bookkeeping: 4 }, { needsPayroll: null })]).toEqual([
      'accounting',
      'bookkeeping',
    ]);
  });

  it('payroll No drops a remembered headcount from the proposal; Yes brings it back', () => {
    const brackets = { accounting: 1, bookkeeping: 4, payroll: 2 };
    expect(deriveServices(brackets, { needsPayroll: false }).has('payroll')).toBe(false);
    expect(deriveServices(brackets, { needsPayroll: true }).has('payroll')).toBe(true);
    expect(deriveServices({ accounting: 1 }, { needsPayroll: true }).has('payroll')).toBe(false);
  });
});

describe('mergeCoreLines', () => {
  const lines = [
    { slug: 'accounting', name: 'Accounting', label: 'R1m to R2m', price: 1000 },
    { slug: 'bookkeeping', name: 'Bookkeeping', label: '51 to 75', price: 850.5 },
    { slug: 'payroll', name: 'Payroll', label: '3 employees', price: 450 },
    { slug: 'dext', name: 'Dext Software Access', label: null, price: 375 },
  ];

  it('shows accounting and bookkeeping as one core line with the summed price', () => {
    const merged = mergeCoreLines(lines);
    expect(merged.map((l) => l.slug)).toEqual(['core', 'payroll', 'dext']);
    expect(merged[0]).toEqual({
      slug: 'core',
      name: 'Accounting and bookkeeping',
      label: 'R1m to R2m · 51 to 75',
      price: 1850.5,
    });
    // Totals are unchanged by the merge.
    const sum = (xs: { price: number }[]) => xs.reduce((s, x) => s + x.price, 0);
    expect(sum(merged)).toBe(sum(lines));
  });

  it('leaves the lines alone when core is incomplete', () => {
    const partial = lines.filter((l) => l.slug !== 'bookkeeping');
    expect(mergeCoreLines(partial)).toBe(partial);
  });
});
