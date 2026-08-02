'use client';

import { useCallback, useEffect, useState } from 'react';
import type { BracketValue, CalculatorStep, PricingState } from '@/types';

// Bumped to v3 when the calculator collapsed to two input steps (the old
// "Select services" step folded into the scope questions) and gained add-ons.
// Old drafts carry step:3 and no selectedAddons, which no longer fit the shape.
const STORAGE_KEY = 'capucor.pricing.draft.v3';

const DEFAULT_STATE: PricingState = {
  step: 1,
  selectedServices: new Set(),
  selectedBrackets: {},
  selectedTier: null,
  selectedAddons: [],
};

// Serializable selection used to pre-populate the calculator from an existing
// proposal. Crosses the server→client boundary, so it's plain arrays/objects —
// the Set is rebuilt here. `brackets` may carry 'not_required' for services the
// proposal opted out of, so Back-to-step-1 shows every service already answered.
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
  return {
    // The selection is complete, so open on the tier step (priced result +
    // Activate). Back to step 1 still works to adjust scope.
    step: 2,
    selectedServices: new Set(seed.services),
    selectedBrackets: { ...seed.brackets },
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

  // True once the user has submitted the Activate modal and a proposal has been
  // sent. Drives the stepper's final "Done" segment. Not persisted — a refresh
  // starts a fresh configuration. Any change to the selection clears it.
  const [completed, setCompleted] = useState(false);

  // Every visit to /pricing starts blank: the hook never reads the stored
  // draft on init (it starts from DEFAULT_STATE, or the seed), and the
  // first persist overwrites any prior draft. Continue/Back within the page
  // don't unmount this hook, so in-session step state still flows; only fresh
  // navigation or refresh resets it.
  useEffect(() => {
    persistToStorage(state);
  }, [state]);

  const setStep = useCallback((step: CalculatorStep) => {
    setState((s) => ({ ...s, step }));
  }, []);

  const markCompleted = useCallback(() => setCompleted(true), []);

  // Going Back clears selections made in later steps so each step is a fresh
  // choice when re-entered from below. Step 1 answers (brackets) are kept.
  const setStepBack = useCallback((step: CalculatorStep) => {
    setCompleted(false);
    setState((s) => {
      const next: PricingState = { ...s, step };
      if (step <= 1) {
        next.selectedTier = null;
        next.selectedAddons = [];
      }
      return next;
    });
  }, []);

  // The single entry point of the scope step: a numeric bracket opts the
  // service in, 'not_required' explicitly opts it out. selectedServices is
  // maintained here so downstream consumers keep their existing shape.
  const setBracket = useCallback((slug: string, value: BracketValue) => {
    setCompleted(false);
    setState((s) => {
      const services = new Set(s.selectedServices);
      if (typeof value === 'number') {
        services.add(slug);
      } else {
        services.delete(slug);
      }
      const selectedTier = services.size === 0 ? null : s.selectedTier;
      return {
        ...s,
        selectedServices: services,
        selectedBrackets: { ...s.selectedBrackets, [slug]: value },
        selectedTier,
      };
    });
  }, []);

  const setTier = useCallback((tierSlug: string) => {
    setCompleted(false);
    setState((s) => ({ ...s, selectedTier: tierSlug }));
  }, []);

  const toggleAddon = useCallback((addonSlug: string) => {
    setCompleted(false);
    setState((s) => ({
      ...s,
      selectedAddons: s.selectedAddons.includes(addonSlug)
        ? s.selectedAddons.filter((a) => a !== addonSlug)
        : [...s.selectedAddons, addonSlug],
    }));
  }, []);

  // Step-1 gating ("every question answered, at least one priced") needs the
  // services list from Supabase, so the calculator computes it — see
  // canProceedScopeStep below. Step 2 only needs a tier.
  const canProceedStep2 = state.selectedTier !== null;

  return {
    state,
    completed,
    markCompleted,
    setStep,
    setStepBack,
    setBracket,
    setTier,
    toggleAddon,
    canProceedStep2,
  };
}

// True when every service has an explicit answer (a bracket or 'not_required')
// and at least one carries a real bracket. Lives here rather than in the hook
// because the service list comes from Supabase via the page, not from state.
export function canProceedScopeStep(
  serviceSlugs: string[],
  selectedBrackets: Record<string, BracketValue>
): boolean {
  if (serviceSlugs.length === 0) return false;
  const allAnswered = serviceSlugs.every((slug) => slug in selectedBrackets);
  const anyPriced = serviceSlugs.some((slug) => typeof selectedBrackets[slug] === 'number');
  return allAnswered && anyPriced;
}
