'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BracketValue, CalculatorStep, PricingState } from '@/types';

// Bumped to v2 when the calculator dropped its 4th input step (Activate). Old
// v1 drafts could carry step:4 which is no longer a valid CalculatorStep.
const STORAGE_KEY = 'capucor.pricing.draft.v2';

const DEFAULT_STATE: PricingState = {
  step: 1,
  selectedServices: new Set(),
  selectedBrackets: {},
  selectedTier: null,
};

function persistToStorage(state: PricingState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        step: state.step,
        selectedServices: [...state.selectedServices],
        selectedBrackets: state.selectedBrackets,
        selectedTier: state.selectedTier,
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

export function usePricingState() {
  const [state, setState] = useState<PricingState>(DEFAULT_STATE);

  // True once the user has submitted the Activate modal and a proposal has been
  // sent. Drives the stepper's 4th "Done" segment. Not persisted — a refresh
  // starts a fresh configuration. Any change to the selection clears it.
  const [completed, setCompleted] = useState(false);

  // Every visit to /pricing starts blank: the first persist overwrites any
  // prior draft with DEFAULT_STATE. Continue/Back within the page don't
  // unmount this hook, so in-session step state still flows; only fresh
  // navigation or refresh resets it.
  useEffect(() => {
    persistToStorage(state);
  }, [state]);

  const setStep = useCallback((step: CalculatorStep) => {
    setState((s) => ({ ...s, step }));
  }, []);

  const markCompleted = useCallback(() => setCompleted(true), []);

  // Going Back clears selections made in later steps so each step is a fresh
  // choice when re-entered from below. Step 1 selections (services) are kept.
  const setStepBack = useCallback((step: CalculatorStep) => {
    setCompleted(false);
    setState((s) => {
      const next: PricingState = { ...s, step };
      if (step <= 1) next.selectedBrackets = {};
      if (step <= 2) next.selectedTier = null;
      return next;
    });
  }, []);

  const toggleService = useCallback((slug: string) => {
    setCompleted(false);
    setState((s) => {
      const next = new Set(s.selectedServices);
      if (next.has(slug)) {
        next.delete(slug);
        const brackets = { ...s.selectedBrackets };
        delete brackets[slug];
        const selectedTier = next.size === 0 ? null : s.selectedTier;
        return { ...s, selectedServices: next, selectedBrackets: brackets, selectedTier };
      } else {
        next.add(slug);
        return { ...s, selectedServices: next };
      }
    });
  }, []);

  const setBracket = useCallback((slug: string, value: BracketValue) => {
    setCompleted(false);
    setState((s) => ({
      ...s,
      selectedBrackets: { ...s.selectedBrackets, [slug]: value },
    }));
  }, []);

  const setTier = useCallback((tierSlug: string) => {
    setCompleted(false);
    setState((s) => ({ ...s, selectedTier: tierSlug }));
  }, []);

  const canProceedStep1 = state.selectedServices.size > 0;
  const canProceedStep2 =
    state.selectedServices.size > 0 &&
    [...state.selectedServices].every((slug) => slug in state.selectedBrackets);
  const canProceedStep3 = state.selectedTier !== null;

  return {
    state,
    completed,
    markCompleted,
    setStep,
    setStepBack,
    toggleService,
    setBracket,
    setTier,
    canProceedStep1,
    canProceedStep2,
    canProceedStep3,
  };
}
