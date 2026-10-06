import { canProceed, deriveServices, FIRST_STEP, nextStep } from '@/lib/calculatorFlow';
import { PRICING_ADDONS, TIER_ORDER } from '@/config/tiers';
import { parseAddonToken } from '@/lib/pricing';
import type { CalculatorStep, PricingState } from '@/types';

const STEPS: CalculatorStep[] = ['revenue', 'transactions', 'vat', 'payroll', 'employees', 'package', 'addons', 'review'];

/** Untrusted browser storage must not put the wizard past unanswered questions. */
export function readPricingDraft(raw: string | null): PricingState | null {
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    if (!draft || !STEPS.includes(draft.step) || !draft.answers || !draft.selectedBrackets) return null;
    const { vatRegistered, needsPayroll } = draft.answers;
    if (![true, false, null].includes(vatRegistered) || ![true, false, null].includes(needsPayroll)) return null;
    const selectedBrackets: Record<string, number> = {};
    for (const slug of ['accounting', 'bookkeeping', 'payroll']) {
      const value = draft.selectedBrackets[slug];
      if (value !== undefined) {
        if (!Number.isInteger(value) || value < 0 || value > 100) return null;
        selectedBrackets[slug] = value;
      }
    }
    if (draft.selectedTier !== null && !TIER_ORDER.includes(draft.selectedTier)) return null;
    if (!Array.isArray(draft.selectedAddons) || !draft.selectedAddons.every((token: unknown) => {
      if (typeof token !== 'string') return false;
      const { slug, quantity } = parseAddonToken(token);
      const addon = PRICING_ADDONS.find((item) => item.slug === slug && !item.hidden);
      return addon && quantity >= 1 && quantity <= (addon.unit?.max ?? 1);
    })) return null;
    const answers = { vatRegistered, needsPayroll };
    const state: PricingState = {
      step: draft.step,
      answers,
      selectedBrackets,
      selectedServices: deriveServices(selectedBrackets, answers),
      selectedTier: draft.selectedTier,
      selectedAddons: draft.selectedAddons,
    };
    let step = FIRST_STEP;
    while (step !== state.step && step !== 'review') {
      if (!canProceed(step, state)) break;
      step = nextStep(step, state);
    }
    state.step = step;
    return state;
  } catch {
    return null;
  }
}
