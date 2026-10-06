'use client';

import { Check, MessageCircle, Minus, Plus, ReceiptText, Tags, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedPrice } from '@/components/ui/AnimatedPrice';
import { cn, formatZAR } from '@/lib/utils';
import { addonTotal, monthlyTotal, resolveAddons } from '@/lib/pricing';
import {
  PRICING_ADDONS,
  addonIncludedInTier,
  tierDisplayName,
  type PricingAddon,
} from '@/config/tiers';
import { DEXT_ACCESS_COPY } from '@/config/calculatorCopy';
import type { Bracket, BracketValue } from '@/types';

interface AddonsStepProps {
  brackets: Bracket[];
  selectedServices: Set<string>;
  selectedBrackets: Record<string, BracketValue>;
  selectedTier: string;
  /** The visitor's own add-on choices (tokens), for the toggles. */
  selectedAddons: string[];
  /** The same plus the answer-driven tokens (Xero invoicing), for the total. */
  pricedAddons: string[];
  onToggleAddon: (slug: string) => void;
  onSetQuantity: (slug: string, quantity: number) => void;
  onBack: () => void;
  onNext: () => void;
}

const ICONS: Record<string, React.ElementType> = {
  dext: ReceiptText,
  'whatsapp-support': MessageCircle,
  'category-tracking': Tags,
  'personal-tax': UserRound,
};

// Hidden add-ons (Xero invoicing, the VAT flag) come from answers, not choices.
const OFFERED = PRICING_ADDONS.filter((a) => !a.hidden);

export function AddonsStep({
  brackets,
  selectedServices,
  selectedBrackets,
  selectedTier,
  selectedAddons,
  pricedAddons,
  onToggleAddon,
  onSetQuantity,
  onBack,
  onNext,
}: AddonsStepProps) {
  const packageTotal = monthlyTotal([...selectedServices], selectedBrackets, selectedTier, brackets);
  const runningTotal = packageTotal + addonTotal(pricedAddons, selectedTier);
  const quantities = new Map(resolveAddons(selectedAddons).map((s) => [s.addon.slug, s.quantity]));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold mb-1.5">Add what you need</h2>
        <p className="text-sm text-muted-foreground">
          Optional extras on a monthly fee. Your total updates as you choose.
        </p>
      </div>

      <div className="space-y-3">
        {OFFERED.map((addon) => (
          <AddonCard
            key={addon.slug}
            addon={addon}
            tierSlug={selectedTier}
            quantity={quantities.get(addon.slug) ?? null}
            onToggle={() => onToggleAddon(addon.slug)}
            onSetQuantity={(q) => onSetQuantity(addon.slug, q)}
          />
        ))}
      </div>

      <div
        className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-5 flex items-baseline justify-between gap-4"
        aria-live="polite"
      >
        <div>
          <p className="text-sm font-semibold">Your monthly total</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tierDisplayName(selectedTier)} package and add-ons
          </p>
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

interface AddonCardProps {
  addon: PricingAddon;
  tierSlug: string;
  /** Null when not selected; the count (1 for a flat add-on) when selected. */
  quantity: number | null;
  onToggle: () => void;
  onSetQuantity: (quantity: number) => void;
}

function AddonCard({ addon, tierSlug, quantity, onToggle, onSetQuantity }: AddonCardProps) {
  const included = addonIncludedInTier(addon, tierSlug);
  const isOn = quantity !== null;
  const active = included || isOn;
  const Icon = ICONS[addon.slug] ?? ReceiptText;

  // Dext reads differently by package: access only on Basic (the client does
  // the processing), included and processed by Capucor from Pro.
  const isDext = addon.slug === 'dext';
  const title = isDext ? (included ? DEXT_ACCESS_COPY.includedTitle : DEXT_ACCESS_COPY.basicTitle) : addon.name;
  const body = isDext ? (included ? DEXT_ACCESS_COPY.includedBody : DEXT_ACCESS_COPY.basicBody) : addon.description;

  const price = included ? (
    <span className="text-xs font-semibold text-primary">Included in {tierDisplayName(tierSlug)}</span>
  ) : (
    <>
      <span className="font-mono text-sm font-bold whitespace-nowrap">{formatZAR(addon.priceZAR)}</span>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
        /month{addon.unit ? ` per ${addon.unit.singular}` : ''}
      </span>
    </>
  );

  const content = (
    <div className="flex items-start gap-3.5">
      <div
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-200',
          active ? 'bg-primary/15' : 'bg-muted'
        )}
      >
        <Icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{body}</p>
        <div className="mt-2.5 flex items-baseline gap-1">{price}</div>
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
    <div
      className={cn(
        'relative rounded-2xl border-2 backdrop-blur-md',
        isOn ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10' : 'border-border bg-card/40'
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={isOn}
        aria-label={`${isOn ? 'Remove' : 'Add'} ${title}`}
        className={cn(
          'service-card relative w-full rounded-2xl border-0 p-4 pr-14 sm:p-5 sm:pr-16 text-left outline-none bg-transparent',
          'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2',
          isOn && 'is-selected'
        )}
      >
        <span aria-hidden className={cn('service-card-toggle', isOn && 'is-selected')}>
          {isOn ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
        </span>
        {content}
      </button>

      {addon.unit && isOn && (
        <div className="flex items-center justify-between gap-3 border-t border-primary/20 px-4 py-3 sm:px-5">
          <span className="text-xs text-muted-foreground">How many {addon.unit.plural}?</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={`Fewer ${addon.unit.plural}`}
              disabled={quantity <= 1}
              onClick={() => onSetQuantity(quantity - 1)}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="w-6 text-center font-mono text-sm font-semibold" aria-live="polite">
              {quantity}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={`More ${addon.unit.plural}`}
              disabled={quantity >= addon.unit.max}
              onClick={() => onSetQuantity(quantity + 1)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
