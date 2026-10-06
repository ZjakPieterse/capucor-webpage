// Pure navigation and derivation rules for the calculator-v2 wizard. No React,
// so the rules are unit-tested directly (src/__tests__/calculator-flow.test.ts).

import { CORE_LINE_NAME, CORE_SERVICE_SLUGS } from '@/config/calculatorCopy';
import { parseAddonToken, type ProposalLineItem } from '@/lib/pricing';
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
    case 'invoicing':
      return s.answers.xeroInvoicing !== null;
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
      return 'invoicing';
    case 'invoicing':
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
    case 'invoicing':
      return 'vat';
    case 'payroll':
      return 'invoicing';
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

/**
 * True when every screen up to the package step is answered. Guards the
 * package, add-ons and review screens against an incomplete selection.
 */
export function scopeComplete(s: FlowState): boolean {
  const order: CalculatorStep[] = ['revenue', 'transactions', 'vat', 'invoicing', 'payroll'];
  if (!order.every((step) => canProceed(step, s))) return false;
  return s.answers.needsPayroll ? canProceed('employees', s) : true;
}

/**
 * Shows accounting and bookkeeping as one core line (calculator-v2), summing
 * their prices and joining their band labels. Other lines pass through in
 * order; the core line takes the first core line's place. Presentation only:
 * proposals still store and price the two services separately.
 */
export function mergeCoreLines(items: ProposalLineItem[]): ProposalLineItem[] {
  const core = items.filter((i) => (CORE_SERVICE_SLUGS as readonly string[]).includes(i.slug));
  if (core.length < 2) return items;
  const merged: ProposalLineItem = {
    slug: 'core',
    name: CORE_LINE_NAME,
    label: core.map((i) => i.label).filter(Boolean).join(' · ') || null,
    price: core.reduce((sum, i) => sum + i.price, 0),
  };
  const out: ProposalLineItem[] = [];
  for (const item of items) {
    if (core.includes(item)) {
      if (item === core[0]) out.push(merged);
    } else {
      out.push(item);
    }
  }
  return out;
}

/**
 * The add-on tokens a selection carries once the answers are applied: a Xero
 * invoicing Yes adds the hidden Xero plan charge (R 200.00 on Basic, folded
 * into the accounting line; included from Pro), and a VAT No adds the scope
 * flag that hides VAT201. Hidden tokens the visitor could not have chosen are
 * stripped first, so only the answers decide them. /api/proposals applies the
 * same rule server-side.
 */
export function effectiveAddons(
  selectedAddons: string[],
  answers: Pick<CalculatorAnswers, 'vatRegistered' | 'xeroInvoicing'>,
): string[] {
  const out = selectedAddons.filter((t) => !ANSWER_ADDON_SLUGS.has(parseAddonToken(t).slug));
  if (answers.xeroInvoicing === true) out.push('xero-invoicing');
  if (answers.vatRegistered === false) out.push('not-vat-registered');
  return out;
}

export const ANSWER_ADDON_SLUGS: ReadonlySet<string> = new Set(['xero-invoicing', 'not-vat-registered']);
