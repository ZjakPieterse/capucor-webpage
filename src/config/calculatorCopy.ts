// Web-only copy for the calculator-v2 wizard (Phase 1). Lives here, not in
// config/tiers.ts, because tiers.ts is hand-synced with capucor-os and pinned
// by digest in contracts/cross-repo-contract.json.

import type { CalculatorStep } from '@/types';

// The five progress stages, in order. Each wizard screen belongs to one.
export const CALCULATOR_STAGES = [
  { number: 1, label: 'Your business' },
  { number: 2, label: 'Payroll' },
  { number: 3, label: 'Package' },
  { number: 4, label: 'Add-ons' },
  { number: 5, label: 'Review' },
] as const;

export type CalculatorStage = (typeof CALCULATOR_STAGES)[number]['number'];

export const CALCULATOR_STAGE_OF: Record<CalculatorStep, CalculatorStage> = {
  revenue: 1,
  transactions: 1,
  vat: 1,
  payroll: 2,
  employees: 2,
  package: 3,
  addons: 4,
  review: 5,
};

export interface QuestionCopy {
  title: string;
  hint: string;
}

export const QUESTION_COPY = {
  revenue: {
    title: 'What is your annual revenue?',
    hint: 'Your turnover over the last twelve months, or what you expect this year if you are new.',
  },
  transactions: {
    title: 'How many transactions should be processed each month?',
    hint: 'One overall number for an average month: every bank line, supplier bill and journal we would process, across all your accounts.',
  },
  vat: {
    title: 'Is your business registered for VAT?',
    hint: 'This does not change your price.',
  },
  payroll: {
    title: 'Do you need payroll services?',
    hint: 'Payslips, EMP201 and EMP501 submissions, UIF and the annual COIDA return.',
  },
  employees: {
    title: 'How many active employees?',
    hint: 'Everyone paid through payroll in an average month.',
  },
} satisfies Partial<Record<CalculatorStep, QuestionCopy>>;

// Shown on the review step next to the answers that do not change the price.
export const ANSWER_LABELS = {
  vatRegistered: 'Registered for VAT',
} as const;

export const CORE_SERVICES_HEADING = 'Core services included';
export const CORE_SERVICES_SUBHEADING =
  'Accounting and bookkeeping form the core of every package. Each package below builds on it.';

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

// Dext on Basic is software access only (decision 2026-10-06, add-ons v2):
// Basic has no supplier processing, so the client does the Dext processing.
export const DEXT_ACCESS_COPY = {
  basicTitle: 'Dext with AI Assist',
  basicBody:
    'Capucor provides your Dext subscription, AI Assist included. You snap receipts and supplier bills and process them in Dext yourself. Basic does not include supplier processing.',
  includedTitle: 'Dext with AI Assist',
  includedBody:
    'Included in your package. Snap receipts and supplier bills in the Dext app and we process them into your books.',
} as const;

export const FIT_CALL_PROMPT = 'Only need payroll, or not sure what fits?';
// The transactions list stops at 1,500 a month; above that is a conversation.
export const TRANSACTIONS_FIT_CALL_PROMPT = 'More than 1,500 a month?';

// Page heading and intro above the stepper on /pricing.
export const PRICING_PAGE_HEADING = 'See your monthly price';
export const PRICING_PAGE_INTRO = 'About a minute, one question at a time. No call needed.';

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
    label: 'Transaction processing',
    tooltip: 'How often we process what is available. Bank statements are still requested at every monthly close.',
    values: { basic: 'Monthly', pro: 'Weekly', premium: 'Daily' },
    replaces: ['Transactions processed monthly', 'Transactions processed weekly', 'Transactions processed daily'],
  },
  {
    label: 'Reports',
    tooltip: 'What you receive after each cycle.',
    values: {
      basic: 'Monthly: profit and loss, balance sheet',
      pro: 'Monthly insights report and 5-minute video',
      premium: 'Weekly reports',
    },
    replaces: ['Basic monthly reports', 'Monthly insights report', 'Monthly 5-min video explainer'],
  },
  {
    label: 'Performance review',
    tooltip: 'A review with you of how the business is performing and what needs attention.',
    values: { basic: 'Quarterly', pro: 'Monthly', premium: 'Weekly' },
    replaces: ['Quarterly performance review', 'Monthly performance review', 'Weekly reports & review'],
  },
];

// Shown on the Basic card (Phase 0 inclusions: Basic has no supplier
// processing). Web-only for now; move into TIER_HIGHLIGHTS in tiers.ts at the
// next paired change.
export const BASIC_SUPPLIER_NOTE = 'Supplier bills are not processed. Dext access is available as an add-on.';

// Premium is sold by booking a call (decision 2026-10-06, Phase 0).
export const PREMIUM_APPLY_COPY = {
  note: 'Premium starts with a conversation, so we can confirm the daily rhythm fits your business.',
  action: 'Book a call',
} as const;
