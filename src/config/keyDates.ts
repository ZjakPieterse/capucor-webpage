/**
 * Static SARS / statutory compliance calendar for the client portal (K5).
 *
 * Interim, dependency-free stand-in for the Karbon-driven task feed: until the
 * Karbon Public API is wired (Phase C), the portal shows the standard South
 * African filing deadlines so clients always know what is coming up.
 *
 * These are the *standard* deadlines. The actual date for a given client can
 * shift for weekends, public holidays, the client's VAT category, or their
 * financial year-end — the portal copy says as much, and the assigned
 * accountant manages the real submissions.
 */

export interface KeyDate {
  id: string;
  /** Short, human label. */
  label: string;
  /** SARS form / code shown as a badge, e.g. "EMP201". */
  tag: string;
  /** Cadence in plain words, e.g. "Monthly", "Twice a year". */
  cadence: string;
  /** One-line description of what is due. */
  detail: string;
  /** Compute the next due date on or after `from` (date-only comparison, UTC). */
  nextDue: (from: Date) => Date;
}

// ── Date helpers (UTC, date-only) ────────────────────────────────────────────
// Cloudflare Workers run in UTC. The audience is SAST (UTC+2), so a deadline can
// look a few hours "off" right at midnight — immaterial for a reference widget,
// and the page carries a disclaimer either way.

function atUTC(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Today at 00:00 UTC, for date-only comparisons. */
function startOfDay(d: Date): Date {
  return atUTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function lastDayOfMonth(year: number, month: number): number {
  // Day 0 of the *next* month is the last day of this one.
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Next occurrence of `day`-of-month on or after `from`. */
function nextMonthlyDay(from: Date, day: number): Date {
  const today = startOfDay(from);
  let candidate = atUTC(today.getUTCFullYear(), today.getUTCMonth(), day);
  if (candidate < today) {
    // Date.UTC normalises month overflow (e.g. month 12 → next January).
    candidate = atUTC(today.getUTCFullYear(), today.getUTCMonth() + 1, day);
  }
  return candidate;
}

/** Next occurrence of a fixed month/day (annual) on or after `from`. */
function nextAnnual(from: Date, month: number, day: number): Date {
  const today = startOfDay(from);
  let candidate = atUTC(today.getUTCFullYear(), month, day);
  if (candidate < today) candidate = atUTC(today.getUTCFullYear() + 1, month, day);
  return candidate;
}

/** Next "last day of February" (handles leap years) on or after `from`. */
function nextFebLastDay(from: Date): Date {
  const today = startOfDay(from);
  let year = today.getUTCFullYear();
  let candidate = atUTC(year, 1, lastDayOfMonth(year, 1));
  if (candidate < today) {
    year += 1;
    candidate = atUTC(year, 1, lastDayOfMonth(year, 1));
  }
  return candidate;
}

// ── The calendar ─────────────────────────────────────────────────────────────

export const KEY_DATES: KeyDate[] = [
  {
    id: 'emp201',
    label: 'PAYE, UIF & SDL',
    tag: 'EMP201',
    cadence: 'Monthly',
    detail:
      "Declare and pay the PAYE, UIF and SDL withheld from the previous month's payroll. Due by the 7th (or the last business day before, if the 7th falls on a weekend or public holiday).",
    nextDue: (from) => nextMonthlyDay(from, 7),
  },
  {
    id: 'vat201',
    label: 'VAT return & payment',
    tag: 'VAT201',
    cadence: 'Every 2 months',
    detail:
      'Submit the VAT return and settle any VAT due for the tax period. Most vendors file every two months; your SARS category sets the exact months. eFiling deadline is the 25th.',
    nextDue: (from) => nextMonthlyDay(from, 25),
  },
  {
    id: 'irp6-p1',
    label: 'Provisional tax — 1st period',
    tag: 'IRP6',
    cadence: 'Annually',
    detail:
      'First provisional tax estimate and payment for the current year of assessment (companies with a February year-end). Due by 31 August.',
    nextDue: (from) => nextAnnual(from, 7, 31),
  },
  {
    id: 'irp6-p2',
    label: 'Provisional tax — 2nd period',
    tag: 'IRP6',
    cadence: 'Annually',
    detail:
      'Second provisional tax estimate and payment, due by the last day of February for a February year-end.',
    nextDue: (from) => nextFebLastDay(from),
  },
  {
    id: 'emp501-interim',
    label: 'Employer recon — interim',
    tag: 'EMP501',
    cadence: 'Annually',
    detail:
      'Interim PAYE reconciliation for the 1 March–31 August period, with matching IRP5/IT3(a) certificates. Filing window typically closes 31 October.',
    nextDue: (from) => nextAnnual(from, 9, 31),
  },
  {
    id: 'emp501-annual',
    label: 'Employer recon — annual',
    tag: 'EMP501',
    cadence: 'Annually',
    detail:
      'Annual PAYE reconciliation and final IRP5/IT3(a) certificates for the full tax year. Filing window typically closes 31 May.',
    nextDue: (from) => nextAnnual(from, 4, 31),
  },
];

export interface UpcomingKeyDate extends KeyDate {
  due: Date;
  /** Whole days from `from` to the due date (0 = today). */
  daysUntil: number;
}

/** Resolve every entry against `from` and return them sorted soonest-first. */
export function upcomingKeyDates(from: Date = new Date()): UpcomingKeyDate[] {
  const today = startOfDay(from);
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  return KEY_DATES.map((kd) => {
    const due = kd.nextDue(from);
    const daysUntil = Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);
    return { ...kd, due, daysUntil };
  }).sort((a, b) => a.due.getTime() - b.due.getTime());
}
