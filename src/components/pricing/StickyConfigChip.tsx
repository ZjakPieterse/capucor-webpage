'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { AnimatedPrice } from '@/components/ui/AnimatedPrice';
import { addonTotal, monthlyTotal } from '@/lib/pricing';
import type { Bracket, BracketValue, Tier } from '@/types';

interface StickyConfigChipProps {
  selectedServices: Set<string>;
  selectedBrackets: Record<string, BracketValue>;
  selectedTierSlug: string | null;
  selectedAddons?: string[];
  tiers: Tier[];
  brackets: Bracket[];
  observeElementId: string;
  scrollToId: string;
}

export function StickyConfigChip({
  selectedServices,
  selectedBrackets,
  selectedTierSlug,
  selectedAddons = [],
  tiers,
  brackets,
  observeElementId,
  scrollToId,
}: StickyConfigChipProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById(observeElementId);
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0, rootMargin: '0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [observeElementId]);

  const scrollToCalculator = useCallback(() => {
    const el = document.getElementById(scrollToId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scrollToId]);

  const activeSlugs = [...selectedServices];
  if (activeSlugs.length === 0) return null;

  const tier = tiers.find((t) => t.slug === selectedTierSlug) ?? null;
  const total = tier
    ? monthlyTotal(activeSlugs, selectedBrackets, tier.slug, brackets) + addonTotal(selectedAddons)
    : 0;

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          layout
          type="button"
          onClick={scrollToCalculator}
          aria-label="Return to calculator"
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'hidden lg:inline-flex fixed bottom-8 right-8 z-30 items-center gap-3 rounded-full bg-card/70 backdrop-blur-xl saturate-150 border border-primary/20 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.4)] pl-5 pr-2 py-2 text-left transition-colors duration-300 hover:border-primary/50'
          )}
        >
          <div className="flex flex-col leading-tight">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {tier ? `${tier.name} plan` : `${activeSlugs.length} service${activeSlugs.length === 1 ? '' : 's'}`}
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={total > 0 ? 'price' : 'empty'}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm"
              >
                {total > 0 ? (
                  <>
                    <AnimatedPrice amount={total} className="text-sm font-bold" />
                    <span className="text-[10px] font-normal text-muted-foreground ml-1">/mo</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {tier ? 'Configure' : 'Pick a tier'}
                  </span>
                )}
              </motion.span>
            </AnimatePresence>
          </div>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <ChevronUp className="h-4 w-4" />
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
