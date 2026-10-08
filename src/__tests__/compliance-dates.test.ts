import { describe, expect, it } from 'vitest';
import { lastBusinessDayOfMonth, nextEmp201Due, nextVat201Due } from '@/lib/complianceDates';

// The hero's VAT201 and EMP201 reminders must agree with the site's own
// compliance calendar (funnel review F06): VAT201 on eFiling is due on the last
// business day of the month, EMP201 on the 7th or the business day before it.
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('lastBusinessDayOfMonth', () => {
  it('is the last day when that is a weekday', () => {
    expect(ymd(lastBusinessDayOfMonth(2026, 9))).toBe('2026-10-30'); // Sat 31 Oct → Fri 30
    expect(ymd(lastBusinessDayOfMonth(2026, 8))).toBe('2026-09-30'); // Wed
  });

  it('steps back over a weekend', () => {
    expect(ymd(lastBusinessDayOfMonth(2026, 4))).toBe('2026-05-29'); // Sun 31 May → Fri 29
  });

  it('rolls over the year', () => {
    expect(ymd(lastBusinessDayOfMonth(2026, 12))).toBe('2027-01-29'); // Sun 31 Jan → Fri 29
  });
});

describe('nextVat201Due', () => {
  it('is this month while the date has not passed', () => {
    expect(ymd(nextVat201Due(new Date(2026, 9, 8)))).toBe('2026-10-30');
    expect(ymd(nextVat201Due(new Date(2026, 9, 30)))).toBe('2026-10-30');
  });

  it('moves to next month once it has passed', () => {
    expect(ymd(nextVat201Due(new Date(2026, 9, 31)))).toBe('2026-11-30');
  });

  it('is never the 25th unless the 25th is the last business day', () => {
    expect(nextVat201Due(new Date(2026, 9, 1)).getDate()).not.toBe(25);
  });
});

describe('nextEmp201Due', () => {
  it('is the 7th on a weekday', () => {
    expect(ymd(nextEmp201Due(new Date(2026, 9, 1)))).toBe('2026-10-07'); // Wed
  });

  it('moves back to the Friday when the 7th is a weekend', () => {
    expect(ymd(nextEmp201Due(new Date(2026, 10, 1)))).toBe('2026-11-06'); // Sat 7 Nov → Fri 6
  });

  it('moves to next month once it has passed', () => {
    expect(ymd(nextEmp201Due(new Date(2026, 9, 8)))).toBe('2026-11-06');
  });
});
