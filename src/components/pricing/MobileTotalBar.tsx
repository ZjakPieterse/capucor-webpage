'use client';

import { useCallback } from 'react';
import { ChevronUp } from 'lucide-react';
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
  onActivate: () => void;
}

export function MobileTotalBar({
  selectedServices,
  selectedBrackets,
  selectedTierSlug,
  selectedAddons = [],
  tiers,
  brackets,
  summaryAnchorId,
  onActivate,
}: MobileTotalBarProps) {
  const activeSlugs = [...selectedServices];
  const tier = tiers.find((t) => t.slug === selectedTierSlug) ?? null;
  const total = tier
    ? monthlyTotal(activeSlugs, selectedBrackets, tier.slug, brackets) + addonTotal(selectedAddons)
    : 0;

  const scrollToSummary = useCallback(() => {
    const el = document.getElementById(summaryAnchorId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [summaryAnchorId]);

  if (activeSlugs.length === 0) return null;

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
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">
              {activeSlugs.length} service{activeSlugs.length === 1 ? '' : 's'}
            </span>
            <span>·</span>
            <span>{tier ? `${tier.name} plan` : 'Select a plan'}</span>
          </p>
          {total > 0 ? (
            <motion.div
              initial={{ scale: 0.95, opacity: 0.5 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-mono font-bold text-lg leading-tight"
            >
              <AnimatedPrice amount={total} className="text-lg font-bold" />
              <span className="text-xs font-normal text-muted-foreground ml-1">/mo</span>
            </motion.div>
          ) : (
            <p className="text-sm text-muted-foreground">Pick a tier to see the total</p>
          )}
        </button>

        {selectedTierSlug ? (
          <Button size="sm" onClick={onActivate} className="shrink-0 shadow-lg shadow-primary/20">
            Get proposal
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={scrollToSummary}
            className="shrink-0 gap-1 border-primary/20 hover:bg-primary/5"
          >
            <ChevronUp className="h-4 w-4" />
            View summary
          </Button>
        )}
      </div>
    </div>
  );
}
