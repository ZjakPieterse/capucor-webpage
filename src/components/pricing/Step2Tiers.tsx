'use client';

import { Check, Layers, TrendingUp, Zap, type LucideIcon } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { AnimatedPrice } from '@/components/ui/AnimatedPrice';
import { TestimonialSpotlight } from './TestimonialSpotlight';
import { TierComparison } from './TierComparison';
import { AnswerRecap } from './AnswerRecap';
import { cn, formatZAR } from '@/lib/utils';
import { addonTotal, bracketPrice, parseAddonToken } from '@/lib/pricing';
import { ANSWER_ADDON_SLUGS } from '@/lib/calculatorFlow';
import { TIER_HIGHLIGHTS, TIER_BUYER_FIT, TIERS_BY_APPLICATION } from '@/config/tiers';
import { FEATURED_BADGE, FEATURED_TIER } from '@/config/calculatorCopy';
import type {
  Bracket,
  Service,
  Tier,
  BracketValue,
  CalculatorAnswers,
  CalculatorStep,
  Testimonial,
} from '@/types';

// One icon per package for the card's icon-and-name lockup. Basic keeps the
// stacked layers its pill used (Zjak, 2026-10-13).
const TIER_ICONS: Record<string, LucideIcon> = {
  basic: Layers,
  pro: TrendingUp,
  premium: Zap,
};

interface Step2TiersProps {
  services: Service[];
  brackets: Bracket[];
  tiers: Tier[];
  selectedServices: Set<string>;
  selectedBrackets: Record<string, BracketValue>;
  selectedTier: string | null;
  /** Add-on tokens including the answer-driven one (the not-VAT-registered flag). */
  pricedAddons: string[];
  /** The visitor's answers, shown as tap-to-change chips. */
  answers: CalculatorAnswers;
  onEditAnswer: (step: CalculatorStep) => void;
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
  answers,
  onEditAnswer,
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
    // Slightly tighter on phones so the first price lands on the first screen.
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h2 tabIndex={-1} data-step-heading className="text-xl sm:text-2xl font-semibold mb-1 outline-none">Choose your package</h2>
        <p className="text-sm text-muted-foreground">
          Every package includes the core services. Choose how closely we work with you: how often we process, report and review.
        </p>
      </div>

      <AnswerRecap
        brackets={brackets}
        selectedBrackets={selectedBrackets}
        answers={answers}
        onEdit={onEditAnswer}
      />

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

          const featured = tier.slug === FEATURED_TIER;
          const flagship = isSelected;
          const Icon = TIER_ICONS[tier.slug] ?? Layers;

          // The service cards' language (ServicePillars.tsx, Zjak 2026-10-13):
          // an icon-and-name lockup, a lit top edge, round ticks and hairline
          // sections ending in the action row. The whole card still selects.
          const rows = (
            <>
              <span aria-hidden className="tier-card-edge" />
              {/* The recommended package's badge sits on its top edge, out of
                  the grid flow, so the subgrid rows still align (design
                  review, 2026-10-13). Text only (Zjak, 2026-10-13). */}
              {featured && (
                <span
                  aria-hidden
                  className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow-md shadow-primary/30"
                >
                  {FEATURED_BADGE}
                </span>
              )}

              {/* Row 1: icon-and-name lockup, then what the package gets */}
              <div className="pricing-card-header mb-5 flex flex-col justify-start">
                <div className="flex items-center gap-3.5">
                  <span aria-hidden className="svc-icon tier-icon">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="text-xl font-semibold leading-tight tracking-tight text-foreground">
                    {tier.name}
                  </div>
                </div>
                {(TIER_BUYER_FIT[tier.slug] ?? tier.tagline) && (
                  <div className="mt-4 text-sm leading-relaxed text-muted-foreground">
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

              {/* Row 3: Features list, below a hairline */}
              <div className="pricing-card-features flex flex-grow flex-col border-t border-white/10 pt-5">
                {filteredItems.length > 0 && (
                  <ul className="space-y-2.5">
                    {/* Every line alike, "Core Services Included" too (tweaks round 3). */}
                    {filteredItems.map((item) => (
                      <li key={item.text} className="flex items-start gap-2.5 text-[13px] leading-snug">
                        <span className="svc-check" aria-hidden>
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        <span className="text-foreground/85">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Row 4: what a click does, in the site's own button styles
                  (Zjak, 2026-10-13). Every card starts with the plain outline
                  button; only the chosen package gets the flagship style. A styled span, since
                  the whole card is already the button. */}
              <div className="pricing-card-cta mt-6">
                <span
                  aria-hidden
                  className={cn(
                    buttonVariants({ variant: flagship ? 'default' : 'outline', size: 'lg' }),
                    'w-full',
                    flagship && 'gradient-cta'
                  )}
                >
                  <span className="relative z-[2] inline-flex items-center gap-2">
                    {isSelected ? (
                      <>
                        <Check className="h-4 w-4" strokeWidth={3} /> Selected
                      </>
                    ) : (
                      <>Choose {tier.name}</>
                    )}
                  </span>
                </span>
              </div>
            </>
          );

          return (
            <button
              key={tier.slug}
              type="button"
              onClick={() => onTierSelect(tier.slug)}
              aria-pressed={isSelected}
              aria-label={`${tier.name} package${featured ? `, ${FEATURED_BADGE.toLowerCase()}` : ''}`}
              aria-describedby={`tier-price-${tier.slug}`}
              className={cn(
                'service-card pricing-card-item tier-card relative min-w-0 rounded-2xl border-2 p-6 text-left outline-none w-full h-full flex flex-col',
                // The recommended package carries the lit border and glow
                // until another package is chosen (Zjak, 2026-10-13); its
                // badge stays.
                featured && (!selectedTier || isSelected) && 'popular-card',
                'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2',
                isSelected
                  ? 'is-selected border-primary bg-primary/10 backdrop-blur-md shadow-lg shadow-primary/10'
                  : 'premium-glass border-white/10'
              )}
            >
              {rows}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!selectedTier}
          className={cn('gap-2', selectedTier && 'cta-armed')}
        >
          Continue to add-ons →
        </Button>
      </div>

      {/* Below the buttons and open by default (tweaks round 1). */}
      <TierComparison
        tiers={tiers}
        selectedServices={selectedServices}
        defaultOpen
      />

      {testimonial && (
        <div className="pt-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">From a Capucor client</p>
          <TestimonialSpotlight testimonial={testimonial} />
        </div>
      )}
    </div>
  );
}
