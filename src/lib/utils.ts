import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// PLAN §12: comma-thousands separator, period-decimal (SA accounting convention).
// en-ZA locale uses space/comma which differs from SA business practice, so we
// use en-US number formatting. Keeping the "R" glyph from wrapping away from the
// number is a layout concern handled in the price components (e.g. AnimatedPrice),
// not here.
const zarFmt    = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const zarFmtDec = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatZARNumber(amount: number): string {
  const clean = Math.round(amount * 100) / 100;
  return clean % 1 === 0 ? zarFmt.format(clean) : zarFmtDec.format(clean);
}

export function formatZAR(amount: number): string {
  return 'R ' + formatZARNumber(amount);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// The 1st of the next calendar month at 00:00:00 UTC. New subscriptions always
// start here, aligned to the billing cycle, rather than on the signing date — and
// the same date is shown on the proposal, PDF, and email so the client sees when
// their first debit order lands. December rolls over to 1 January of the next
// year (month 12 in Date.UTC wraps automatically). Pass the 1st of next month
// back in to get the 1st of the month after (used for the period end).
export function firstOfNextMonth(from: Date = new Date()): Date {
  return new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
}
