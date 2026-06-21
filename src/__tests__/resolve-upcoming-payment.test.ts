import { describe, it, expect } from 'vitest';
import { resolveUpcomingPayment } from '@/lib/portal/orgData';

// The portal hub header surfaces the soonest upcoming charge. A brand-new
// subscription's first debit is current_period_start (the 1st of next month);
// once that date has passed, the next charge is current_period_end.
describe('resolveUpcomingPayment', () => {
  const now = new Date('2026-06-21T12:00:00Z');

  it('shows the first payment when the period start is still in the future', () => {
    const result = resolveUpcomingPayment(
      {
        current_period_start: '2026-07-01T00:00:00.000Z',
        current_period_end: '2026-08-01T00:00:00.000Z',
      },
      now,
    );
    expect(result).toEqual({ label: 'First payment', date: '2026-07-01T00:00:00.000Z' });
  });

  it('shows the next payment once the period start has passed', () => {
    const result = resolveUpcomingPayment(
      {
        current_period_start: '2026-06-01T00:00:00.000Z',
        current_period_end: '2026-07-01T00:00:00.000Z',
      },
      now,
    );
    expect(result).toEqual({ label: 'Next payment', date: '2026-07-01T00:00:00.000Z' });
  });

  it('falls back to the next payment when there is no period start', () => {
    const result = resolveUpcomingPayment(
      { current_period_start: null, current_period_end: '2026-07-01T00:00:00.000Z' },
      now,
    );
    expect(result).toEqual({ label: 'Next payment', date: '2026-07-01T00:00:00.000Z' });
  });

  it('treats a period start exactly equal to now as already started', () => {
    const result = resolveUpcomingPayment(
      {
        current_period_start: now.toISOString(),
        current_period_end: '2026-07-01T00:00:00.000Z',
      },
      now,
    );
    expect(result.label).toBe('Next payment');
  });
});
