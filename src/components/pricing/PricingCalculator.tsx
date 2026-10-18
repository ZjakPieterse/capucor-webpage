'use client';

import { Suspense, useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { BadgeCheck } from 'lucide-react';
import { usePricingState, type PricingSeed } from '@/hooks/usePricingState';
import {
  ANSWER_ADDON_SLUGS,
  effectiveAddons,
  isPayrollOnly,
  pricedTier,
  progressFraction,
  scopeComplete,
  stepPosition,
} from '@/lib/calculatorFlow';
import { parseAddonToken } from '@/lib/pricing';
import { focusStepHeading } from '@/lib/stepFocus';
import { PAYROLL } from '@/config/servicePages';
import {
  NOTHING_TO_PRICE_COPY,
  PAYROLL_ONLY_REVIEW_COPY,
  PRICING_PAGE_HEADING,
  PRICING_PAGE_INTRO,
  PRICING_TRUST_ITEMS,
  QUESTION_COPY,
  stepAnnouncement,
} from '@/config/calculatorCopy';
import { siteConfig } from '@/config/site';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { CalculatorProgress } from './CalculatorProgress';
import { BracketQuestion, NothingToPrice, YesNoQuestion } from './QuestionStep';
import { Step2Tiers } from './Step2Tiers';
import { AddonsStep } from './AddonsStep';
import { ReviewStep, type ProposalAction } from './ReviewStep';
import { ActivateProposalModal } from './ActivateProposalModal';
import { MobileTotalBar } from './MobileTotalBar';
import { StickyConfigChip } from './StickyConfigChip';
import type { CalculatorStep, PricingData, Testimonial } from '@/types';

// Amend mode was removed on 2026-08-02, and there are no staff proposal tools
// anywhere since 2026-10-07 (web-standalone). This calculator is public-only,
// and `seed` is the sole remaining pre-population hook. Do not re-add an amend
// branch here.
interface PricingCalculatorProps {
  data: PricingData;
  testimonials?: Testimonial[];
  /** Pre-populates the calculator. Public callers omit this. */
  seed?: PricingSeed;
}

const TRUST_ITEMS = PRICING_TRUST_ITEMS;

function TrustBar() {
  return (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
      {TRUST_ITEMS.map((item) => (
        <div key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BadgeCheck className="h-3.5 w-3.5 text-primary shrink-0" />
          {item}
        </div>
      ))}
    </div>
  );
}

function BottomCTA() {
  return (
    <section className="premium-section relative py-14 lg:py-20 pb-24 lg:pb-20 text-center">
      <SectionDivider />
      <div className="max-w-4xl mx-auto px-6">
        <p className="text-lg font-semibold mb-1">Not ready to commit?</p>
        <p className="text-sm text-muted-foreground mb-6">
          Book a fit call and we&rsquo;ll walk you through which services fit your business.
        </p>
        <a
          href={siteConfig.links.fitCall}
          className="premium-button btn-quiet btn-outline-hover inline-flex items-center gap-2 rounded-lg border border-input bg-input/30 backdrop-blur-md px-5 py-2.5 text-sm font-medium transition-all"
        >
          Book a fit call →
        </a>
      </div>
    </section>
  );
}

const SCREEN_TRANSITION = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

function PricingCalculatorInner({ data, testimonials = [], seed }: PricingCalculatorProps) {
  const { services, brackets, tiers } = data;
  const spotlightTestimonial = testimonials[0] ?? null;

  const {
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
    canProceedCurrent,
  } = usePricingState(seed);

  // The details modal, and which review-step action opened it. The mode is
  // kept while the modal closes so its title does not change mid-animation.
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ProposalAction>('send');
  const openModal = (mode: ProposalAction) => {
    setModalMode(mode);
    setModalOpen(true);
  };

  // Set when the visitor taps an answer chip on the package step: once the
  // changed answer is confirmed, the calculator returns to the packages
  // instead of walking every later question again.
  const [returnToPackages, setReturnToPackages] = useState(false);

  // Keyboard and screen-reader users follow each move (audit A14): once the
  // visitor has moved, every new screen's heading takes focus as it mounts
  // and the live region under the progress bar names the step. The first
  // screen on page load leaves focus where the browser put it.
  const moved = useRef(false);
  const [hasMoved, setHasMoved] = useState(false);
  const markMoved = () => {
    moved.current = true;
    setHasMoved(true);
  };
  // Stable, so React calls it only when a new screen (keyed by step) mounts.
  const focusNewScreen = useCallback((el: HTMLDivElement | null) => {
    if (moved.current) focusStepHeading(el);
  }, []);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const isQuestion = (s: CalculatorStep) => !['package', 'addons', 'review', 'contact'].includes(s);
  const advance = () => {
    goNext(returnToPackages && isQuestion(state.step) ? 'package' : undefined);
    markMoved();
    scrollToTop();
  };

  const next = () => {
    if (!canProceedCurrent) return;
    advance();
  };

  const editAnswer = (target: CalculatorStep) => {
    setReturnToPackages(true);
    setStep(target);
    markMoved();
    scrollToTop();
  };

  const back = () => {
    goBack();
    markMoved();
    scrollToTop();
  };

  // Every question moves straight on once answered (package simplification,
  // 2026-10-06): a Yes / No tap or a pick from a dropdown. Continue stays for
  // a screen revisited with its answer already set.
  const answerAndNext = (key: 'needsAccounting' | 'vatRegistered' | 'needsPayroll', value: boolean) => {
    setAnswer(key, value);
    advance();
  };

  const pickAndNext = (slug: string, value: number) => {
    setBracket(slug, value);
    advance();
  };

  const { step, selectedBrackets, answers } = state;
  // The package the selection is priced on: the visitor's choice, or the
  // payroll-only package on that path (no package step there).
  const payrollOnly = isPayrollOnly(answers);
  const selectedTier = pricedTier(state);
  // The visitor's add-ons plus the answer-driven one (the not-VAT-registered
  // flag); none on the payroll-only path. Every total, the summary
  // and the proposal payload use this list.
  const pricedAddons = effectiveAddons(state.selectedAddons, answers);
  // The package, add-ons and review screens need a complete scope and (after
  // the package step) a package. Normal navigation guarantees both.
  const pricedStepsReady = scopeComplete(state);
  // The payroll-only review is one short card with its own total, so it has
  // no bottom bar or sticky chip (both name a package from the tiers table).
  const showTotal =
    (step === 'addons' || step === 'review') && pricedStepsReady && !!selectedTier && !payrollOnly;
  // On the package step, once a package is tapped, phones get the bottom bar
  // with that package's price and a Continue button (the step is long at
  // 375 px). Only the answer-driven add-ons belong in that price, as on the card.
  const showPackageBar = step === 'package' && pricedStepsReady && !!selectedTier;
  const position = stepPosition(step, state);
  const packageAddons = pricedAddons.filter((t) => ANSWER_ADDON_SLUGS.has(parseAddonToken(t).slug));

  const bracketValue = (slug: string) => {
    const v = selectedBrackets[slug];
    return typeof v === 'number' ? v : undefined;
  };

  function renderScreen() {
    switch (step) {
      case 'revenue':
      case 'transactions':
      case 'employees': {
        const slug = step === 'revenue' ? 'accounting' : step === 'transactions' ? 'bookkeeping' : 'payroll';
        return (
          <BracketQuestion
            copy={QUESTION_COPY[step]}
            serviceSlug={slug}
            brackets={brackets}
            value={bracketValue(slug)}
            onChange={(v) => pickAndNext(slug, v)}
            onNext={next}
            onBack={back}
            // Payroll starts at a headcount: a payroll Yes with no employees is a
            // fit call, so the "Dormant" band is not offered here (F18).
            excludeLabels={step === 'employees' ? ['Dormant'] : undefined}
          />
        );
      }
      case 'accounting':
      case 'vat':
      case 'payroll': {
        const key = step === 'accounting' ? 'needsAccounting' : step === 'vat' ? 'vatRegistered' : 'needsPayroll';
        return (
          <YesNoQuestion
            copy={QUESTION_COPY[step]}
            value={answers[key]}
            onAnswer={(v) => answerAndNext(key, v)}
            onNext={next}
            onBack={step === 'accounting' ? undefined : back}
          />
        );
      }
      case 'contact':
        return <NothingToPrice copy={NOTHING_TO_PRICE_COPY} href={siteConfig.links.fitCall} onBack={back} />;
      case 'package':
        return (
          <Step2Tiers
            services={services}
            brackets={brackets}
            tiers={tiers}
            selectedServices={state.selectedServices}
            selectedBrackets={selectedBrackets}
            selectedTier={selectedTier}
            pricedAddons={pricedAddons}
            answers={answers}
            onEditAnswer={editAnswer}
            onTierSelect={setTier}
            onBack={back}
            onNext={next}
            testimonial={spotlightTestimonial}
          />
        );
      case 'addons':
        return selectedTier ? (
          <AddonsStep
            brackets={brackets}
            selectedServices={state.selectedServices}
            selectedBrackets={selectedBrackets}
            selectedTier={selectedTier}
            selectedAddons={state.selectedAddons}
            pricedAddons={pricedAddons}
            onToggleAddon={toggleAddon}
            onSetQuantity={setAddonQuantity}
            onBack={back}
            onNext={next}
          />
        ) : null;
      case 'review':
        return selectedTier ? (
          <ReviewStep
            services={services}
            brackets={brackets}
            tiers={tiers}
            selectedServices={state.selectedServices}
            selectedBrackets={selectedBrackets}
            selectedTier={selectedTier}
            selectedAddons={pricedAddons}
            inclusions={
              payrollOnly
                ? { heading: PAYROLL_ONLY_REVIEW_COPY.includedHeading, items: PAYROLL.items.map((i) => i.title) }
                : undefined
            }
            onBack={back}
            onAction={openModal}
          />
        ) : null;
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <>
        {/* Heading, one promise and a single progress bar (tweaks round 1) */}
        <section
          id="pricing-summary"
          className="premium-section relative pt-14 lg:pt-20 pb-4 lg:pb-6"
        >
          <div className="max-w-[1090px] mx-auto px-6">
            <div className="mb-6 text-center">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-balance">{PRICING_PAGE_HEADING}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground text-balance">{PRICING_PAGE_INTRO}</p>
            </div>
            <CalculatorProgress value={progressFraction(step, state, completed)} />
            <p role="status" aria-live="polite" className="sr-only">
              {hasMoved ? stepAnnouncement(position.index, position.total) : ''}
            </p>
            {/* No minimum height: the next section follows the screen's own
                content, so short question screens leave no gap (tweaks round 2). */}
            <div className="relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  ref={focusNewScreen}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={SCREEN_TRANSITION}
                >
                  {renderScreen()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* Trust signals near commitment, not in the warm-up */}
        <section className="premium-section relative py-14 lg:py-20">
          <SectionDivider />
          <div className="max-w-[1090px] mx-auto px-6">
            <TrustBar />
          </div>
        </section>

        <BottomCTA />
      </>

      {showPackageBar && (
        <MobileTotalBar
          selectedServices={state.selectedServices}
          selectedBrackets={selectedBrackets}
          selectedTierSlug={selectedTier}
          selectedAddons={packageAddons}
          tiers={tiers}
          brackets={brackets}
          summaryAnchorId="pricing-summary"
          caption="monthly price"
          action={{ label: 'Continue', onClick: next }}
        />
      )}

      {showTotal && (
        <>
          <MobileTotalBar
            selectedServices={state.selectedServices}
            selectedBrackets={selectedBrackets}
            selectedTierSlug={selectedTier}
            selectedAddons={pricedAddons}
            tiers={tiers}
            brackets={brackets}
            summaryAnchorId="pricing-summary"
            action={step === 'addons' ? { label: 'Review', onClick: next } : undefined}
          />

          <StickyConfigChip
            selectedServices={state.selectedServices}
            selectedBrackets={selectedBrackets}
            selectedTierSlug={selectedTier}
            selectedAddons={pricedAddons}
            tiers={tiers}
            brackets={brackets}
            observeElementId="pricing-summary"
            scrollToId="pricing-summary"
          />
        </>
      )}

      <ActivateProposalModal
        open={modalOpen}
        mode={modalMode}
        onOpenChange={setModalOpen}
        services={services}
        brackets={brackets}
        tiers={tiers}
        selectedServices={state.selectedServices}
        selectedBrackets={selectedBrackets}
        selectedTier={selectedTier}
        selectedAddons={pricedAddons}
        answers={answers}
        onSuccess={markCompleted}
      />
    </MotionConfig>
  );
}

// Wrap in Suspense for useSearchParams
export function PricingCalculator({ data, testimonials, seed }: PricingCalculatorProps) {
  return (
    <Suspense
      fallback={
        <div className="max-w-[1090px] mx-auto px-6 py-16">
          <div className="h-8 w-64 rounded-md bg-muted animate-pulse mb-8 mx-auto" />
          <div className="space-y-4">
            <div className="h-4 w-40 rounded bg-muted animate-pulse" />
            <div className="grid sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <PricingCalculatorInner data={data} testimonials={testimonials} seed={seed} />
    </Suspense>
  );
}
