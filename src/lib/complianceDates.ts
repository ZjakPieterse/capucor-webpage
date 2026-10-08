/**
 * The two monthly SARS due dates the homepage hero shows, computed the way the
 * site's own compliance calendar states them (src/config/complianceCalendar.ts),
 * so the hero never contradicts it (funnel review F06, 2026-10-08):
 *
 * - VAT201 on eFiling: the last business day of the month.
 * - EMP201: the 7th, or the last business day before it when the 7th falls on
 *   a weekend.
 *
 * "Business day" here means Monday to Friday. Public holidays are not modelled:
 * none falls on the last weekday of a month or on the 7th often enough to
 * matter for an illustrative reminder, and the calendar page carries the
 * "confirm with SARS" caveat.
 */

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** Steps back from `d` to the nearest Monday to Friday (inclusive). */
function weekdayOnOrBefore(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  while (isWeekend(out)) out.setDate(out.getDate() - 1);
  return out;
}

/** The last Monday to Friday of the given month (0-based `month`). */
export function lastBusinessDayOfMonth(year: number, month: number): Date {
  return weekdayOnOrBefore(new Date(year, month + 1, 0));
}

/** The next VAT201 eFiling due date on or after `now`'s date. */
export function nextVat201Due(now: Date): Date {
  const thisMonth = lastBusinessDayOfMonth(now.getFullYear(), now.getMonth());
  return now.getDate() <= thisMonth.getDate()
    ? thisMonth
    : lastBusinessDayOfMonth(now.getFullYear(), now.getMonth() + 1);
}

/** The next EMP201 due date on or after `now`'s date. */
export function nextEmp201Due(now: Date): Date {
  const thisMonth = weekdayOnOrBefore(new Date(now.getFullYear(), now.getMonth(), 7));
  return now.getDate() <= thisMonth.getDate()
    ? thisMonth
    : weekdayOnOrBefore(new Date(now.getFullYear(), now.getMonth() + 1, 7));
}
