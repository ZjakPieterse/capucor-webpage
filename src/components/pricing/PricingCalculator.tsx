'use client';

import { Suspense, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BadgeCheck } from 'lucide-react';
import { usePricingState, type PricingSeed } from '@/hooks/usePricingState';
import { scopeComplete } from '@/lib/calculatorFlow';
import { CALCULATOR_STAGE_OF, CALCULATOR_STAGES, QUESTION_COPY } from '@/config/calculatorCopy';
import { siteConfig } from '@/config/site';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { PageCursorGlow } from '@/components/landing/PageCursorGlow';
import { StepIndicator } from './StepIndicator';
import { BracketQuestion, YesNoQuestion } from './QuestionStep';
import { Step2Tiers } from './Step2Tiers';
import { AddonsStep } from './AddonsStep';
import { ReviewStep, type ProposalAction } from './ReviewStep';
import { ActivateProposalModal } from './ActivateProposalModal';
import { MobileTotalBar } from './MobileTotalBar';
import { StickyConfigChip } from './StickyConfigChip';
import type { CalculatorStep, PricingData, Testimonial } from '@/types';

// Amend mode was removed in Phase 3 of the OS split. Staff amend a proposal on
// capucor.app now, through a plain form in the capucor-os repo — this calculator
// is once again public-only, and `seed` is the sole remaining pre-population
// hook. Do not re-add an amend branch here; the staff surface lives elsewhere.
interface PricingCalculatorProps {
  data: PricingData;
  testimonials?: Testimonial[];
  /** Pre-populates the calculator. Public callers omit this. */
  seed?: PricingSeed;
}

const TRUST_ITEMS = [
  'SARS Registered',
  'Fixed Monthly Pricing',
  'No Lock-in Contracts',
  'Your Own Accountant',
  "Cancel with 30 Days’ Notice",
];

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
          href={siteConfig.links.booking}
          target="_blank"
          rel="noopener noreferrer"
          className="premium-button btn-quiet btn-outline-hover inline-flex items-center gap-2 rounded-lg border border-input bg-input/30 backdrop-blur-md px-5 py-2.5 text-sm font-medium transition-all"
        >
          Book a fit call →
        </a>
      </div>
    </section>
  );
}

const SCREEN_TRANSITION = { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const };

// Position line above each question, e.g. "Your business · 2 of 4".
const BUSINESS_QUESTIONS: CalculatorStep[] = ['revenue', 'transactions', 'vat', 'invoicing'];
function questionPosition(step: CalculatorStep): string {
  const i = BUSINESS_QUESTIONS.indexOf(step);
  return i >= 0 ? `Your business · ${i + 1} of ${BUSINESS_QUESTIONS.length}` : 'Payroll';
}

function PricingCalculatorInner({ data, testimonials = [], seed }: PricingCalculatorProps) {
  const { services, brackets, tiers } = data;
  const spotlightTestimonial = testimonials[0] ?? null;

  const {
    state,
    completed,
    markCompleted,
    goNext,
    goBack,
    setBracket,
    setAnswer,
    setTier,
    toggleAddon,
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

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const next = () => {
    if (!canProceedCurrent) return;
    goNext();
    scrollToTop();
  };

  const back = () => {
    goBack();
    scrollToTop();
  };

  // Yes / No questions move straight on once answered.
  const answerAndNext = (key: 'vatRegistered' | 'xeroInvoicing' | 'needsPayroll', value: boolean) => {
    setAnswer(key, value);
    goNext();
    scrollToTop();
  };

  const { step, selectedBrackets, answers, selectedTier } = state;
  // The package, add-ons and review screens need a complete scope and (after
  // the package step) a package. Normal navigation guarantees both.
  const pricedStepsReady = scopeComplete(state);
  const showTotal = (step === 'addons' || step === 'review') && pricedStepsReady && !!selectedTier;

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
            position={questionPosition(step)}
            serviceSlug={slug}
            brackets={brackets}
            value={bracketValue(slug)}
            onChange={(v) => setBracket(slug, v)}
            onNext={next}
            onBack={step === 'revenue' ? undefined : back}
            showFitCall={step === 'revenue' || step === 'employees'}
          />
        );
      }
      case 'vat':
      case 'invoicing':
      case 'payroll': {
        const key = step === 'vat' ? 'vatRegistered' : step === 'invoicing' ? 'xeroInvoicing' : 'needsPayroll';
        return (
          <YesNoQuestion
            copy={QUESTION_COPY[step]}
            position={questionPosition(step)}
            value={answers[key]}
            onAnswer={(v) => answerAndNext(key, v)}
            onNext={next}
            onBack={back}
            showFitCall={step === 'payroll'}
          />
        );
      }
      case 'package':
        return (
          <Step2Tiers
            services={services}
            brackets={brackets}
            tiers={tiers}
            selectedServices={state.selectedServices}
            selectedBrackets={selectedBrackets}
            selectedTier={selectedTier}
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
            onToggleAddon={toggleAddon}
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
            selectedAddons={state.selectedAddons}
            answers={answers}
            onBack={back}
            onAction={openModal}
          />
        ) : null;
    }
  }

  return (
    <>
      <PageCursorGlow>
        {/* Merged entry + steps — eyebrow and StepIndicator sit at the top of the calculator section */}
        <section
          id="pricing-summary"
          className="premium-section relative pt-14 lg:pt-20 pb-4 lg:pb-6"
        >
          <div className="max-w-[1090px] mx-auto px-6">
            <p className="text-xs font-medium uppercase tracking-widest text-primary mb-6 text-center">
              {CALCULATOR_STAGES.length} steps to your proposal
            </p>
            <StepIndicator currentStep={CALCULATOR_STAGE_OF[step]} completed={completed} />
            <div className="relative min-h-[auto] sm:min-h-[400px] lg:min-h-[500px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
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
      </PageCursorGlow>

      {showTotal && (
        <>
          <MobileTotalBar
            selectedServices={state.selectedServices}
            selectedBrackets={selectedBrackets}
            selectedTierSlug={selectedTier}
            selectedAddons={state.selectedAddons}
            tiers={tiers}
            brackets={brackets}
            summaryAnchorId="pricing-summary"
            action={step === 'addons' ? { label: 'Review', onClick: next } : undefined}
          />

          <StickyConfigChip
            selectedServices={state.selectedServices}
            selectedBrackets={selectedBrackets}
            selectedTierSlug={selectedTier}
            selectedAddons={state.selectedAddons}
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
        selectedAddons={state.selectedAddons}
        answers={answers}
        onSuccess={markCompleted}
      />
    </>
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
