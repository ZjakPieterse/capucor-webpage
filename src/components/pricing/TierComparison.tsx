'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIER_HIGHLIGHTS, CORE_SERVICE_LINES, type TierHighlightItem } from '@/config/tiers';
import { RHYTHM_ROWS } from '@/config/calculatorCopy';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { Tier } from '@/types';

interface TierComparisonProps {
  tiers: Tier[];
  selectedServices: Set<string>;
  /** Start expanded (the package step opens it by default, tweaks round 1). */
  defaultOpen?: boolean;
}

type LowestTier = 'common' | 'basic' | 'pro' | 'premium';

// A row is ticked from the lowest package that includes it, carries a value
// per package (the rhythm rows), or is a greyed heading with no ticks ("Core
// services", with its services as ticked rows below it).
type MatrixRow =
  | { kind: 'tick'; text: string; tooltip: string; lowestTier: LowestTier }
  | { kind: 'value'; text: string; tooltip: string; values: Record<string, string> }
  | { kind: 'heading'; text: string; tooltip: string };

const RHYTHM_TEXTS = new Set(RHYTHM_ROWS.flatMap((r) => r.replaces));

// No price row: the cards above carry the prices, and the table says only
// what each package includes (Zjak, 2026-10-13).
export function TierComparison({
  tiers,
  selectedServices,
  defaultOpen = false,
}: TierComparisonProps) {
  const [open, setOpen] = useState(defaultOpen);

  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => a.display_order - b.display_order),
    [tiers]
  );

  const rows = useMemo<MatrixRow[]>(() => {
    if (selectedServices.size === 0) return [];

    const result: MatrixRow[] = [];
    const seen = new Set<string>();

    // Core services first: a greyed heading, then each service on its own
    // ticked row (Zjak, 2026-10-13: the strip above the cards went, so the
    // detail lives here).
    result.push({ kind: 'heading', text: 'Core services', tooltip: '' });
    for (const line of CORE_SERVICE_LINES) {
      result.push({ kind: 'tick', text: line.text, tooltip: line.tooltip, lowestTier: 'common' });
    }

    // Then the rhythm, one value per package.
    for (const r of RHYTHM_ROWS) {
      result.push({ kind: 'value', text: r.label, tooltip: r.tooltip, values: r.values });
    }

    // Then what each package adds, ticked from the package that adds it.
    const tierOrder: LowestTier[] = ['basic', 'pro', 'premium'];
    for (const tierSlug of tierOrder) {
      const highlights: TierHighlightItem[] = TIER_HIGHLIGHTS[tierSlug] ?? [];
      for (const h of highlights) {
        if (h.summary || RHYTHM_TEXTS.has(h.text)) continue;
        if (h.services.length > 0 && !h.services.some((s) => selectedServices.has(s))) continue;
        if (seen.has(h.text)) continue;
        seen.add(h.text);
        result.push({ kind: 'tick', text: h.text, tooltip: h.tooltip, lowestTier: tierSlug });
      }
    }
    return result;
  }, [selectedServices]);

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
        className="tier-compare-toggle w-full flex items-center justify-between gap-3 px-5 py-4 text-left focus:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <div>
          <p className="font-semibold text-sm">See all packages side by side</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compare what each package includes for your business.
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
          {/* Mobile: card-per-package stack (no horizontal scroll) */}
          <div className="md:hidden divide-y divide-border">
            {sortedTiers.map((t) => (
              <div key={t.slug} className="px-5 py-4">
                <p className="mb-3 text-sm font-semibold">{t.name}</p>
                <ul className="space-y-1.5">
                  {rows.map((row) => {
                    if (row.kind === 'value') {
                      return (
                        <li key={row.text} className="flex items-start gap-2 text-xs text-foreground">
                          <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/80" />
                          <span>
                            {row.text}: <span className="font-medium">{row.values[t.slug] ?? '—'}</span>
                            {row.tooltip.trim() !== '' && <InfoTooltip content={row.tooltip} />}
                          </span>
                        </li>
                      );
                    }
                    if (row.kind === 'heading') {
                      return (
                        <li key={row.text} className="pt-0.5 text-xs text-muted-foreground">
                          {row.text}
                        </li>
                      );
                    }
                    const covered = isCovered(t.slug, row.lowestTier);
                    return (
                      <li
                        key={row.text}
                        className={cn(
                          'flex items-start gap-2 text-xs',
                          covered ? 'text-foreground' : 'text-muted-foreground/80'
                        )}
                      >
                        {covered ? (
                          <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/80" />
                        ) : (
                          <Minus className="h-3 w-3 shrink-0 mt-1 text-muted-foreground/60" />
                        )}
                        <span>
                          {row.text}
                          {row.tooltip.trim() !== '' && <InfoTooltip content={row.tooltip} />}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Tablet/desktop: comparison table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-5 py-3">
                    What&apos;s included
                  </th>
                  {sortedTiers.map((t) => (
                    <th
                      key={t.slug}
                      className="text-center text-xs font-semibold px-3 py-3 text-muted-foreground"
                    >
                      {t.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const heading = row.kind === 'heading';
                  return (
                    <tr
                      key={row.text}
                      className={cn(
                        'border-t border-border/60',
                        idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/15'
                      )}
                    >
                      <td
                        className={cn(
                          'px-5 py-2.5 text-xs sm:text-sm',
                          heading && 'text-muted-foreground'
                        )}
                      >
                        {row.text}
                        {row.tooltip.trim() !== '' && <InfoTooltip content={row.tooltip} />}
                      </td>
                      {sortedTiers.map((t) => (
                        <td key={t.slug} className="px-3 py-2.5 text-center">
                          {row.kind === 'heading' ? null : row.kind === 'value' ? (
                            <span className="text-xs font-medium">{row.values[t.slug] ?? '—'}</span>
                          ) : isCovered(t.slug, row.lowestTier) ? (
                            <Check className="inline h-4 w-4 text-foreground/70" aria-label="Included" />
                          ) : (
                            <Minus className="inline h-3.5 w-3.5 text-muted-foreground/60" aria-label="Not included" />
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
