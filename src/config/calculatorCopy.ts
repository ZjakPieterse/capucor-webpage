// Web-only copy for the calculator-v2 wizard (Phase 1). Lives here, not in
// config/tiers.ts, because tiers.ts is hand-synced with capucor-os and pinned
// by digest in contracts/cross-repo-contract.json.

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

// Shown on the review step next to the answers that do not change the price.
export const ANSWER_LABELS = {
  vatRegistered: 'Registered for VAT',
} as const;

export const CORE_SERVICES_HEADING = 'Core services';
export const CORE_SERVICES_BADGE = 'In every package';

// The pill under each package's price: a nudge, not a cumulative label
// (tweaks round 1, 2026-10-06).
export const TIER_NUDGES: Record<string, string> = {
  basic: 'A solid start',
  pro: 'Most chosen',
  premium: 'For fast-moving businesses',
};

// The merged core line ("Monthly accounting") and its slugs live in
// lib/pricing.ts, shared with capucor-os, so every surface uses one name.

// Revenue above R50m goes to a call (decision 2026-10-06): from the
// "50 Mil – 75 Mil" band (accounting ordinal 13 in migration 002) upward.
export const REVENUE_CALL_FROM_ORDINAL = 13;
export const REVENUE_CALL_COPY = {
  note: 'Above R50m in revenue, we start with a conversation so the package fits how your business runs.',
  action: 'Book a call',
  apiError: 'Businesses above R50m in revenue start with a call. Please book a call and we will prepare your proposal.',
} as const;

export const FIT_CALL_PROMPT = 'Only need payroll, or not sure what fits?';
// The transactions list stops at 1,500 a month; above that is a conversation.
export const TRANSACTIONS_FIT_CALL_PROMPT = 'More than 1,500 a month?';

// Page heading and the one promise above the progress bar on /pricing.
export const PRICING_PAGE_HEADING = 'See your monthly price';
export const PRICING_PAGE_INTRO = 'A few minutes to a price.';

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
    label: 'Processing rhythm',
    tooltip: 'How often we process what is available. Bank statements are still requested at every monthly close.',
    values: { basic: 'Monthly', pro: 'Weekly', premium: 'Daily' },
    replaces: ['Processing Rhythm: Monthly', 'Processing Rhythm: Weekly', 'Processing Rhythm: Daily'],
  },
  {
    label: 'Reports',
    tooltip: 'What you receive after each cycle.',
    values: {
      basic: 'Monthly: profit and loss, balance sheet',
      pro: 'Monthly insights report and 5-minute video',
      premium: 'Weekly reports',
    },
    replaces: ['Monthly Basic Reports', 'Monthly Insights Report', 'Monthly 5-Minute Video Explainer'],
  },
  {
    label: 'Performance review',
    tooltip: 'A review with you of how the business is performing and what needs attention.',
    values: { basic: 'Quarterly', pro: 'Monthly', premium: 'Weekly' },
    replaces: ['Quarterly Performance Review', 'Monthly Performance Review', 'Weekly Reports & Review'],
  },
];

// Premium is sold by application (decision 2026-10-06, Phase 0). The
// calculator ends in a request (tweaks round 1): no signable proposal, and
// Capucor follows up.
export const PREMIUM_REQUEST_COPY = {
  reviewTitle: 'Request Premium',
  reviewBody:
    'Premium starts with a short conversation, so we can confirm the daily rhythm fits your business and finalise your price. Send your details and we will be in touch within one business day.',
  action: 'Request Premium',
  modalTitle: 'Request Premium',
  modalBody: 'Add your details and we will be in touch within one business day to set up a short call. No payment and no commitment.',
  submit: 'Send my request',
  submitting: 'Sending your request...',
  doneTitle: 'Request received',
  doneBody: 'Thank you. We will be in touch within one business day to set up a short call about Premium.',
  priceLabel: 'Estimated monthly charge, from',
} as const;
