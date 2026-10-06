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
    hint: 'An average month of bank lines, invoices, bills and journals, across all accounts.',
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
