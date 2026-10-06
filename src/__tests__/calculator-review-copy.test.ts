import { describe, it, expect } from 'vitest';
import { questionPosition } from '@/lib/calculatorFlow';
import { RHYTHM_ROWS } from '@/config/calculatorCopy';
import { FEES_NOTES } from '@/config/proposalTerms';
import { TIER_HIGHLIGHTS, TIER_ORDER } from '@/config/tiers';

// calculator-v2 review, batch 1 (findings F03, F04, F32).

describe('comparison table rhythm rows (F03)', () => {
  const allTexts = new Set(Object.values(TIER_HIGHLIGHTS).flat().map((h) => h.text));

  it('replaces only texts that exist in TIER_HIGHLIGHTS', () => {
    // A renamed highlight would otherwise come back as a cumulative tick row.
    for (const row of RHYTHM_ROWS) {
      for (const text of row.replaces) expect(allTexts, text).toContain(text);
    }
  });

  it('gives every package a value on every rhythm row', () => {
    for (const row of RHYTHM_ROWS) {
      for (const tier of TIER_ORDER) expect(row.values[tier as 'basic'], `${row.label} ${tier}`).toBeTruthy();
    }
  });

  it('shows processing as one value per package, not cumulative ticks', () => {
    const processing = RHYTHM_ROWS.find((r) => r.label === 'Transaction processing');
    expect(processing?.values).toEqual({ basic: 'Monthly', pro: 'Weekly', premium: 'Daily' });
    const review = RHYTHM_ROWS.find((r) => r.label === 'Performance review');
    expect(review?.values).toEqual({ basic: 'Quarterly', pro: 'Monthly', premium: 'Weekly' });
  });
});

describe('fee notes (F04)', () => {
  it('says no VAT is added and never points to VAT on an invoice', () => {
    const text = FEES_NOTES.join(' ');
    expect(text).toContain('No VAT is added.');
    expect(text).not.toMatch(/VAT, where it applies/);
  });
});

describe('question position line (F32)', () => {
  it('counts the payroll questions like the business ones', () => {
    expect(questionPosition('revenue')).toBe('Your business · 1 of 4');
    expect(questionPosition('payroll')).toBe('Payroll · 1 of 2');
    expect(questionPosition('employees')).toBe('Payroll · 2 of 2');
  });
});
