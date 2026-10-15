import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { addMonths } from '@/lib/internal/plansInForce';

const saDate = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(d);

describe('addMonths (review due = signed + 3 months, SA calendar)', () => {
  const cases: Array<[string, number, string]> = [
    ['2026-06-04T10:00:00Z', 3, '2026-09-04'],
    ['2026-01-31T10:00:00Z', 3, '2026-04-30'], // clamps to month end
    ['2026-08-31T10:00:00Z', 3, '2026-11-30'],
    ['2023-11-30T10:00:00Z', 3, '2024-02-29'], // leap year
    ['2025-11-30T10:00:00Z', 3, '2026-02-28'],
    ['2026-10-15T10:00:00Z', 3, '2027-01-15'], // year boundary
    // 01:00 SAST on 31 Jan is still 30 Jan in UTC: the SA date governs.
    ['2026-01-30T23:00:00Z', 3, '2026-04-30'],
    // 23:30 SAST on 30 Apr stays 30 Apr → 30 Jul.
    ['2026-04-30T21:30:00Z', 3, '2026-07-30'],
  ];
  for (const [signed, n, want] of cases) {
    it(`${signed} + ${n} months → ${want} (SA)`, () => {
      expect(saDate(addMonths(new Date(signed), n))).toBe(want);
    });
  }
});
