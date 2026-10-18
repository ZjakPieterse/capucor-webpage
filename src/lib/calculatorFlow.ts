// Pure navigation and derivation rules for the calculator-v2 wizard. No React,
// so the rules are unit-tested directly (src/__tests__/calculator-flow.test.ts).

import { CORE_SERVICE_SLUGS, parseAddonToken } from '@/lib/pricing';
import { PAYROLL_ONLY_TIER } from '@/config/tiers';
import type { BracketValue, CalculatorAnswers, CalculatorStep } from '@/types';

// "Do you need monthly accounting services?" comes first (2026-10-18): Yes is
// the package flow, No is payroll on its own (payroll, headcount, review).
export const FIRST_STEP: CalculatorStep = 'accounting';

interface FlowState {
  selectedBrackets: Record<string, BracketValue>;
  answers: CalculatorAnswers;
  selectedTier: string | null;
}

/** True on the payroll-only path: the visitor answered No to monthly accounting. */
export function isPayrollOnly(answers: Pick<CalculatorAnswers, 'needsAccounting'>): boolean {
  return answers.needsAccounting === false;
}

/**
 * The package a selection is priced on: the payroll-only package on that path,
 * else the package the visitor chose (null until they choose).
 */
export function pricedTier(s: Pick<FlowState, 'answers' | 'selectedTier'>): string | null {
  return isPayrollOnly(s.answers) ? PAYROLL_ONLY_TIER : s.selectedTier;
}

/**
 * The services a selection prices. Core (accounting, bookkeeping) is in once
 * its bracket is chosen, unless the visitor said No to monthly accounting;
 * payroll only on a "Yes" with a headcount. A "No" drops either even when an
 * earlier band is still remembered.
 */
export function deriveServices(
  selectedBrackets: Record<string, BracketValue>,
  answers: Pick<CalculatorAnswers, 'needsAccounting' | 'needsPayroll'>,
): Set<string> {
  const out = new Set<string>();
  if (!isPayrollOnly(answers)) {
    for (const slug of CORE_SERVICE_SLUGS) {
      if (typeof selectedBrackets[slug] === 'number') out.add(slug);
    }
  }
  if (answers.needsPayroll === true && typeof selectedBrackets.payroll === 'number') {
    out.add('payroll');
  }
  return out;
}

/** True when the current screen has an answer and Continue may advance. */
export function canProceed(step: CalculatorStep, s: FlowState): boolean {
  switch (step) {
    case 'accounting':
      return s.answers.needsAccounting !== null;
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
    case 'contact':
      return false;
  }
}

/**
 * The screen after `step`. A payroll "No" skips the headcount. On the
 * payroll-only path the headcount goes straight to review (no package or
 * add-ons), and a payroll "No" there leaves nothing to price.
 */
export function nextStep(step: CalculatorStep, s: Pick<FlowState, 'answers'>): CalculatorStep {
  const payrollOnly = isPayrollOnly(s.answers);
  switch (step) {
    case 'accounting':
      return payrollOnly ? 'payroll' : 'revenue';
    case 'revenue':
      return 'transactions';
    case 'transactions':
      return 'vat';
    case 'vat':
      return 'payroll';
    case 'payroll':
      if (s.answers.needsPayroll) return 'employees';
      return payrollOnly ? 'contact' : 'package';
    case 'employees':
      return payrollOnly ? 'review' : 'package';
    case 'package':
      return 'addons';
    case 'addons':
    case 'review':
      return 'review';
    case 'contact':
      return 'contact';
  }
}

/** The screen before `step`, mirroring nextStep. */
export function prevStep(step: CalculatorStep, s: Pick<FlowState, 'answers'>): CalculatorStep {
  const payrollOnly = isPayrollOnly(s.answers);
  switch (step) {
    case 'accounting':
    case 'revenue':
      return 'accounting';
    case 'transactions':
      return 'revenue';
    case 'vat':
      return 'transactions';
    case 'payroll':
      return payrollOnly ? 'accounting' : 'vat';
    case 'employees':
      return 'payroll';
    case 'package':
      return s.answers.needsPayroll ? 'employees' : 'payroll';
    case 'addons':
      return 'package';
    case 'review':
      return payrollOnly ? 'employees' : 'addons';
    case 'contact':
      return 'payroll';
  }
}

/**
 * How full the progress bar is on `step`, from 0 to 1 (tweaks round 1: one
 * bar, no stage names). The screens are counted along the visitor's own path,
 * so a payroll No has one screen fewer. Review stops short of full; a created
 * proposal or request fills the bar.
 */
