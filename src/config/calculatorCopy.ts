// Copy for the calculator-v2 wizard (Phase 1). Kept apart from config/tiers.ts,
// which holds the package definitions.

import type { CalculatorStep } from '@/types';

// One plain question per screen, with one line on why it matters to the price
// (calculator journey, 2026-10-25, reversing "no subtexts" of 2026-10-06).
export interface QuestionCopy {
  title: string;
  why: string;
}

export const QUESTION_COPY = {
  // First, so a payroll-only client is not asked for revenue (Zjak, 2026-10-18).
  accounting: {
    title: 'Do you need monthly accounting services?',
    why: 'Your books, tax and compliance, done every month. Choose No if you only need payroll.',
  },
  revenue: {
    title: 'What is your annual revenue?',
    why: 'Your turnover sets the size of your compliance and reporting work, and so your fee.',
  },
  transactions: {
    title: 'How many transactions do you have each month?',
    why: 'Count every bank line, invoice, supplier bill and journal. This sets your monthly processing allowance.',
  },
  vat: {
    title: 'Is your business registered for VAT?',
    why: 'If you are, your VAT returns are included. Your answer does not change the price.',
  },
  payroll: {
    title: 'Do you need payroll services?',
    why: 'Payslips every month, plus your EMP201, EMP501 and UIF submissions to SARS.',
  },
  employees: {
    title: 'How many employees are on your payroll?',
    why: 'Count everyone paid through payroll each month. Your headcount sets the payroll fee.',
  },
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

// The insights report and performance review are one row since the Premium
// redesign (Zjak, 2026-10-24): a written expert verdict, not a meeting. The
// processing tooltip says the client captures their own sales invoices (Zjak,
// same day); receivables are reviewed on every package.
export const RHYTHM_ROWS: RhythmRow[] = [
  {
    label: 'Processing',
    tooltip:
      'How often we capture and reconcile your bank, including checking which customers have paid. You capture your own sales invoices; we request bank statements at every monthly close.',
    values: { basic: 'Monthly', pro: 'Weekly', premium: 'Daily' },
    replaces: ['Monthly processing', 'Weekly processing', 'Daily processing'],
  },
  {
    label: 'Insights report and business health check',
    tooltip:
      "A written report on your key numbers, with our expert view of what's going well, what needs attention and what to do next.",
    values: { basic: 'Quarterly', pro: 'Monthly', premium: 'Monthly' },
    replaces: [
      'Quarterly insights report and business health check',
      'Monthly insights report and business health check',
    ],
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

// Every review lists what the package includes under the price summary, in
// the comparison table's short wording (Zjak, 2026-10-18); the items come from
// reviewInclusions in lib/schedule.ts. `packageName` is the display name
// (Basic, Pro, Premium, Payroll).
export function reviewInclusionsHeading(packageName: string): string {
  return `What your ${packageName} subscription includes`;
}

// No to accounting and No to payroll: nothing the calculator prices, so it
// offers a conversation instead (Zjak, 2026-10-18).
export const NOTHING_TO_PRICE_COPY = {
  title: "Let's talk about what you need",
  body: 'This calculator prices monthly accounting and payroll. Tell us what your business needs and we will come back to you.',
  action: 'Contact us',
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
