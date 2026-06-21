/**
 * Schedule-of-Services scope config for the proposal document.
 *
 * "What's included" is NOT re-listed here — it's derived from the same
 * TIER_HIGHLIGHTS / PACKAGE_COMMON_ITEMS the calculator already uses (see
 * cumulativeInclusions in src/lib/schedule.ts), so there's one source of truth.
 *
 * This file adds the two things a proposal needs on top of that:
 *   1. FAIR_USAGE — what each service's bracket limit means and how work beyond
 *      it is billed.
 *   2. The out-of-scope lists — ALWAYS_OUT_OF_SCOPE (shown on every proposal)
 *      plus any service-specific exclusions.
 *
 * Plain config so it's easy to extend without touching the page. Strings live
 * in JS (not JSX), so normal apostrophes are fine here.
 */

export interface ServiceFairUsage {
  /** Heading for the service block, e.g. "Bookkeeping". */
  name: string;
  /** What the chosen bracket actually limits, e.g. "monthly transactions". */
  unit: string;
  /** How the included allowance is framed against the client's bracket label. */
  allowance: string;
  /** How work beyond the allowance is handled. null = no per-unit overage. */
  overage: string | null;
}

// Keyed by service slug (services.slug in Supabase: accounting / bookkeeping / payroll).
export const FAIR_USAGE: Record<string, ServiceFairUsage> = {
  accounting: {
    name: 'Accounting, tax & compliance',
    unit: 'annual turnover band',
    allowance:
      'Your fee is set against the turnover band you selected. It covers the compliance and reporting work for a business of that size.',
    overage:
      'If your turnover grows into a higher band, we flag it at the next quarterly review and adjust the fee from there. We never back-date a change.',
  },
  bookkeeping: {
    name: 'Bookkeeping & monthly processing',
    unit: 'monthly transactions',
    allowance:
      'Your processing allowance is the transaction count in your selected bracket, measured per month (bank lines, invoices, bills and journals).',
    overage:
      'Months that run over the allowance are billed at R200 per extra 25 transactions. We measure this on the quarterly review against your rolling average, not on a single busy month.',
  },
  payroll: {
    name: 'Payroll',
    unit: 'active employees',
    allowance:
      'Your fee covers payroll for the headcount band you selected, including payslips and the EMP201, EMP501 and UIF submissions on their cycles.',
    overage:
      'Each active employee above your band is billed at R75 per month, trued up at the quarterly review.',
  },
};

/**
 * Services that are out of scope on every proposal, whatever the client picked.
 * These are quoted and billed separately when needed. Extend this list over
 * time — it's the master "always excluded" register.
 */
export const ALWAYS_OUT_OF_SCOPE: string[] = [
  'Catch-up or prior-period processing older than the 3 months before your start date',
  'VAT registration itself (ongoing VAT returns are included where you selected accounting)',
  'COIDA / Workmen’s Compensation registration',
  'PAYE, UIF or SDL employer registration with SARS',
  'SARS audits, verifications, objections and disputes',
  'CIPC or SARS change requests (director, member, address, name or public-officer changes)',
  'Company, close-corporation or trust registrations and deregistrations',
  'Once-off or ad-hoc projects, and any work not listed in your schedule above',
];

/**
 * Optional service-specific exclusions, merged in only when that service is in
 * the proposal. Keep these short — the always-list covers the broad strokes.
 */
export const SERVICE_OUT_OF_SCOPE: Record<string, string[]> = {
  accounting: ['Independent audits or assurance engagements (we act as your accountants, not auditors)'],
  payroll: ['Drafting employment contracts or handling CCMA / labour disputes'],
};

/** Processing before the start date that we include free of charge. */
export const CATCHUP_FREE_MONTHS = 3;
