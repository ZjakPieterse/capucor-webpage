import { describe, it, expect } from 'vitest';
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
    const processing = RHYTHM_ROWS.find((r) => r.label === 'Processing');
    expect(processing?.values).toEqual({ basic: 'Monthly', pro: 'Weekly', premium: 'Daily' });
    expect(processing?.replaces).toEqual(['Monthly processing', 'Weekly processing', 'Daily processing']);
    // You capture your own sales invoices (Zjak, 2026-10-24).
    expect(processing?.tooltip).toMatch(/You capture your own sales invoices/);
    // The insights report and performance review are one row (Premium redesign, 2026-10-24).
    expect(RHYTHM_ROWS.map((r) => r.label)).toEqual(['Processing', 'Insights report and business health check']);
    const report = RHYTHM_ROWS[1]!;
    expect(report.values).toEqual({ basic: 'Quarterly', pro: 'Monthly', premium: 'Monthly' });
    expect(report.tooltip).toBe(
      "A written report on your key numbers, with our expert view of what's going well, what needs attention and what to do next.",
    );
    expect(processing?.tooltip).toBe(
      'How often we capture and reconcile your bank, including checking which customers have paid. You capture your own sales invoices; we request bank statements at every monthly close.',
    );
    expect(report.tooltip).not.toMatch(/meeting|with you/i);
  });

  it('every grouped card line is replaced by a value row, so none shows as a tick row too', () => {
    const replaced = new Set(RHYTHM_ROWS.flatMap((r) => r.replaces));
    for (const item of Object.values(TIER_HIGHLIGHTS).flat()) {
      expect(replaced.has(item.text), item.text).toBe(!!item.group);
    }
  });
});

describe('fee notes (F04)', () => {
  it('says no VAT is added and never points to VAT on an invoice', () => {
    const text = FEES_NOTES.join(' ');
    expect(text).toContain('No VAT is added.');
    expect(text).not.toMatch(/VAT, where it applies/);
  });
});

