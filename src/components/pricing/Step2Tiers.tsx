'use client';

import { ArrowLeft, ArrowRight, Check, CornerDownRight, Layers, TrendingUp, Zap, type LucideIcon } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { AnimatedPrice } from '@/components/ui/AnimatedPrice';
import { TestimonialSpotlight } from './TestimonialSpotlight';
import { TierComparison } from './TierComparison';
import { AnswerRecap } from './AnswerRecap';
import { cn, formatZAR } from '@/lib/utils';
import { addonTotal, bracketPrice, parseAddonToken } from '@/lib/pricing';
import { ANSWER_ADDON_SLUGS } from '@/lib/calculatorFlow';
import { TIER_BUYER_FIT, TIER_CARD_LEAD, TIERS_BY_APPLICATION, tierCardLines } from '@/config/tiers';
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
          Every package covers the essentials. Choose the level of support and insight that best fits your business.
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

          const lead = TIER_CARD_LEAD[tier.slug];
          const filteredItems = tierCardLines(tier.slug).filter((item) =>
            item.services.some((s) => selectedServices.has(s))
          );

          const featured = tier.slug === FEATURED_TIER;
          const flagship = isSelected;
          const Icon = TIER_ICONS[tier.slug] ?? Layers;

          // The service cards' language (ServicePillars.tsx, Zjak 2026-10-13):
          // an icon-and-name lockup, a lit top edge, round ticks and hairline
          // sections ending in the action row. The card is an article and the
          // action row a real button whose ::after covers the card, so the
          // whole card still selects while the inclusions read as a normal
          // list (design review D2).
          const rows = (
            <>
              <span aria-hidden className="tier-card-edge" />
              {/* The recommended package's badge sits on its top edge, out of
                  the grid flow, so the subgrid rows still align (design
                  review, 2026-10-13). Text only (Zjak, 2026-10-13). */}
              {featured && (
                <span className="pointer-events-none absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow-md shadow-primary/30">
                  {FEATURED_BADGE}
                </span>
              )}

              {/* Row 1: icon-and-name lockup, then what the package gets */}
              <div className="pricing-card-header mb-4 lg:mb-5 flex flex-col justify-start">
                <div className="flex items-center gap-3.5">
                  <span aria-hidden className="svc-icon tier-icon">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 id={`tier-name-${tier.slug}`} className="text-xl font-semibold leading-tight tracking-tight text-foreground">
                    {tier.name}
                  </h3>
                </div>
                {(TIER_BUYER_FIT[tier.slug] ?? tier.tagline) && (
                  <div className="mt-3 lg:mt-4 text-sm leading-relaxed text-muted-foreground">
                    {TIER_BUYER_FIT[tier.slug] ?? tier.tagline}
                  </div>
                )}
              </div>

              {/* Row 2: Pricing (Price / Period); "from" for a package sold by application */}
              <div className="pricing-card-price mb-4 lg:mb-5 flex flex-col">
                {/* "From" sits on its own line so the price and /month never wrap
                    apart; other cards reserve the line so prices stay aligned. */}
                <span
                  aria-hidden
                  className={cn('text-xs text-muted-foreground', !byApplication && 'invisible')}
                >
                  From
                </span>
                <div aria-hidden className="flex items-baseline gap-1.5">
                  <AnimatedPrice amount={displayTotal} size="lg" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">/month</span>
                </div>
                {/* The animated figure is not reliable for screen readers, so
                    they get this plain-text price instead (the card's button
                    is described by it too). */}
                <span id={`tier-price-${tier.slug}`} className="sr-only">
                  {`${byApplication ? 'From ' : ''}${formatZAR(displayTotal)} a month`}
                </span>
              </div>

              {/* Row 3: Features list, below a hairline (back to the single
                  line under the price, Zjak, 2026-10-25). */}
              <div className="pricing-card-features flex flex-grow flex-col border-t border-white/10 pt-4 lg:pt-5">
                {/* Pro and Premium build on the package below (Zjak, package
                    step value, 2026-10-25): the earlier cumulative-label chip,
                    neutral under the cyan rule. Every card starts its list on
                    the same line. */}
                {lead && (
                  <p className="tier-card-lead mb-3 inline-flex w-fit items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-foreground">
                    <CornerDownRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    {lead}
                  </p>
                )}
                {filteredItems.length > 0 && (
                  <ul className="space-y-3">
                    {/* Every line alike, "Core services included" and the
                        cadence words too, a little more air between lines
                        (Zjak, 2026-10-25). */}
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

              {/* Row 4: the card's one control, in the site's own button styles
                  (Zjak, 2026-10-13). Every card starts with the plain outline
                  look; only the chosen package gets the flagship style. The
                  real <button> is unstyled and static, so its ::after
                  (.tier-card-choose) stretches over the whole card; the look
                  is the inner span, which keeps the hover lift and shine. */}
              <div className="pricing-card-cta mt-5 lg:mt-6">
                <button
                  type="button"
                  onClick={() => onTierSelect(tier.slug)}
                  aria-pressed={isSelected}
                  aria-describedby={`tier-price-${tier.slug}`}
                  className="tier-card-choose block w-full outline-none"
                >
                  <span
                    className={cn(
                      buttonVariants({ variant: flagship ? 'default' : 'outline', size: 'lg' }),
                      'w-full backdrop-blur-none',
                      flagship && 'gradient-cta'
                    )}
                  >
                    <span className="relative z-[2] inline-flex items-center gap-2">
                      {isSelected ? (
                        <>
                          <Check aria-hidden className="h-4 w-4" strokeWidth={3} /> Selected
                          <span className="sr-only">: {tier.name}</span>
                        </>
                      ) : (
                        <>Choose {tier.name}</>
                      )}
                    </span>
                  </span>
                </button>
              </div>
            </>
          );

          return (
            <article
              key={tier.slug}
              aria-labelledby={`tier-name-${tier.slug}`}
              className={cn(
                'service-card pricing-card-item tier-card relative min-w-0 rounded-2xl border-2 p-5 lg:p-6 text-left w-full h-full flex flex-col',
                // The recommended package carries the lit border and glow
                // until another package is chosen (Zjak, 2026-10-13); its
                // badge stays.
                featured && (!selectedTier || isSelected) && 'popular-card',
                isSelected
                  ? 'is-selected border-primary bg-primary/10 shadow-lg shadow-primary/10'
                  : 'premium-glass border-white/10'
              )}
            >
              {rows}
            </article>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button variant="outline" size="lg" onClick={onBack}>
          <ArrowLeft aria-hidden /> Back
        </Button>
        {/* Choosing a package moves on by itself, so Continue appears only
            when the visitor comes back with one chosen: no disabled button
            on the first visit (design review D3). */}
        {selectedTier && (
          <Button size="lg" onClick={onNext} className="gap-2 cta-armed">
            Continue to add-ons <ArrowRight aria-hidden />
          </Button>
        )}
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
