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
  invoicing: 1,
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
    hint: 'An average month of bank lines and journals, across all accounts. On Pro and Premium, where we process supplier bills, count those too.',
  },
  vat: {
    title: 'Is your business registered for VAT?',
    hint: 'This does not change your price.',
  },
  invoicing: {
    title: 'Do you invoice your customers and track their payments in Xero?',
    hint: 'This tells us how your sales side runs today. It does not change your price.',
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
  xeroInvoicing: 'Invoices and tracks payments in Xero',
} as const;

export const CORE_SERVICES_HEADING = 'Core services included';
export const CORE_SERVICES_SUBHEADING =
  'Accounting and bookkeeping form the core of every package. Each package below builds on it.';

// One line on the review step for accounting plus bookkeeping. Proposals still
// store the two services separately; this only merges how they are shown.
export const CORE_LINE_NAME = 'Accounting and bookkeeping';
export const CORE_SERVICE_SLUGS = ['accounting', 'bookkeeping'] as const;

// Dext on Basic is software access only (decision 2026-10-06, add-ons v2):
// Basic has no supplier processing, so the client does the Dext processing.
export const DEXT_ACCESS_COPY = {
  basicTitle: 'Dext with AI Assist: software access',
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
    replaces: ['Transactions Processed Monthly', 'Transactions Processed Weekly', 'Transactions Processed Daily'],
  },
  {
    label: 'Reports',
    tooltip: 'What you receive after each cycle.',
    values: {
      basic: 'Monthly: profit and loss, balance sheet',
      pro: 'Monthly insights report and 5-minute video',
      premium: 'Weekly reports',
    },
    replaces: ['Basic Monthly Reports', 'Monthly Insights Report', 'Monthly 5-Min Video Explainer'],
  },
  {
    label: 'Performance review',
    tooltip: 'A review with you of how the business is performing and what needs attention.',
    values: { basic: 'Quarterly', pro: 'Monthly', premium: 'Weekly' },
    replaces: ['Quarterly Performance Review', 'Monthly Performance Review', 'Weekly Reports & Review'],
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
