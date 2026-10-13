import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Prices read "R 5 750" on every surface: a space between thousands, no cents
// (full-site audit decision 2, 2026-10-13; superseded "R 6,200"). Both spaces
// are no-break spaces (U+00A0), so a price never wraps, even where its element
// has no `whitespace-nowrap`. Every price is whole rands today; an amount with
// cents would still show them ("R 5 750.50") rather than be rounded, because
// the signed PDF is the debit-order mandate. The email formatter in
// lib/email/messages.mjs is a copy of this one (the retry runner cannot import
// TypeScript); a test keeps the two identical.
export const PRICE_SPACE = '\u00a0';
const zarFmt    = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const zarFmtDec = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatZARNumber(amount: number): string {
  const clean = Math.round(amount * 100) / 100;
  const grouped = clean % 1 === 0 ? zarFmt.format(clean) : zarFmtDec.format(clean);
  return grouped.replace(/,/g, PRICE_SPACE);
}

export function formatZAR(amount: number): string {
  return 'R' + PRICE_SPACE + formatZARNumber(amount);
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
