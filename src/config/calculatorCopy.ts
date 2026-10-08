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

// Shown on the review step next to the answers that do not change the price.
export const ANSWER_LABELS = {
  vatRegistered: 'Registered for VAT',
} as const;

export const CORE_SERVICES_HEADING = 'Core services';
// Above the packages: the visitor's answers as tap-to-change chips.
export const ANSWER_RECAP_HEADING = 'Priced for:';

// The pill under each package's price: a nudge, not a cumulative label
// (tweaks round 1, 2026-10-06). Short enough for one line on every card
// (tweaks round 2). Pro's pill is highlighted as the recommended package
// (tweaks round 3).
export const TIER_NUDGES: Record<string, string> = {
  basic: 'A solid start',
  pro: 'Most popular',
  premium: 'Our fullest service',
};

// The merged core line ("Monthly accounting") and its slugs live in
// lib/pricing.ts, so every surface uses one name.

// Revenue above R50m goes to a call (decision 2026-10-06): from the
// "50 Mil – 75 Mil" band (accounting ordinal 13 in migration 002) upward.
export const REVENUE_CALL_FROM_ORDINAL = 13;
export const REVENUE_CALL_COPY = {
  note: 'Above R50m in revenue, we start with a conversation so the package fits how your business runs.',
  action: 'Book a call',
  apiError: 'Businesses above R50m in revenue start with a call. Please book a call and we will prepare your proposal.',
} as const;


// Page heading and the one promise above the progress bar on /pricing
// (tweaks round 2, 2026-10-07).
export const PRICING_PAGE_HEADING = 'Calculate your monthly price';
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
// after the owner email (docs/payments.md).
export const AFTER_YOU_SIGN = [
  'We email you your proposal.',
  'You review it and sign online.',
  'We set up your debit order and your onboarding.',
] as const;

// The /pricing trust bar. Sentence case, one fact each (funnel review F13,
// 2026-10-08): "No lock-in contracts" and "Cancel with 30 days' notice" said
// the same thing twice, so they are one item now.
export const PRICING_TRUST_ITEMS = [
  'SARS registered',
  'Fixed monthly pricing',
  'Dedicated finance team',
  'No lock-in: 30 days’ notice to cancel',
] as const;
