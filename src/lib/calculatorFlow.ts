// Pure navigation and derivation rules for the calculator-v2 wizard. No React,
// so the rules are unit-tested directly (src/__tests__/calculator-flow.test.ts).

import { REVENUE_CALL_FROM_ORDINAL } from '@/config/calculatorCopy';
import { CORE_SERVICE_SLUGS, parseAddonToken } from '@/lib/pricing';
import type { BracketValue, CalculatorAnswers, CalculatorStep } from '@/types';

export const FIRST_STEP: CalculatorStep = 'revenue';

interface FlowState {
  selectedBrackets: Record<string, BracketValue>;
  answers: CalculatorAnswers;
  selectedTier: string | null;
}

/**
 * The services a selection prices. Core (accounting, bookkeeping) is in once
 * its bracket is chosen; payroll only on a "Yes" with a headcount, so a payroll
 * "No" drops it even when an earlier headcount is still remembered.
 */
export function deriveServices(
  selectedBrackets: Record<string, BracketValue>,
  answers: Pick<CalculatorAnswers, 'needsPayroll'>,
): Set<string> {
  const out = new Set<string>();
  for (const slug of CORE_SERVICE_SLUGS) {
    if (typeof selectedBrackets[slug] === 'number') out.add(slug);
  }
  if (answers.needsPayroll === true && typeof selectedBrackets.payroll === 'number') {
    out.add('payroll');
  }
  return out;
}

/** True when the current screen has an answer and Continue may advance. */
export function canProceed(step: CalculatorStep, s: FlowState): boolean {
  switch (step) {
    case 'revenue':
      return typeof s.selectedBrackets.accounting === 'number';
    case 'transactions':
      return typeof s.selectedBrackets.bookkeeping === 'number';
    case 'vat':
      return s.answers.vatRegistered !== null;
    case 'payroll':
      return s.answers.needsPayroll !== null;
    case 'employees':
      return typeof s.selectedBrackets.payroll === 'number';
    case 'package':
      return s.selectedTier !== null;
    case 'addons':
      return s.selectedTier !== null;
    case 'review':
      return false;
  }
}

/** The screen after `step`. A payroll "No" skips the headcount. */
export function nextStep(step: CalculatorStep, s: Pick<FlowState, 'answers'>): CalculatorStep {
  switch (step) {
    case 'revenue':
      return 'transactions';
    case 'transactions':
      return 'vat';
    case 'vat':
      return 'payroll';
    case 'payroll':
      return s.answers.needsPayroll ? 'employees' : 'package';
    case 'employees':
      return 'package';
    case 'package':
      return 'addons';
    case 'addons':
    case 'review':
      return 'review';
  }
}

/** The screen before `step`, mirroring nextStep. */
export function prevStep(step: CalculatorStep, s: Pick<FlowState, 'answers'>): CalculatorStep {
  switch (step) {
    case 'revenue':
    case 'transactions':
      return 'revenue';
    case 'vat':
      return 'transactions';
    case 'payroll':
      return 'vat';
    case 'employees':
      return 'payroll';
    case 'package':
      return s.answers.needsPayroll ? 'employees' : 'payroll';
    case 'addons':
      return 'package';
    case 'review':
      return 'addons';
  }
}

// Position line above each question, e.g. "Your business · 2 of 3" or
// "Payroll · 1 of 2" (the headcount only follows a payroll Yes).
const BUSINESS_QUESTIONS: CalculatorStep[] = ['revenue', 'transactions', 'vat'];
const PAYROLL_QUESTIONS: CalculatorStep[] = ['payroll', 'employees'];
export function questionPosition(step: CalculatorStep): string {
  const i = BUSINESS_QUESTIONS.indexOf(step);
  if (i >= 0) return `Your business · ${i + 1} of ${BUSINESS_QUESTIONS.length}`;
  return `Payroll · ${PAYROLL_QUESTIONS.indexOf(step) + 1} of ${PAYROLL_QUESTIONS.length}`;
}

/**
 * True when every screen up to the package step is answered. Guards the
 * package, add-ons and review screens against an incomplete selection.
 */
export function scopeComplete(s: FlowState): boolean {
  const order: CalculatorStep[] = ['revenue', 'transactions', 'vat', 'payroll'];
  if (!order.every((step) => canProceed(step, s))) return false;
  return s.answers.needsPayroll ? canProceed('employees', s) : true;
}

/**
 * The add-on tokens a selection carries once the answers are applied: a VAT No
 * adds the scope flag that hides VAT201. Answer-driven tokens the visitor could
 * not have chosen are stripped first, so only the answers decide them; that
 * includes the retired `xero-invoicing` token, which nothing adds any more
 * (decision 2026-10-06). /api/proposals applies the same rule server-side.
 */
export function effectiveAddons(
  selectedAddons: string[],
  answers: Pick<CalculatorAnswers, 'vatRegistered'>,
): string[] {
  const out = selectedAddons.filter((t) => !ANSWER_ADDON_SLUGS.has(parseAddonToken(t).slug));
  if (answers.vatRegistered === false) out.push('not-vat-registered');
  return out;
}

export const ANSWER_ADDON_SLUGS: ReadonlySet<string> = new Set(['xero-invoicing', 'not-vat-registered']);

/**
 * True when the revenue band goes to a call rather than self-serve acceptance
 * (above R50m, decision 2026-10-06). The calculator shows "Book a call" on
 * every package and /api/proposals refuses the selection.
 */
export function revenueNeedsCall(brackets: Record<string, BracketValue | number>): boolean {
  const revenue = brackets.accounting;
  return typeof revenue === 'number' && revenue >= REVENUE_CALL_FROM_ORDINAL;
}
