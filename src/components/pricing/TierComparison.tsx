'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedPrice } from '@/components/ui/AnimatedPrice';
import { addonTotal, bracketPrice } from '@/lib/pricing';
import {
  TIER_HIGHLIGHTS,
  PACKAGE_COMMON_ITEMS,
  type TierHighlightItem,
} from '@/config/tiers';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { Bracket, Tier, BracketValue } from '@/types';

interface TierComparisonProps {
  tiers: Tier[];
  brackets: Bracket[];
  selectedServices: Set<string>;
  selectedBrackets: Record<string, BracketValue>;
  /** Selected optional add-on slugs — included in the footer totals so they match the tier cards. */
  selectedAddons?: string[];
}

type LowestTier = 'common' | 'basic' | 'pro' | 'premium';

interface MatrixRow {
  text: string;
  tooltip: string;
  lowestTier: LowestTier;
}

export function TierComparison({
  tiers,
  brackets,
  selectedServices,
  selectedBrackets,
  selectedAddons = [],
}: TierComparisonProps) {
  const [open, setOpen] = useState(false);

  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => a.display_order - b.display_order),
    [tiers]
  );

  const rows = useMemo<MatrixRow[]>(() => {
    if (selectedServices.size === 0) return [];

    const result: MatrixRow[] = [];
    const seen = new Set<string>();

    // Common items first
    for (const item of PACKAGE_COMMON_ITEMS) {
      if (seen.has(item.text)) continue;
      seen.add(item.text);
      result.push({ text: item.text, tooltip: item.tooltip, lowestTier: 'common' });
    }

    const tierOrder: LowestTier[] = ['basic', 'pro', 'premium'];
    for (const tierSlug of tierOrder) {
      const highlights: TierHighlightItem[] = TIER_HIGHLIGHTS[tierSlug] ?? [];
      for (const h of highlights) {
        if (h.services.length > 0 && !h.services.some((s) => selectedServices.has(s))) continue;
        if (seen.has(h.text)) continue;
        seen.add(h.text);
        result.push({ text: h.text, tooltip: h.tooltip, lowestTier: tierSlug });
      }
    }
    return result;
  }, [selectedServices]);

  // Per-tier total for the footer row. Includes the flat add-on fee so the
  // figures match the tier cards above.
  const tierTotals = useMemo(() => {
    const addonsZAR = addonTotal(selectedAddons);
    const out: Record<string, { total: number }> = {};
    for (const tier of sortedTiers) {
      let total = 0;
      for (const slug of selectedServices) {
        const bv = selectedBrackets[slug];
        if (typeof bv !== 'number') continue;
        const b = brackets.find((x) => x.service_slug === slug && x.ordinal === bv);
        if (b) total += bracketPrice(b, tier.slug);
      }
      out[tier.slug] = { total: total > 0 ? total + addonsZAR : 0 };
    }
    return out;
  }, [sortedTiers, selectedServices, selectedBrackets, brackets, selectedAddons]);

  if (selectedServices.size === 0) return null;

  function isCovered(tierSlug: string, lowestTier: LowestTier): boolean {
    if (lowestTier === 'common') return true;
    const tierRank: Record<string, number> = { basic: 0, pro: 1, premium: 2 };
    return (tierRank[tierSlug] ?? 0) >= (tierRank[lowestTier] ?? 0);
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="tier-comparison-table"
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <div>
          <p className="font-semibold text-sm">See all tiers side by side</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compare what&apos;s included at every plan for your selected services.
          </p>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div id="tier-comparison-table" className="border-t border-border">
          {/* Mobile: card-per-tier stack (no horizontal scroll) */}
          <div className="md:hidden divide-y divide-border">
            {sortedTiers.map((t) => {
              const { total } = tierTotals[t.slug] ?? { total: 0 };
              return (
                <div key={t.slug} className="px-5 py-4">
                  <div className="flex items-baseline justify-between mb-3">
                    <p className="text-sm font-semibold uppercase tracking-wider">{t.name}</p>
                    {total > 0 ? (
                      <AnimatedPrice amount={total} className="text-sm font-bold" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                  <ul className="space-y-1.5">
                    {rows.map((row) => (
                      <li
                        key={row.text}
                        className={cn(
                          'flex items-start gap-2 text-xs',
                          isCovered(t.slug, row.lowestTier)
                            ? 'text-foreground'
                            : 'text-muted-foreground/60'
                        )}
                      >
                        {isCovered(t.slug, row.lowestTier) ? (
                          <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/80" />
                        ) : (
                          <Minus className="h-3 w-3 shrink-0 mt-1 text-muted-foreground/40" />
                        )}
                        <span>
                          {row.text}
                          {row.tooltip.trim() !== '' && <InfoTooltip content={row.tooltip} />}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Tablet/desktop: comparison table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-5 py-3">
                    Inclusion
                  </th>
                  {sortedTiers.map((t) => (
                    <th
                      key={t.slug}
                      className="text-center text-xs font-semibold uppercase tracking-wider px-3 py-3 text-muted-foreground"
                    >
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.text}
                    className={cn(
                      'border-t border-border/60',
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/15'
                    )}
                  >
                    <td className="px-5 py-2.5 text-xs sm:text-sm">
                      {row.text}
                      {row.tooltip.trim() !== '' && <InfoTooltip content={row.tooltip} />}
                    </td>
                    {sortedTiers.map((t) => (
                      <td key={t.slug} className="px-3 py-2.5 text-center">
                        {isCovered(t.slug, row.lowestTier) ? (
                          <Check className="inline h-4 w-4 text-foreground/70" />
                        ) : (
                          <Minus className="inline h-3.5 w-3.5 text-muted-foreground/40" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-muted/30">
                  <td className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Monthly price
                  </td>
                  {sortedTiers.map((t) => {
                    const { total } = tierTotals[t.slug] ?? { total: 0 };
                    return (
                      <td key={t.slug} className="px-3 py-3 text-center">
                        {total > 0 ? (
                          <AnimatedPrice amount={total} className="text-sm font-bold" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
