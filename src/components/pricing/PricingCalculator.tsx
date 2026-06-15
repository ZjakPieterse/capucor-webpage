'use client';

import { Suspense, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BadgeCheck } from 'lucide-react';
import { canProceedScopeStep, usePricingState } from '@/hooks/usePricingState';
import { siteConfig } from '@/config/site';
import { SectionDivider } from '@/components/ui/SectionDivider';
import { PageCursorGlow } from '@/components/landing/PageCursorGlow';
import { StepIndicator } from './StepIndicator';
import { Step1Scope } from './Step1Scope';
import { Step2Tiers } from './Step2Tiers';
import { ActivateProposalModal } from './ActivateProposalModal';
import { MobileTotalBar } from './MobileTotalBar';
import { StickyConfigChip } from './StickyConfigChip';
import type { PricingData, Testimonial } from '@/types';

interface PricingCalculatorProps {
  data: PricingData;
  testimonials?: Testimonial[];
}

const TRUST_ITEMS = [
  'SARS Registered',
  'Fixed Monthly Pricing',
  'No Lock-in Contracts',
  'Dedicated Finance Team',
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

function PricingCalculatorInner({ data, testimonials = [] }: PricingCalculatorProps) {
  const { services, brackets, tiers } = data;
  const spotlightTestimonial = testimonials[0] ?? null;

  const {
    state,
    completed,
    markCompleted,
    setStep,
    setStepBack,
    setBracket,
    setTier,
    toggleAddon,
    canProceedStep2,
  } = usePricingState();

  // "Every question answered, at least one priced" — needs the service list
  // from Supabase, so it lives here rather than in the hook.
  const canProceedStep1 = canProceedScopeStep(
    services.map((s) => s.slug),
    state.selectedBrackets
  );

  const [activateOpen, setActivateOpen] = useState(false);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const goForward = (step: 2) => {
    setStep(step);
    scrollToTop();
  };

  const goBack = (step: 1) => {
    setStepBack(step);
    scrollToTop();
  };

  // "Activate" no longer routes to payment — it opens the proposal modal.
  const openActivateModal = () => {
    if (canProceedStep2) setActivateOpen(true);
  };

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
              3 steps to your monthly price
            </p>
            <StepIndicator currentStep={state.step} completed={completed} />
            <div className="relative min-h-[auto] sm:min-h-[400px] lg:min-h-[500px]">
              <AnimatePresence mode="wait">
                {state.step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Step1Scope
                      services={services}
                      brackets={brackets}
                      selectedBrackets={state.selectedBrackets}
                      onBracketChange={setBracket}
                      onNext={() => {
                        if (canProceedStep1) goForward(2);
                      }}
                      canProceed={canProceedStep1}
                    />
                  </motion.div>
                )}

                {state.step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Step2Tiers
                      services={services}
                      brackets={brackets}
                      tiers={tiers}
                      selectedServices={state.selectedServices}
                      selectedBrackets={state.selectedBrackets}
                      selectedTier={state.selectedTier}
                      selectedAddons={state.selectedAddons}
                      onTierSelect={setTier}
                      onToggleAddon={toggleAddon}
                      onBack={() => goBack(1)}
                      onActivate={openActivateModal}
                      testimonial={spotlightTestimonial}
                    />
                  </motion.div>
                )}
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

      <MobileTotalBar
        selectedServices={state.selectedServices}
        selectedBrackets={state.selectedBrackets}
        selectedTierSlug={state.selectedTier}
        selectedAddons={state.selectedAddons}
        tiers={tiers}
        brackets={brackets}
        summaryAnchorId="pricing-summary"
        onActivate={openActivateModal}
      />

      <StickyConfigChip
        selectedServices={state.selectedServices}
        selectedBrackets={state.selectedBrackets}
        selectedTierSlug={state.selectedTier}
        selectedAddons={state.selectedAddons}
        tiers={tiers}
        brackets={brackets}
        observeElementId="pricing-summary"
        scrollToId="pricing-summary"
      />

      <ActivateProposalModal
        open={activateOpen}
        onOpenChange={setActivateOpen}
        services={services}
        brackets={brackets}
        tiers={tiers}
        selectedServices={state.selectedServices}
        selectedBrackets={state.selectedBrackets}
        selectedTier={state.selectedTier}
        selectedAddons={state.selectedAddons}
        onSuccess={markCompleted}
      />
    </>
  );
}

// Wrap in Suspense for useSearchParams
export function PricingCalculator({ data, testimonials }: PricingCalculatorProps) {
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
      <PricingCalculatorInner data={data} testimonials={testimonials} />
    </Suspense>
  );
}
