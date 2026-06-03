'use client';

import { ArrowRight, Check, CornerDownRight, Layers, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedPrice } from '@/components/ui/AnimatedPrice';
import { TestimonialSpotlight } from './TestimonialSpotlight';
import { TierComparison } from './TierComparison';
import { RiskReducerStrip } from './RiskReducerStrip';
import { cn } from '@/lib/utils';
import { bracketPrice } from '@/lib/pricing';
import { useCursorGlow } from '@/hooks/useCursorGlow';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { TIER_HIGHLIGHTS, TIER_CUMULATIVE_LABELS, TIER_BUYER_FIT } from '@/config/tiers';
import type { Bracket, Service, Tier, BracketValue, Testimonial } from '@/types';

interface Step3TiersProps {
  services: Service[];
  brackets: Bracket[];
  tiers: Tier[];
  selectedServices: Set<string>;
  selectedBrackets: Record<string, BracketValue>;
  selectedTier: string | null;
  onTierSelect: (slug: string) => void;
  onBack: () => void;
  onActivate: () => void;
  testimonial?: Testimonial | null;
}

export function Step3Tiers({
  services,
  brackets,
  tiers,
  selectedServices,
  selectedBrackets,
  selectedTier,
  onTierSelect,
  onBack,
  onActivate,
  testimonial,
}: Step3TiersProps) {
  const sortedTiers = [...tiers].sort((a, b) => a.display_order - b.display_order);
  const activeServices = services.filter((s) => selectedServices.has(s.slug));
  const containerRef = useCursorGlow<HTMLDivElement>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Pick the perfect fit for your growth.</h2>
        <p className="text-sm text-muted-foreground">
          Click on the level of support that matches your business goals. Remember, there are no lock-in contracts, just pure support.
        </p>
      </div>

      <RiskReducerStrip />

      <div
        ref={containerRef}
        className="cursor-glow grid grid-cols-1 gap-4 sm:gap-6 sm:pt-5 pricing-grid-container"
      >
        {sortedTiers.map((tier) => {
          const isSelected = selectedTier === tier.slug;

          const regularTotal = activeServices.reduce((sum, svc) => {
            const sel = selectedBrackets[svc.slug];
            if (typeof sel !== 'number') return sum;
            const b = brackets.find((x) => x.service_slug === svc.slug && x.ordinal === sel);
            return sum + (b ? bracketPrice(b, tier.slug) : 0);
          }, 0);

          const filteredItems = (TIER_HIGHLIGHTS[tier.slug] ?? []).filter((item) =>
            item.services.some((s) => selectedServices.has(s))
          );
          const cumulativeLabel = TIER_CUMULATIVE_LABELS[tier.slug];
          const CumulativeIcon = tier.slug === 'basic' ? Layers : CornerDownRight;

          return (
            <button
              key={tier.slug}
              type="button"
              onClick={() => onTierSelect(tier.slug)}
              aria-pressed={isSelected}
              aria-label={`${isSelected ? 'Selected ' : ''}${tier.name} tier`}
              className={cn(
                'service-card pricing-card-item relative rounded-2xl border-2 p-6 pr-12 text-left outline-none w-full h-full flex flex-col',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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

              {/* Row 1: Header (Title & Tagline) */}
              <div className="pricing-card-header mb-4 flex flex-col justify-start">
                <div className="font-bold text-lg tracking-tight text-foreground">{tier.name}</div>
                {(TIER_BUYER_FIT[tier.slug] ?? tier.tagline) && (
                  <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    {TIER_BUYER_FIT[tier.slug] ?? tier.tagline}
                  </div>
                )}
              </div>

              {/* Row 2: Pricing (Price / Period) */}
              <div className="pricing-card-price mb-5 flex items-baseline gap-1.5">
                <AnimatedPrice amount={regularTotal} size="lg" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">/month</span>
              </div>

              {/* Row 3: Cumulative additions label */}
              <div className="pricing-card-cumulative mb-3 flex items-center min-h-[1.75rem]">
                {cumulativeLabel ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground bg-primary/5 border border-primary/10 rounded-md px-2.5 py-1 w-fit">
                    <CumulativeIcon className="h-3.5 w-3.5 text-primary shrink-0" />
                    {cumulativeLabel}
                  </div>
                ) : (
                  // Invisible placeholder to occupy track space in subgrid layout
                  <div className="h-0 w-0 pointer-events-none opacity-0" aria-hidden="true" />
                )}
              </div>

              {/* Row 4: Features List */}
              <div className="pricing-card-features flex-grow">
                {filteredItems.length > 0 && (
                  <ul className="space-y-2.5">
                    {filteredItems.map((item) => (
                      <li key={item.text} className="flex items-start gap-2.5 text-xs">
                        <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                        <span className="text-muted-foreground leading-normal">{item.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedTier && (
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.08] backdrop-blur-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-primary/10">
          <div>
            <p className="font-semibold text-sm">Your subscription is ready.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add a few details and we&rsquo;ll email you a proposal to review and sign. No payment needed yet, and you can cancel any time with 30 days notice.
            </p>
          </div>
          <MagneticButton>
            <Button onClick={onActivate} className="shrink-0 gap-2 cta-armed">
              Get my proposal
              <ArrowRight className="h-4 w-4" />
            </Button>
          </MagneticButton>
        </div>
      )}

      <TierComparison
        tiers={tiers}
        brackets={brackets}
        selectedServices={selectedServices}
        selectedBrackets={selectedBrackets}
      />

      {testimonial && (
        <div className="pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            From a Capucor client
          </p>
          <TestimonialSpotlight testimonial={testimonial} />
        </div>
      )}

      <div className="flex justify-start pt-2">
        <MagneticButton>
          <Button variant="outline" onClick={onBack}>
            ← Back
          </Button>
        </MagneticButton>
      </div>
    </div>
  );
}
