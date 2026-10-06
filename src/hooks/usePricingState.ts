'use client';

import { useCallback, useEffect, useState } from 'react';
import { FIRST_STEP, canProceed, deriveServices, nextStep, prevStep } from '@/lib/calculatorFlow';
import { addonToken, parseAddonToken } from '@/lib/pricing';
import type { BracketValue, CalculatorAnswers, CalculatorStep, PricingState } from '@/types';

// Bumped to v4 for the calculator-v2 wizard: one screen per question, named
// steps instead of 1 | 2, and the VAT and payroll answers (the Xero-invoicing
// answer was withdrawn on 2026-10-06).
// v3 drafts carry a numeric step and no answers, which no longer fit the shape.
const STORAGE_KEY = 'capucor.pricing.draft.v4';

const EMPTY_ANSWERS: CalculatorAnswers = {
  vatRegistered: null,
  needsPayroll: null,
};

const DEFAULT_STATE: PricingState = {
  step: FIRST_STEP,
  selectedServices: new Set(),
  selectedBrackets: {},
  answers: EMPTY_ANSWERS,
  selectedTier: null,
  selectedAddons: [],
};

// Serializable selection used to pre-populate the calculator from an existing
// proposal. Crosses the server→client boundary, so it's plain arrays/objects —
// the Set is rebuilt here.
//
// Its original caller was the staff amend page, which moved to capucor-os in
// Phase 3 of the OS split. Nothing seeds the calculator today; the hook is kept
// because it is the supported way to do so and costs nothing dormant.
export interface PricingSeed {
  services: string[];
  brackets: Record<string, BracketValue>;
  tierSlug: string;
  addons: string[];
}

function seededState(seed: PricingSeed): PricingState {
  const answers: CalculatorAnswers = {
    ...EMPTY_ANSWERS,
    needsPayroll: seed.services.includes('payroll'),
  };
  const selectedBrackets = { ...seed.brackets };
  return {
    // The selection is complete, so open on the package step. Back still
    // walks through every question to adjust scope.
    step: 'package',
    selectedServices: deriveServices(selectedBrackets, answers),
    selectedBrackets,
    answers,
    selectedTier: seed.tierSlug,
    selectedAddons: [...seed.addons],
  };
}

function persistToStorage(state: PricingState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        step: state.step,
        selectedServices: [...state.selectedServices],
        selectedBrackets: state.selectedBrackets,
        answers: state.answers,
        selectedTier: state.selectedTier,
        selectedAddons: state.selectedAddons,
      })
    );
  } catch {
    /* quota exceeded, private mode, etc. — silent */
  }
}

export function clearPricingDraft() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function usePricingState(seed?: PricingSeed) {
  // Lazy initialiser: when seeded the calculator starts from that selection;
  // otherwise every visit starts blank (see below).
  const [state, setState] = useState<PricingState>(() =>
    seed ? seededState(seed) : DEFAULT_STATE
  );

  // True once the details modal has been submitted and a proposal created.
  // Lights every stage of the stepper. Not persisted; any change clears it.
  const [completed, setCompleted] = useState(false);

  // Every visit to /pricing starts blank: the hook never reads the stored
  // draft on init (it starts from DEFAULT_STATE, or the seed), and the
  // first persist overwrites any prior draft. Moving between screens doesn't
  // unmount this hook, so answers survive Back and Continue; only fresh
  // navigation or refresh resets them.
  useEffect(() => {
    persistToStorage(state);
  }, [state]);

  const markCompleted = useCallback(() => setCompleted(true), []);

  // Continue: advance only when the current screen is answered.
  const goNext = useCallback(() => {
    setState((s) => (canProceed(s.step, s) ? { ...s, step: nextStep(s.step, s) } : s));
  }, []);

  // Back keeps every answer, the package and the add-ons, so returning
  // forward shows the visitor's choices as they left them.
  const goBack = useCallback(() => {
    setCompleted(false);
    setState((s) => ({ ...s, step: prevStep(s.step, s) }));
  }, []);

  // Bracket questions (revenue, transactions, employees). Core is mandatory,
  // so there is no "Not required" value here.
  const setBracket = useCallback((slug: string, value: number) => {
    setCompleted(false);
    setState((s) => {
      const selectedBrackets = { ...s.selectedBrackets, [slug]: value };
      return {
        ...s,
        selectedBrackets,
        selectedServices: deriveServices(selectedBrackets, s.answers),
      };
    });
  }, []);

  const setAnswer = useCallback(<K extends keyof CalculatorAnswers>(key: K, value: boolean) => {
    setCompleted(false);
    setState((s) => {
      const answers = { ...s.answers, [key]: value };
      return {
        ...s,
        answers,
        selectedServices: deriveServices(s.selectedBrackets, answers),
      };
    });
  }, []);

  const setTier = useCallback((tierSlug: string) => {
    setCompleted(false);
    setState((s) => ({ ...s, selectedTier: tierSlug }));
  }, []);

  // Add-ons are stored as tokens ("dext", "personal-tax:2"); toggling works by
  // slug and starts a per-unit add-on at a count of 1.
  const toggleAddon = useCallback((addonSlug: string) => {
    setCompleted(false);
    setState((s) => {
      const has = s.selectedAddons.some((t) => parseAddonToken(t).slug === addonSlug);
      return {
        ...s,
        selectedAddons: has
          ? s.selectedAddons.filter((t) => parseAddonToken(t).slug !== addonSlug)
          : [...s.selectedAddons, addonToken(addonSlug, 1)],
      };
    });
  }, []);

  const setAddonQuantity = useCallback((addonSlug: string, quantity: number) => {
    setCompleted(false);
    setState((s) => ({
      ...s,
      selectedAddons: [
        ...s.selectedAddons.filter((t) => parseAddonToken(t).slug !== addonSlug),
        addonToken(addonSlug, Math.max(1, Math.round(quantity))),
      ],
    }));
  }, []);

  const setStep = useCallback((step: CalculatorStep) => {
    setState((s) => ({ ...s, step }));
  }, []);

  return {
    state,
    completed,
    markCompleted,
    goNext,
    goBack,
    setStep,
    setBracket,
    setAnswer,
    setTier,
    toggleAddon,
    setAddonQuantity,
    canProceedCurrent: canProceed(state.step, state),
  };
}
