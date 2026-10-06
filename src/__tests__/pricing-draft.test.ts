import { describe, expect, it } from 'vitest';
import { readPricingDraft } from '@/lib/pricingDraft';

const draft = {
  step: 'review',
  selectedBrackets: { accounting: 4, bookkeeping: 8, payroll: 3 },
  answers: { vatRegistered: true, needsPayroll: true },
  selectedServices: ['forged-service'],
  selectedTier: 'pro',
  selectedAddons: ['personal-tax:2'],
};

describe('session pricing draft', () => {
  it('restores the screen and selections, deriving services rather than trusting storage', () => {
    const restored = readPricingDraft(JSON.stringify(draft));
    expect(restored?.step).toBe('review');
    expect(restored?.selectedBrackets).toEqual(draft.selectedBrackets);
    expect(restored?.selectedAddons).toEqual(['personal-tax:2']);
    expect(restored?.selectedTier).toBe('pro');
    expect(restored?.selectedServices).toEqual(new Set(['accounting', 'bookkeeping', 'payroll']));
  });

  it('drops payroll from the priced services when its answer is No', () => {
    const restored = readPricingDraft(JSON.stringify({ ...draft, answers: { ...draft.answers, needsPayroll: false } }));
    expect(restored?.selectedServices.has('payroll')).toBe(false);
  });

  it('returns to the first unanswered question rather than opening an incomplete review', () => {
    const restored = readPricingDraft(JSON.stringify({ ...draft, selectedBrackets: { accounting: 4 } }));
    expect(restored?.step).toBe('transactions');
  });

  it.each([null, '{', '{}', JSON.stringify({ ...draft, answers: { needsPayroll: 'yes' } }),
    JSON.stringify({ ...draft, selectedTier: 'unknown' }),
    JSON.stringify({ ...draft, selectedAddons: ['personal-tax:100'] }),
    JSON.stringify({ ...draft, selectedBrackets: { accounting: -1 } }),
  ])('ignores missing or malformed storage: %s', (raw) => {
    expect(readPricingDraft(raw)).toBeNull();
  });
});
