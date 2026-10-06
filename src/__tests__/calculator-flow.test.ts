import { describe, it, expect } from 'vitest';
import {
  canProceed,
  deriveServices,
  effectiveAddons,
  nextStep,
  prevStep,
  progressFraction,
  revenueNeedsCall,
  revertStepFields,
  scopeComplete,
} from '@/lib/calculatorFlow';
import type { CalculatorAnswers, CalculatorStep } from '@/types';

const answers = (over: Partial<CalculatorAnswers> = {}): CalculatorAnswers => ({
  vatRegistered: null,
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
      'revenue', 'transactions', 'vat', 'payroll', 'employees', 'package', 'addons', 'review',
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

  it('the progress bar grows screen by screen and fills only once the visitor is done', () => {
    for (const needsPayroll of [true, false]) {
      const a = { answers: answers({ needsPayroll }) };
      const values = walk(a.answers).map((s) => progressFraction(s, a));
      for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]!);
      expect(values[0]).toBeGreaterThan(0);
      expect(values[values.length - 1]).toBeLessThan(1);
      expect(progressFraction('review', a, true)).toBe(1);
    }
  });
});

describe('only Continue keeps a selection (tweaks round 1)', () => {
  const base = {
    step: 'transactions' as const,
    selectedServices: new Set(['accounting', 'bookkeeping']),
    selectedBrackets: { accounting: 3, bookkeeping: 4 } as Record<string, number>,
    answers: answers({ vatRegistered: true, needsPayroll: false }),
    selectedTier: 'pro' as string | null,
    selectedAddons: ['whatsapp-support'],
  };

  it('Back restores the screen value it had on entry, and only that one', () => {
    const changed = { ...base, selectedBrackets: { accounting: 3, bookkeeping: 9 } };
    const out = revertStepFields(changed, base, 'transactions');
    expect(out.selectedBrackets).toEqual({ accounting: 3, bookkeeping: 4 });
  });

  it('a value first chosen on this screen is dropped on Back', () => {
    const entry = { ...base, selectedBrackets: { accounting: 3 } };
    const out = revertStepFields(base, entry, 'transactions');
    expect(out.selectedBrackets).toEqual({ accounting: 3 });
    expect(out.selectedServices.has('bookkeeping')).toBe(false);
  });

  it('the package and add-on screens drop an unconfirmed package or add-on', () => {
    expect(revertStepFields({ ...base, selectedTier: 'basic' }, base, 'package').selectedTier).toBe('pro');
    expect(revertStepFields({ ...base, selectedAddons: [] }, base, 'addons').selectedAddons).toEqual(['whatsapp-support']);
    // Other screens' values are untouched.
    expect(revertStepFields({ ...base, selectedTier: 'basic' }, base, 'addons').selectedTier).toBe('basic');
  });

  it('a payroll answer reverts with the services it implied', () => {
    const entry = { ...base, answers: answers({ vatRegistered: true, needsPayroll: null }) };
    const out = revertStepFields(base, entry, 'payroll');
    expect(out.answers.needsPayroll).toBeNull();
    expect(out.answers.vatRegistered).toBe(true);
  });
});

describe('calculator-v2 gating', () => {
  const empty = { selectedBrackets: {}, answers: answers(), selectedTier: null };

  it('no screen proceeds unanswered; core has no opt-out', () => {
    for (const step of ['revenue', 'transactions', 'vat', 'payroll', 'employees', 'package'] as const) {
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
    const filled = { vatRegistered: true };
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

describe('effectiveAddons (answers decide the hidden add-ons)', () => {
  it('a VAT No adds the VAT flag; nothing adds the retired Xero charge', () => {
    expect(effectiveAddons(['dext'], { vatRegistered: false })).toEqual(['dext', 'not-vat-registered']);
  });

  it('adds nothing for VAT Yes or an unanswered question', () => {
    expect(effectiveAddons(['dext'], { vatRegistered: true })).toEqual(['dext']);
    expect(effectiveAddons([], { vatRegistered: null })).toEqual([]);
  });

  it('strips any hidden token the visitor list carries, the retired Xero charge included', () => {
    expect(
      effectiveAddons(['xero-invoicing', 'not-vat-registered', 'personal-tax:2'], { vatRegistered: true }),
    ).toEqual(['personal-tax:2']);
  });
});

describe('revenueNeedsCall (above R50m goes to a call)', () => {
  it('starts at the "50 Mil – 75 Mil" band (ordinal 13) and covers every band above', () => {
    expect(revenueNeedsCall({ accounting: 12 })).toBe(false);
    expect(revenueNeedsCall({ accounting: 13 })).toBe(true);
    expect(revenueNeedsCall({ accounting: 25 })).toBe(true);
    expect(revenueNeedsCall({})).toBe(false);
  });
});
