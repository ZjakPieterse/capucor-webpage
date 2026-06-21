import { describe, it, expect } from 'vitest';
import { firstOfNextMonth } from '@/lib/utils';

// Subscriptions start on the 1st of the next calendar month (aligned to billing),
// not the signing date — and that same date is shown on the proposal/PDF/email.
describe('firstOfNextMonth', () => {
  it('returns the 1st of the next month at 00:00:00 UTC for a mid-month date', () => {
    expect(firstOfNextMonth(new Date('2026-07-15T10:30:00Z')).toISOString()).toBe(
      '2026-08-01T00:00:00.000Z',
    );
  });

  it('rolls December over to 1 January of the next year', () => {
    expect(firstOfNextMonth(new Date('2026-12-10T08:00:00Z')).toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });

  it('advances from the 1st to the following 1st (not the same month)', () => {
    expect(firstOfNextMonth(new Date('2026-08-01T00:00:00Z')).toISOString()).toBe(
      '2026-09-01T00:00:00.000Z',
    );
  });

  it('handles the last day of a month without overflow', () => {
    expect(firstOfNextMonth(new Date('2026-01-31T23:59:59Z')).toISOString()).toBe(
      '2026-02-01T00:00:00.000Z',
    );
  });

  it('chains to the month after when fed its own result (period end across a year boundary)', () => {
    const start = firstOfNextMonth(new Date('2026-12-10T00:00:00Z'));
    expect(firstOfNextMonth(start).toISOString()).toBe('2027-02-01T00:00:00.000Z');
  });

  it('defaults to now and always lands on day 1 at midnight UTC', () => {
    const d = firstOfNextMonth();
    expect(d.getUTCDate()).toBe(1);
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
    expect(d.getTime()).toBeGreaterThan(Date.now());
  });
});
