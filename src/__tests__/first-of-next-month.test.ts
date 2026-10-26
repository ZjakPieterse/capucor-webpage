import { describe, it, expect } from 'vitest';
import { firstOfNextMonth, firstPaymentDue } from '@/lib/utils';
import { firstOfNextMonthSast } from '@/lib/email/messages.mjs';

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

// One anchor for the first payment (engagement-letter gap row 15): the signing
// day in South African time, on the proposal page, the signed PDF and the email.
describe('firstPaymentDue', () => {
  it('dates from the SA calendar day: 22:00 UTC on 31 October is already 1 November in SA', () => {
    expect(firstPaymentDue(new Date('2026-10-31T21:59:59Z')).toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(firstPaymentDue(new Date('2026-10-31T22:00:00Z')).toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it('uses a plan review effective_from while signing is before it', () => {
    expect(firstPaymentDue(new Date('2026-11-15T10:00:00Z'), '2027-01-01').toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });

  it('rolls to the next 1st when signed on or after effective_from (commit_proposal_signature, 004)', () => {
    expect(firstPaymentDue(new Date('2026-12-01T08:00:00Z'), '2026-12-01').toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
    expect(firstPaymentDue(new Date('2026-11-30T22:30:00Z'), '2026-12-01').toISOString()).toBe(
      '2027-01-01T00:00:00.000Z',
    );
  });

  it('agrees with the email renderer for any instant', () => {
    for (const iso of [
      '2026-10-31T21:59:59Z',
      '2026-10-31T22:00:00Z',
      '2026-12-31T22:30:00Z',
      '2027-02-28T23:00:00Z',
      '2026-07-15T10:30:00Z',
    ]) {
      expect(firstOfNextMonthSast(iso).toISOString()).toBe(firstPaymentDue(new Date(iso)).toISOString());
    }
  });
});
