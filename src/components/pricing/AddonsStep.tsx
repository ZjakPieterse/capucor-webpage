'use client';

import { Check, Plus, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedPrice } from '@/components/ui/AnimatedPrice';
import { cn, formatZAR } from '@/lib/utils';
import { addonTotal, monthlyTotal } from '@/lib/pricing';
import { PRICING_ADDONS, addonIncludedInTier, tierDisplayName } from '@/config/tiers';
import { DEXT_ACCESS_COPY } from '@/config/calculatorCopy';
import type { Bracket, BracketValue } from '@/types';

interface AddonsStepProps {
  brackets: Bracket[];
  selectedServices: Set<string>;
  selectedBrackets: Record<string, BracketValue>;
  selectedTier: string;
  selectedAddons: string[];
  onToggleAddon: (slug: string) => void;
  onBack: () => void;
  onNext: () => void;
}

// Phase 1 offers Dext only. The access-only wording for Basic lives in
// config/calculatorCopy.ts, not PRICING_ADDONS (tiers.ts is digest-pinned).
const DEXT = PRICING_ADDONS.find((a) => a.slug === 'dext');

export function AddonsStep({
  brackets,
  selectedServices,
  selectedBrackets,
  selectedTier,
  selectedAddons,
  onToggleAddon,
  onBack,
  onNext,
}: AddonsStepProps) {
  const packageTotal = monthlyTotal([...selectedServices], selectedBrackets, selectedTier, brackets);
  const runningTotal = packageTotal + addonTotal(selectedAddons, selectedTier);
  const tierName = tierDisplayName(selectedTier);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold mb-1.5">Add what you need</h2>
        <p className="text-sm text-muted-foreground">
          Optional extras on a flat monthly fee. Your total updates as you choose.
        </p>
      </div>

      {DEXT && (
        <DextCard
          priceZAR={DEXT.priceZAR}
          tierSlug={selectedTier}
          included={addonIncludedInTier(DEXT, selectedTier)}
          isOn={selectedAddons.includes(DEXT.slug)}
          onToggle={() => onToggleAddon(DEXT.slug)}
        />
      )}

      <div
        className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-5 flex items-baseline justify-between gap-4"
        aria-live="polite"
      >
        <div>
          <p className="text-sm font-semibold">Your monthly total</p>
          <p className="text-xs text-muted-foreground mt-0.5">{tierName} package and add-ons</p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <AnimatedPrice amount={runningTotal} size="lg" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">/month</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onNext} className="gap-2 cta-armed">
          Review →
        </Button>
      </div>
    </div>
  );
}

interface DextCardProps {
  priceZAR: number;
  tierSlug: string;
  included: boolean;
  isOn: boolean;
  onToggle: () => void;
}

function DextCard({ priceZAR, tierSlug, included, isOn, onToggle }: DextCardProps) {
  const title = included ? DEXT_ACCESS_COPY.includedTitle : DEXT_ACCESS_COPY.basicTitle;
  const body = included ? DEXT_ACCESS_COPY.includedBody : DEXT_ACCESS_COPY.basicBody;
  const active = included || isOn;

  const content = (
    <div className="flex items-start gap-3.5">
      <div
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-200',
          active ? 'bg-primary/15' : 'bg-muted'
        )}
      >
        <ReceiptText className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
        <div className="mt-2.5 flex items-baseline gap-1">
          {included ? (
            <span className="text-xs font-semibold text-primary">
              Included in {tierDisplayName(tierSlug)}
            </span>
          ) : (
            <>
              <span className="font-mono text-sm font-bold whitespace-nowrap">{formatZAR(priceZAR)}</span>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">/month</span>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // Included in the package: nothing to choose, so a plain card, not a button.
  if (included) {
    return (
      <div className="relative rounded-2xl border-2 border-primary/40 bg-primary/[0.06] backdrop-blur-md p-4 sm:p-5">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isOn}
      aria-label={`${isOn ? 'Remove' : 'Add'} ${title}`}
      className={cn(
        'service-card relative w-full rounded-2xl border-2 p-4 pr-14 sm:p-5 sm:pr-16 text-left outline-none',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2',
        isOn
          ? 'is-selected border-primary bg-primary/10 backdrop-blur-md shadow-lg shadow-primary/10'
          : 'border-border bg-card/40 backdrop-blur-md'
      )}
    >
      <span aria-hidden className={cn('service-card-toggle', isOn && 'is-selected')}>
        {isOn ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
      </span>
      {content}
    </button>
  );
}