export function progressFraction(
  step: CalculatorStep,
  s: Pick<FlowState, 'answers'>,
  completed = false,
): number {
  if (completed) return 1;
  const path = visitorPath(s);
  const at = path.indexOf(step);
  return at < 0 ? 0 : (at + 1) / (path.length + 1);
}

// The screens along the visitor's own path, up to review (or the "let's talk"
// screen, which also ends a path).
function visitorPath(s: Pick<FlowState, 'answers'>): CalculatorStep[] {
  const path: CalculatorStep[] = [FIRST_STEP];
  for (;;) {
    const at = path[path.length - 1]!;
    const next = nextStep(at, s);
    if (next === at) return path;
    path.push(next);
  }
}

/**
 * Where `step` sits on the visitor's own path, for the "Step 3 of 7" live
 * region (audit A14). Counted like the progress bar, so a payroll Yes adds the
 * headcount screen to the total.
 */
export function stepPosition(
  step: CalculatorStep,
  s: Pick<FlowState, 'answers'>,
): { index: number; total: number } {
  const path = visitorPath(s);
  return { index: path.indexOf(step) + 1, total: path.length };
}

interface SelectionState extends FlowState {
  selectedServices: Set<string>;
  selectedAddons: string[];
}

/**
 * Back from `step` drops whatever the visitor changed on that screen without
 * pressing Continue (tweaks round 1: only Continue keeps a selection). The
 * screen's own value goes back to what it was when the screen was entered;
 * everything else is left as it is.
 */
export function revertStepFields<S extends SelectionState>(current: S, entry: S, step: CalculatorStep): S {
  const bracketSlug =
    step === 'revenue' ? 'accounting' : step === 'transactions' ? 'bookkeeping' : step === 'employees' ? 'payroll' : null;
  if (bracketSlug) {
    const selectedBrackets = { ...current.selectedBrackets };
    const was = entry.selectedBrackets[bracketSlug];
    if (was === undefined) delete selectedBrackets[bracketSlug];
    else selectedBrackets[bracketSlug] = was;
    return { ...current, selectedBrackets, selectedServices: deriveServices(selectedBrackets, current.answers) };
  }
  if (step === 'accounting' || step === 'vat' || step === 'payroll') {
    const key = step === 'accounting' ? 'needsAccounting' : step === 'vat' ? 'vatRegistered' : 'needsPayroll';
    const answers = { ...current.answers, [key]: entry.answers[key] };
    return { ...current, answers, selectedServices: deriveServices(current.selectedBrackets, answers) };
  }
  if (step === 'package') return { ...current, selectedTier: entry.selectedTier };
  if (step === 'addons') return { ...current, selectedAddons: entry.selectedAddons };
  return current;
}

/**
 * True when every screen up to the package step (on the payroll-only path, up
 * to review) is answered. Guards the package, add-ons and review screens
 * against an incomplete selection. A payroll-only No is never complete: there
 * is nothing to price.
 */
export function scopeComplete(s: FlowState): boolean {
  if (s.answers.needsAccounting === null) return false;
  if (isPayrollOnly(s.answers)) return s.answers.needsPayroll === true && canProceed('employees', s);
  const order: CalculatorStep[] = ['revenue', 'transactions', 'vat', 'payroll'];
  if (!order.every((step) => canProceed(step, s))) return false;
  return s.answers.needsPayroll ? canProceed('employees', s) : true;
}

/**
 * The add-on tokens a selection carries once the answers are applied: a VAT No
 * adds the scope flag that hides VAT201, and the payroll-only package carries
 * none (no add-ons, and no VAT question on that path). Answer-driven tokens the visitor could
 * not have chosen are stripped first, so only the answers decide them; that
 * includes the retired `xero-invoicing` token, which nothing adds any more
 * (decision 2026-10-06). /api/proposals applies the same rule server-side.
 */
export function effectiveAddons(
  selectedAddons: string[],
  answers: Pick<CalculatorAnswers, 'vatRegistered'> & Partial<Pick<CalculatorAnswers, 'needsAccounting'>>,
): string[] {
  if (answers.needsAccounting === false) return [];
  const out = selectedAddons.filter((t) => !ANSWER_ADDON_SLUGS.has(parseAddonToken(t).slug));
  if (answers.vatRegistered === false) out.push('not-vat-registered');
  return out;
}

export const ANSWER_ADDON_SLUGS: ReadonlySet<string> = new Set(['xero-invoicing', 'not-vat-registered']);
