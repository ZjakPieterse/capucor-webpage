'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  FIRST_STEP,
  canProceed,
  deriveServices,
  nextStep,
  prevStep,
  revertStepFields,
  scopeComplete,
} from '@/lib/calculatorFlow';
import { addonToken, parseAddonToken } from '@/lib/pricing';
import type { BracketValue, CalculatorAnswers, CalculatorStep, PricingState } from '@/types';

// Drafts were kept in browser storage until tweaks round 1 (2026-10-06): the
// calculator now remembers nothing across a refresh, Back to another page or a
// new visit. The keys are still cleared so no old draft lingers.
const LEGACY_STORAGE_KEYS = ['capucor.pricing.draft.v4', 'capucor.pricing.draft.v3'];

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

/** Removes any draft an earlier version of the calculator left behind. */
export function clearPricingDraft() {
  if (typeof window === 'undefined') return;
  for (const key of LEGACY_STORAGE_KEYS) {
    try {
      window.sessionStorage.removeItem(key);
      window.localStorage.removeItem(key);
    } catch {
      /* Storage may be unavailable; nothing to clear. */
    }
  }
}

// `entry` is the selection as it stood when the current screen was entered.
// Back restores the current screen's own value from it, so only what the
// visitor confirmed with Continue (or a Yes / No tap) is kept.
interface Box {
  current: PricingState;
  entry: PricingState;
}

export function usePricingState(seed?: PricingSeed) {
  const [box, setBox] = useState<Box>(() => {
    const initial = seed ? seededState(seed) : DEFAULT_STATE;
    return { current: initial, entry: initial };
  });
  const state = box.current;

  // True once the details modal has been submitted and a proposal created.
  // Fills the progress bar. Any change clears it.
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    clearPricingDraft();
  }, []);

  // Changes on the current screen; `entry` is untouched.
  const update = useCallback((fn: (s: PricingState) => PricingState) => {
    setCompleted(false);
    setBox((b) => ({ ...b, current: fn(b.current) }));
  }, []);

  const markCompleted = useCallback(() => setCompleted(true), []);

  // Continue: advance only when the current screen is answered. What the
  // visitor chose here is now confirmed. `returnTo` jumps straight there once
  // every question up to the packages is answered (a change made from the
  // answer chips on the package step).
  const goNext = useCallback((returnTo?: CalculatorStep) => {
    setBox((b) => {
      const s = b.current;
      if (!canProceed(s.step, s)) return b;
      const step = returnTo && scopeComplete(s) ? returnTo : nextStep(s.step, s);
      const next = { ...s, step };
      return { current: next, entry: next };
    });
  }, []);

  // Back drops this screen's unconfirmed change, then keeps every confirmed
  // answer, so returning forward shows the choices as the visitor left them.
  const goBack = useCallback(() => {
    setCompleted(false);
    setBox((b) => {
      const reverted = revertStepFields(b.current, b.entry, b.current.step);
      const prev = { ...reverted, step: prevStep(reverted.step, reverted) };
      return { current: prev, entry: prev };
    });
  }, []);

  // Bracket questions (revenue, transactions, employees). Core is mandatory,
  // so there is no "Not required" value here.
  const setBracket = useCallback(
    (slug: string, value: number) =>
      update((s) => {
        const selectedBrackets = { ...s.selectedBrackets, [slug]: value };
        return { ...s, selectedBrackets, selectedServices: deriveServices(selectedBrackets, s.answers) };
      }),
    [update]
  );

  const setAnswer = useCallback(
    <K extends keyof CalculatorAnswers>(key: K, value: boolean) =>
      update((s) => {
        const answers = { ...s.answers, [key]: value };
        return { ...s, answers, selectedServices: deriveServices(s.selectedBrackets, answers) };
      }),
    [update]
  );

  const setTier = useCallback((tierSlug: string) => update((s) => ({ ...s, selectedTier: tierSlug })), [update]);

  // Add-ons are stored as tokens ("whatsapp-support", "personal-tax:2");
  // toggling works by slug and starts a per-unit add-on at a count of 1.
  const toggleAddon = useCallback(
    (addonSlug: string) =>
      update((s) => {
        const has = s.selectedAddons.some((t) => parseAddonToken(t).slug === addonSlug);
        return {
          ...s,
          selectedAddons: has
            ? s.selectedAddons.filter((t) => parseAddonToken(t).slug !== addonSlug)
            : [...s.selectedAddons, addonToken(addonSlug, 1)],
        };
      }),
    [update]
  );

  const setAddonQuantity = useCallback(
    (addonSlug: string, quantity: number) =>
      update((s) => ({
        ...s,
        selectedAddons: [
          ...s.selectedAddons.filter((t) => parseAddonToken(t).slug !== addonSlug),
          addonToken(addonSlug, Math.max(1, Math.round(quantity))),
        ],
      })),
    [update]
  );

  const setStep = useCallback((step: CalculatorStep) => {
    setBox((b) => {
      const at = { ...b.current, step };
      return { current: at, entry: at };
    });
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
