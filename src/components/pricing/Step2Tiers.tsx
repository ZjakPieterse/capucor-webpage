'use client';

import { CalendarClock, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedPrice } from '@/components/ui/AnimatedPrice';
import { TestimonialSpotlight } from './TestimonialSpotlight';
import { TierComparison } from './TierComparison';
import { CoreServicesPanel } from './CoreServicesPanel';
import { AnswerRecap } from './AnswerRecap';
import { TierNudge } from './TierNudge';
import { cn, formatZAR } from '@/lib/utils';
import { addonTotal, bracketPrice, parseAddonToken } from '@/lib/pricing';
import { ANSWER_ADDON_SLUGS } from '@/lib/calculatorFlow';
import { siteConfig } from '@/config/site';
import {
  TIER_HIGHLIGHTS,
  TIER_BUYER_FIT,
  TIERS_BY_APPLICATION,
  packageCommonItemsFor,
} from '@/config/tiers';
import { REVENUE_CALL_COPY, TIER_NUDGES } from '@/config/calculatorCopy';
import type {
  Bracket,
  Service,
  Tier,
  BracketValue,
  CalculatorAnswers,
  CalculatorStep,
  Testimonial,
} from '@/types';

interface Step2TiersProps {
  services: Service[];
  brackets: Bracket[];
  tiers: Tier[];
  selectedServices: Set<string>;
  selectedBrackets: Record<string, BracketValue>;
  selectedTier: string | null;
  /** Add-on tokens including the answer-driven one (the not-VAT-registered flag). */
  pricedAddons: string[];
  /** False only on a VAT "No": hides VAT201 from the core services. */
  vatRegistered: boolean;
  /** The visitor's answers, shown as tap-to-change chips. */
  answers: CalculatorAnswers;
  onEditAnswer: (step: CalculatorStep) => void;
  /** Revenue above R50m: every package goes to a call, none is selectable. */
  byCall?: boolean;
  onTierSelect: (slug: string) => void;
  onBack: () => void;
  onNext: () => void;
  testimonial?: Testimonial | null;
}

