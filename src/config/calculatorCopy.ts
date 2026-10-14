// Copy for the calculator-v2 wizard (Phase 1). Kept apart from config/tiers.ts,
// which holds the package definitions.

import type { CalculatorStep } from '@/types';

// One plain question per screen: no eyebrow, no hint (tweaks round 1, 2026-10-06).
export interface QuestionCopy {
  title: string;
}

export const QUESTION_COPY = {
  revenue: { title: 'What is your annual revenue?' },
  transactions: { title: 'How many transactions should be processed each month?' },
  vat: { title: 'Is your business registered for VAT?' },
  payroll: { title: 'Do you need payroll services?' },
  employees: { title: 'How many active employees?' },
} satisfies Partial<Record<CalculatorStep, QuestionCopy>>;

// Above the packages: the visitor's answers, each tap-to-change, read as a
// brief rather than filter tags (package-page feedback, 2026-10-13).
export const ANSWER_RECAP_HEADING = 'Tailored to your business';

// The badge on the featured package's top edge (decision: "Recommended" on
// Pro, not an unproven "Most popular"). Text only, no icon (Zjak, 2026-10-13,
// when the package pills were removed).
export const FEATURED_BADGE = 'Recommended';
export const FEATURED_TIER = 'pro';

// The merged core line ("Monthly accounting") and its slugs live in
// lib/pricing.ts, so every surface uses one name.

// Every revenue, transaction and employee band is self-serve; only Premium goes
// to a call (full-site audit decision 1, 2026-10-13, which retired the R50m
// call gate of 2026-10-06).

// The polite live region that names the new screen after each move (audit
// A14). Focus goes to the screen's heading; this adds where the visitor is.
export const stepAnnouncement = (index: number, total: number) => `Step ${index} of ${total}`;

// Page heading and the one promise above the progress bar on /pricing
// (tweaks round 2, 2026-10-07).
export const PRICING_PAGE_HEADING = 'Build your subscription';
export const PRICING_PAGE_INTRO = 'A few quick questions, then your price. No sign-up needed.';

// Dropdown placeholder on the bracket questions.
export const QUESTION_PLACEHOLDER = 'Choose an option';

// The packages differ by rhythm, so the side-by-side table shows these rows
// as a value per package instead of cumulative ticks (a tick for Premium on
// "processed monthly" and "processed weekly" read as all three at once).
// `replaces` lists the TIER_HIGHLIGHTS texts these rows stand in for; the
// table drops those from its tick rows. Web-only (tiers.ts is paired).
export interface RhythmRow {
  label: string;
  tooltip: string;
  values: Record<'basic' | 'pro' | 'premium', string>;
  replaces: string[];
}

export const RHYTHM_ROWS: RhythmRow[] = [
  {
    label: 'Processing',
    tooltip: 'How often we process what is available. Bank statements are still requested at every monthly close.',
    values: { basic: 'Monthly', pro: 'Weekly', premium: 'Daily' },
    replaces: ['Monthly Processing', 'Weekly Processing', 'Daily Processing'],
  },
  {
    label: 'Insights report',
    tooltip: 'A report with the key numbers and what they mean for the business.',
    values: { basic: 'Quarterly', pro: 'Monthly', premium: 'Weekly' },
    replaces: ['Quarterly Insights Report', 'Monthly Insights Report', 'Weekly Insights Report'],
  },
  {
    label: 'Performance review',
    tooltip: 'A review with you of how the business is performing and what needs attention.',
    values: { basic: 'Quarterly', pro: 'Monthly', premium: 'Weekly' },
    replaces: ['Quarterly Performance Review', 'Monthly Performance Review', 'Weekly Performance Review'],
  },
];

// Premium is sold by application (decision 2026-10-06, Phase 0). The
// calculator ends in a request (tweaks round 1): no signable proposal, and
// Capucor follows up.
export const PREMIUM_REQUEST_COPY = {
  reviewTitle: 'Request Premium',
  reviewBody:
    'Premium starts with a short conversation, so we can confirm the daily rhythm fits your business and finalise your price. Send your details and we will be in touch to set up a short call.',
  action: 'Request Premium',
  modalTitle: 'Request Premium',
  modalBody: 'Add your details and we will be in touch to set up a short call. No payment and no commitment.',
  submit: 'Send my request',
  submitting: 'Sending your request...',
  doneTitle: 'Request received',
  doneBody: 'Thank you. We will be in touch to set up a short call about Premium.',
  priceLabel: 'Estimated monthly charge, from',
} as const;

// The review step's "what happens next" note (funnel review F14, 2026-10-08).
// Facts only, no timelines: the proposal is emailed on both paths, signing is
// online, and we set up the Paysoft debit order and onboarding by hand
// after the owner email (docs/payments.md). Worded for both buttons: Accept
// opens the proposal at once, so "We email you your proposal" read wrong
// there (premium polish review, 2026-10-12).
export const AFTER_YOU_SIGN = [
  'You sign your proposal online, now or from the copy we email you.',
  'We set up your debit order.',
  'Your onboarding starts with one email and a short list.',
] as const;

// The /pricing trust bar. Sentence case, one fact each (funnel review F13,
// 2026-10-08): "No lock-in contracts" and "Cancel with 30 days' notice" said
// the same thing twice, so they are one item now. 'SARS registered' said
// registered as what; we act from a tax practitioner eFiling profile (Zjak,
// 2026-10-12).
export const PRICING_TRUST_ITEMS = [
  'Registered tax practitioner',
  'Fixed monthly fee',
  'Dedicated finance team',
  'No lock-in: 30 days’ notice to cancel',
] as const;
