import { describe, it, expect } from 'vitest';
import {
  FIRST_STEP,
  canProceed,
  deriveServices,
  effectiveAddons,
  isPayrollOnly,
  nextStep,
  pricedTier,
  stepPosition,
  prevStep,
  progressFraction,
  revertStepFields,
  scopeComplete,
} from '@/lib/calculatorFlow';
import type { CalculatorAnswers, CalculatorStep } from '@/types';

const answers = (over: Partial<CalculatorAnswers> = {}): CalculatorAnswers => ({
  needsAccounting: true,
  vatRegistered: null,
  needsPayroll: null,
  ...over,
});

// Walks Continue from the first screen to the last (review, or the "let's
// talk" screen), as a visitor would.
function walk(a: CalculatorAnswers): CalculatorStep[] {
  const path: CalculatorStep[] = [FIRST_STEP];
  for (;;) {
    const next = nextStep(path[path.length - 1]!, { answers: a });
    if (next === path[path.length - 1]) return path;
    path.push(next);
  }
}

describe('calculator-v2 navigation', () => {
  it('opens on the accounting question; Yes is the package flow, unchanged', () => {
    expect(FIRST_STEP).toBe('accounting');
    expect(walk(answers({ needsPayroll: true }))).toEqual([
      'accounting', 'revenue', 'transactions', 'vat', 'payroll', 'employees', 'package', 'addons', 'review',
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
    expect([...deriveServices({ accounting: 1 }, { needsAccounting: true, needsPayroll: null })]).toEqual(['accounting']);
    expect([...deriveServices({ accounting: 1, bookkeeping: 4 }, { needsAccounting: true, needsPayroll: null })]).toEqual([
      'accounting',
      'bookkeeping',
    ]);
  });

  it('payroll No drops a remembered headcount from the proposal; Yes brings it back', () => {
    const brackets = { accounting: 1, bookkeeping: 4, payroll: 2 };
    expect(deriveServices(brackets, { needsAccounting: true, needsPayroll: false }).has('payroll')).toBe(false);
    expect(deriveServices(brackets, { needsAccounting: true, needsPayroll: true }).has('payroll')).toBe(true);
    expect(deriveServices({ accounting: 1 }, { needsAccounting: true, needsPayroll: true }).has('payroll')).toBe(false);
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

// Every revenue band is self-serve (full-site audit decision 1, 2026-10-13):
// a band above R50m walks the same screens as any other, to the review step.
describe('a revenue band above R50m follows the normal path', () => {
  it.each([13, 25])('ordinal %i reaches the packages and the review step', (accounting) => {
    const s = {
      selectedBrackets: { accounting, bookkeeping: 0 },
      answers: answers({ vatRegistered: true, needsPayroll: false }),
      selectedTier: 'pro',
    };
    expect(canProceed('revenue', s)).toBe(true);
    expect(scopeComplete(s)).toBe(true);
    expect(canProceed('package', s)).toBe(true);
    expect(nextStep('package', s)).toBe('addons');
    expect(nextStep('addons', s)).toBe('review');
  });
});

// Payroll on its own (Zjak, 2026-10-18): "Do you need monthly accounting
// services?" No goes straight to payroll, the headcount and a payroll-only
// review, with no package or add-ons. No to both ends on a "let's talk" screen.
describe('payroll-only path', () => {
  const only = answers({ needsAccounting: false, needsPayroll: true });

  it('accounting No walks payroll, headcount, review and nothing else', () => {
    expect(walk(only)).toEqual(['accounting', 'payroll', 'employees', 'review']);
  });

  it('No to both ends on the contact screen, which Back leaves for the payroll question', () => {
    const neither = answers({ needsAccounting: false, needsPayroll: false });
    expect(walk(neither)).toEqual(['accounting', 'payroll', 'contact']);
    expect(prevStep('contact', { answers: neither })).toBe('payroll');
    expect(canProceed('contact', { selectedBrackets: {}, answers: neither, selectedTier: null })).toBe(false);
    expect(stepPosition('contact', { answers: neither })).toEqual({ index: 3, total: 3 });
    expect(progressFraction('contact', { answers: neither })).toBeLessThan(1);
  });

  it('Back retraces the payroll-only path screen by screen', () => {
    const path = walk(only);
    for (let i = path.length - 1; i > 0; i--) {
      expect(prevStep(path[i]!, { answers: only })).toBe(path[i - 1]);
    }
  });

  it('an unanswered accounting question counts the package path', () => {
    expect(walk(answers({ needsAccounting: null, needsPayroll: false }))).toContain('package');
    expect(canProceed('accounting', { selectedBrackets: {}, answers: answers({ needsAccounting: null }), selectedTier: null })).toBe(false);
  });

  it('prices payroll alone on the payroll-only package, whatever was chosen on the package path', () => {
    const remembered = { accounting: 1, bookkeeping: 4, payroll: 2 };
    expect([...deriveServices(remembered, only)]).toEqual(['payroll']);
    expect(isPayrollOnly(only)).toBe(true);
    expect(pricedTier({ answers: only, selectedTier: 'pro' })).toBe('payroll-only');
    expect(pricedTier({ answers: answers(), selectedTier: 'pro' })).toBe('pro');
  });

  it('carries no add-ons, not even a VAT flag left from the package path', () => {
    expect(effectiveAddons(['whatsapp-support'], { needsAccounting: false, vatRegistered: false })).toEqual([]);
  });

  it('scope is complete only with a payroll Yes and a headcount', () => {
    const s = (a: CalculatorAnswers, payroll?: number) => ({
      selectedBrackets: (payroll === undefined ? {} : { payroll }) as Record<string, number>,
      answers: a,
      selectedTier: null,
    });
    expect(scopeComplete(s(only, 1005))).toBe(true);
    expect(scopeComplete(s(only))).toBe(false);
    expect(scopeComplete(s(answers({ needsAccounting: false, needsPayroll: false }), 1005))).toBe(false);
    expect(scopeComplete(s(answers({ needsAccounting: null, needsPayroll: true }), 1005))).toBe(false);
  });

  it('Back from the accounting question drops an unconfirmed answer', () => {
    const base = {
      step: 'accounting' as const,
      selectedServices: new Set<string>(),
      selectedBrackets: {} as Record<string, number>,
      answers: answers({ needsAccounting: null }),
      selectedTier: null,
      selectedAddons: [] as string[],
    };
    const out = revertStepFields({ ...base, answers: only }, base, 'accounting');
    expect(out.answers.needsAccounting).toBeNull();
  });
});
