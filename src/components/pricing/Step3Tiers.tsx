'use client';

import { ArrowRight, Check, CornerDownRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedPrice } from '@/components/ui/AnimatedPrice';
import { TestimonialSpotlight } from './TestimonialSpotlight';
import { TierComparison } from './TierComparison';
import { RiskReducerStrip } from './RiskReducerStrip';
import { cn } from '@/lib/utils';
import { bracketPrice } from '@/lib/pricing';
import { useCursorGlow } from '@/hooks/useCursorGlow';
import { MagneticButton } from '@/components/ui/MagneticButton';
import { TIER_HIGHLIGHTS, TIER_CUMULATIVE_LABELS } from '@/config/tiers';
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
          Choose the level of support that matches your business goals. Remember, there are no lock-in contracts, just pure support.
        </p>
      </div>

      <RiskReducerStrip />

      <div ref={containerRef} className="cursor-glow grid sm:grid-cols-3 gap-3 sm:pt-5">
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

          return (
            <button
              key={tier.slug}
              type="button"
              onClick={() => onTierSelect(tier.slug)}
              aria-pressed={isSelected}
              aria-label={`${isSelected ? 'Selected ' : ''}${tier.name} tier`}
              className={cn(
                'service-card relative rounded-xl border-2 p-5 pr-11 text-left outline-none w-full',
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

              <div className="mb-4" style={{ minHeight: '3.75rem' }}>
                <div className="font-semibold text-base">{tier.name}</div>
                {tier.tagline && (
                  <div
                    className="text-xs text-muted-foreground mt-0.5"
                    style={{ minHeight: '2rem' }}
                  >
                    {tier.tagline}
                  </div>
                )}
              </div>

              <div className="mb-4">
                <AnimatedPrice amount={regularTotal} size="lg" />
                <div className="text-xs text-muted-foreground mt-0.5">/month</div>
              </div>

              {cumulativeLabel && (
                <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <CornerDownRight className="h-3 w-3 text-primary" />
                  {cumulativeLabel}
                </div>
              )}

              {filteredItems.length > 0 && (
                <ul className="space-y-1.5">
                  {filteredItems.map((item) => (
                    <li key={item.text} className="flex items-start gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                      <span className="text-muted-foreground">{item.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
      </div>

      {selectedTier && (
        <div className="rounded-xl border border-primary/30 bg-primary/[0.08] backdrop-blur-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-primary/10">
          <div>
            <p className="font-semibold text-sm">Your subscription is ready.</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              A few details, then a secure Paystack checkout. Cancel any time with 30 days notice.
            </p>
          </div>
          <MagneticButton>
            <Button onClick={onActivate} className="shrink-0 gap-2 cta-armed">
              Activate
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
