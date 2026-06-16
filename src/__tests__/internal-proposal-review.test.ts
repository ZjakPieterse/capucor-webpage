import { describe, it, expect } from 'vitest';
import { isReviewDue, REVIEW_DUE_MONTHS } from '@/lib/internal/proposalReview';

// Fixed "now" so the month arithmetic is deterministic.
const NOW = new Date('2026-06-16T00:00:00Z');

function monthsAgo(n: number): string {
  const d = new Date(NOW);
  d.setMonth(d.getMonth() - n);
  return d.toISOString();
}

describe('isReviewDue', () => {
  it('flags a signed proposal signed 3+ months ago', () => {
    expect(isReviewDue('signed', monthsAgo(4), NOW)).toBe(true);
  });

  it('flags an active proposal signed 3+ months ago', () => {
    expect(isReviewDue('active', monthsAgo(5), NOW)).toBe(true);
  });

  it('flags exactly at the 3-month boundary', () => {
    expect(isReviewDue('signed', monthsAgo(REVIEW_DUE_MONTHS), NOW)).toBe(true);
  });

  it('does not flag a recently signed proposal', () => {
    expect(isReviewDue('signed', monthsAgo(2), NOW)).toBe(false);
  });

  it('does not flag non-live statuses even when old', () => {
    expect(isReviewDue('viewed', monthsAgo(6), NOW)).toBe(false);
    expect(isReviewDue('sent', monthsAgo(6), NOW)).toBe(false);
    expect(isReviewDue('superseded', monthsAgo(6), NOW)).toBe(false);
    expect(isReviewDue('expired', monthsAgo(6), NOW)).toBe(false);
  });

  it('does not flag when signed_at is missing', () => {
    expect(isReviewDue('signed', null, NOW)).toBe(false);
    expect(isReviewDue('active', undefined, NOW)).toBe(false);
  });

  it('does not flag an unparseable signed_at', () => {
    expect(isReviewDue('signed', 'not-a-date', NOW)).toBe(false);
  });
});