export function Step2Tiers({
  services,
  brackets,
  tiers,
  selectedServices,
  selectedBrackets,
  selectedTier,
  pricedAddons,
  vatRegistered,
  answers,
  onEditAnswer,
  byCall = false,
  onTierSelect,
  onBack,
  onNext,
  testimonial,
}: Step2TiersProps) {
  const sortedTiers = [...tiers].sort((a, b) => a.display_order - b.display_order);
  const activeServices = services.filter((s) => selectedServices.has(s.slug));
  // Only the answer-driven add-ons belong in the card price (today only the
  // zero-price VAT flag); chosen add-ons wait for the next step.
  const answerAddons = pricedAddons.filter((t) => ANSWER_ADDON_SLUGS.has(parseAddonToken(t).slug));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold mb-1">Choose your package</h2>
        <p className="text-sm text-muted-foreground">
          Every package includes the core services. They differ in how often we process, report and review.
        </p>
      </div>

      <AnswerRecap
        brackets={brackets}
        selectedBrackets={selectedBrackets}
        answers={answers}
        onEdit={onEditAnswer}
      />

      <CoreServicesPanel items={packageCommonItemsFor(vatRegistered)} />

      {byCall && (
        <div
          role="note"
          className="rounded-xl border border-primary/30 bg-primary/[0.06] px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-foreground/90">{REVENUE_CALL_COPY.note}</p>
          <Button
            nativeButton={false}
            variant="outline"
            className="shrink-0 gap-2"
            render={<a href={siteConfig.links.booking} target="_blank" rel="noopener noreferrer" />}
          >
            <CalendarClock className="h-4 w-4" />
            {REVENUE_CALL_COPY.action}
          </Button>
        </div>
      )}

      <div
        className="grid grid-cols-1 gap-4 sm:gap-6 sm:pt-5 pricing-grid-container"
      >
        {sortedTiers.map((tier) => {
          const isSelected = selectedTier === tier.slug;
          const byApplication = TIERS_BY_APPLICATION.includes(tier.slug);

          const regularTotal = activeServices.reduce((sum, svc) => {
            const sel = selectedBrackets[svc.slug];
            if (typeof sel !== 'number') return sum;
            const b = brackets.find((x) => x.service_slug === svc.slug && x.ordinal === sel);
            return sum + (b ? bracketPrice(b, tier.slug) : 0);
          }, 0);
          // All-in monthly price for the package: core plus payroll, plus the
          // answer-driven add-ons. Chosen add-ons come on the next step.
          const displayTotal = regularTotal + addonTotal(answerAddons, tier.slug);

          const filteredItems = (TIER_HIGHLIGHTS[tier.slug] ?? []).filter((item) =>
            item.services.some((s) => selectedServices.has(s))
          );

          const rows = (
            <>
              {/* Row 1: Header (name and buyer fit) */}
              <div className="pricing-card-header mb-4 flex flex-col justify-start">
                <div className="font-bold text-lg tracking-tight text-foreground">{tier.name}</div>
                {(TIER_BUYER_FIT[tier.slug] ?? tier.tagline) && (
                  <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    {TIER_BUYER_FIT[tier.slug] ?? tier.tagline}
                  </div>
                )}
              </div>

              {/* Row 2: Pricing (Price / Period); "from" for a package sold by application */}
              <div className="pricing-card-price mb-5 flex flex-col">
                {/* "From" sits on its own line so the price and /month never wrap
                    apart; other cards reserve the line so prices stay aligned. */}
                <span
                  className={cn('text-xs text-muted-foreground', !byApplication && 'invisible')}
                  aria-hidden={!byApplication}
                >
                  From
                </span>
                <div className="flex items-baseline gap-1.5">
                  <AnimatedPrice amount={displayTotal} size="lg" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">/month</span>
                </div>
                {/* The animated figure is not a reliable accessible name, so
                    the card is described by this plain-text price. */}
                <span id={`tier-price-${tier.slug}`} className="sr-only">
                  {`${byApplication ? 'From ' : ''}${formatZAR(displayTotal)} a month`}
                </span>
              </div>

              {/* Row 3: Nudge pill; the row is kept for subgrid alignment */}
              <div className="pricing-card-cumulative mb-3 flex items-center min-h-[1.75rem]">
                {TIER_NUDGES[tier.slug] ? (
                  <TierNudge tierSlug={tier.slug} />
                ) : (
                  <div className="h-0 w-0 pointer-events-none opacity-0" aria-hidden="true" />
                )}
              </div>

              {/* Row 4: Features list */}
              <div className="pricing-card-features flex-grow flex flex-col gap-5">
                {filteredItems.length > 0 && (
                  <ul className="space-y-2.5">
                    {/* Every line alike, "Core Services Included" too (tweaks round 3). */}
                    {filteredItems.map((item) => (
                      <li key={item.text} className="flex items-start gap-2.5 text-xs">
                        <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                        <span className="text-muted-foreground leading-normal">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          );

          // Above R50m in revenue no package is selectable.
          if (byCall) {
            return (
              <div
                key={tier.slug}
                className="pricing-card-item relative min-w-0 rounded-2xl border-2 border-border bg-card/40 backdrop-blur-md p-6 text-left w-full h-full flex flex-col"
              >
                {rows}
              </div>
            );
          }

          return (
            <button
              key={tier.slug}
              type="button"
              onClick={() => onTierSelect(tier.slug)}
              aria-pressed={isSelected}
              aria-label={`${tier.name} package`}
              aria-describedby={`tier-price-${tier.slug}`}
              className={cn(
                'service-card pricing-card-item relative min-w-0 rounded-2xl border-2 p-6 pr-12 text-left outline-none w-full h-full flex flex-col',
                'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2',
                isSelected
                  ? 'is-selected border-primary bg-primary/10 backdrop-blur-md shadow-lg shadow-primary/10'
                  : 'border-border bg-card/40 backdrop-blur-md'
              )}
            >
              <span
                aria-hidden
                className={cn('service-card-toggle', isSelected && 'is-selected')}
              >
                {isSelected ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : (
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                )}
              </span>
              {rows}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        {byCall ? (
          <Button
            nativeButton={false}
            className="gap-2 cta-armed"
            render={<a href={siteConfig.links.booking} target="_blank" rel="noopener noreferrer" />}
          >
            <CalendarClock className="h-4 w-4" />
            {REVENUE_CALL_COPY.action}
          </Button>
        ) : (
          <Button
            onClick={onNext}
            disabled={!selectedTier}
            className={cn('gap-2', selectedTier && 'cta-armed')}
          >
            Continue to add-ons →
          </Button>
        )}
      </div>

      {/* Below the buttons and open by default (tweaks round 1). */}
      <TierComparison
        tiers={tiers}
        brackets={brackets}
        selectedServices={selectedServices}
        selectedBrackets={selectedBrackets}
        selectedAddons={answerAddons}
        vatRegistered={vatRegistered}
        defaultOpen
      />

      {testimonial && (
        <div className="pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            From a Capucor client
          </p>
          <TestimonialSpotlight testimonial={testimonial} />
        </div>
      )}
    </div>
  );
}
