'use client';

import { useCallback } from 'react';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { AnimatedPrice } from '@/components/ui/AnimatedPrice';
import { addonTotal, monthlyTotal } from '@/lib/pricing';
import type { Bracket, BracketValue, Tier } from '@/types';

interface MobileTotalBarProps {
  selectedServices: Set<string>;
  selectedBrackets: Record<string, BracketValue>;
  selectedTierSlug: string | null;
  selectedAddons?: string[];
  tiers: Tier[];
  brackets: Bracket[];
  summaryAnchorId: string;
  /** Small caption after the package name; defaults to "monthly total". */
  caption?: string;
  /** Optional button on the right, e.g. "Review" on the add-ons step. */
  action?: { label: string; onClick: () => void };
}

// Running total for phones. calculator-v2 shows it from the package step on,
// once a package is tapped (the parent decides when to render it), so a
// package is always chosen here.

export function MobileTotalBar({
  selectedServices,
  selectedBrackets,
  selectedTierSlug,
  selectedAddons = [],
  tiers,
  brackets,
  summaryAnchorId,
  caption = 'monthly total',
  action,
}: MobileTotalBarProps) {
  const activeSlugs = [...selectedServices];
  const tier = tiers.find((t) => t.slug === selectedTierSlug) ?? null;
  const total = tier
    ? monthlyTotal(activeSlugs, selectedBrackets, tier.slug, brackets) + addonTotal(selectedAddons, tier.slug)
    : 0;

  const scrollToSummary = useCallback(() => {
    const el = document.getElementById(summaryAnchorId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [summaryAnchorId]);

  if (activeSlugs.length === 0 || !tier) return null;

  return (
    <div
      role="region"
      aria-label="Subscription total"
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden border-t border-border bg-background/80 backdrop-blur-xl saturate-150 shadow-[0_-8px_32px_-12px_rgba(0,0,0,0.3)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={scrollToSummary}
          aria-label="Jump to subscription summary"
          className="min-w-0 flex-1 text-left rounded-md -mx-1 px-1 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-primary/5"
        >
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {tier.name} package · {caption}
          </p>
          <motion.div
            initial={{ scale: 0.95, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            className="font-mono font-bold text-lg leading-tight"
          >
            <AnimatedPrice amount={total} className="text-lg font-bold" />
            <span className="text-xs font-normal text-muted-foreground ml-1">/month</span>
          </motion.div>
        </button>

        {action && (
          <Button onClick={action.onClick} className="h-11 shrink-0 px-5 shadow-lg shadow-primary/20">
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
