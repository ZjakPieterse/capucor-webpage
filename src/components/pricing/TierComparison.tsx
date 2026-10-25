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

// A row is ticked from the lowest package that includes it, or carries a
// value per package (the rhythm rows). The core services are ordinary rows
// since the "Core services" group row went (Zjak, 2026-10-25).
type MatrixRow =
  | { kind: 'tick'; text: string; tooltip: string; lowestTier: LowestTier }
  | { kind: 'value'; text: string; tooltip: string; values: Record<string, string> };

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

    // Core services first, each its own row like the others: the package
    // cards now name them, so the group row was redundant (Zjak, 2026-10-25).
    for (const line of CORE_SERVICE_LINES) {
      result.push({ kind: 'tick', text: line.text, tooltip: line.tooltip, lowestTier: 'common' });
    }

    // Then the rhythm, one value per package.
    for (const r of RHYTHM_ROWS) {
      result.push({ kind: 'value', text: r.label, tooltip: r.tooltip, values: r.values });
    }

    // Then what each package adds, ticked from the package that adds it.
    // Payroll goes last, as on the cards (2026-10-24).
    const tierOrder: LowestTier[] = ['basic', 'pro', 'premium'];
    const payroll: MatrixRow[] = [];
    for (const tierSlug of tierOrder) {
      const highlights: TierHighlightItem[] = TIER_HIGHLIGHTS[tierSlug] ?? [];
      for (const h of highlights) {
        if (h.summary || RHYTHM_TEXTS.has(h.text)) continue;
        if (h.services.length > 0 && !h.services.some((s) => selectedServices.has(s))) continue;
        if (seen.has(h.text)) continue;
        seen.add(h.text);
        const row: MatrixRow = { kind: 'tick', text: h.text, tooltip: h.tooltip, lowestTier: tierSlug };
        (h.services.includes('payroll') ? payroll : result).push(row);
      }
    }
    return [...result, ...payroll];
  }, [selectedServices]);

  if (selectedServices.size === 0) return null;

  function isCovered(tierSlug: string, lowestTier: LowestTier): boolean {
    if (lowestTier === 'common') return true;
    const tierRank: Record<string, number> = { basic: 0, pro: 1, premium: 2 };
    return (tierRank[tierSlug] ?? 0) >= (tierRank[lowestTier] ?? 0);
  }

  // The row label: plain text with its tooltip.
  function label(row: MatrixRow) {
    return (
      <>
        {row.text}
        {row.tooltip.trim() !== '' && <InfoTooltip content={row.tooltip} />}
      </>
    );
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
          {/* Phones: the same comparison as a real three-column grid (design
              review D6), not three stacked lists that repeat the cards. Each
              row's label sits above its three short cells (tick, dash or
              "Weekly"); every row is its own tbody so the label is a header
              for its cells. Fits 390 px without horizontal scroll. */}
          <table className="md:hidden w-full table-fixed text-xs">
            <thead className="bg-muted/30">
              <tr>
                {sortedTiers.map((t) => (
                  <th key={t.slug} scope="col" className="px-2 py-3 text-center font-semibold text-muted-foreground">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            {rows.map((row) => (
              <tbody key={row.text} className="border-t border-border/60">
                <tr>
                  <th
                    scope="rowgroup"
                    colSpan={sortedTiers.length}
                    className="px-5 pt-3 pb-1 text-left font-normal text-foreground"
                  >
                    {label(row)}
                  </th>
                </tr>
                <tr>
                  {sortedTiers.map((t) => (
                    <td key={t.slug} className="px-2 pt-1 pb-3 text-center">
                      {row.kind === 'value' ? (
                        <span className="font-medium">{row.values[t.slug] ?? '—'}</span>
                      ) : isCovered(t.slug, row.lowestTier) ? (
                        <Check className="inline h-4 w-4 text-foreground/70" aria-label="Included" />
                      ) : (
                        <Minus className="inline h-3.5 w-3.5 text-muted-foreground/60" aria-label="Not included" />
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            ))}
          </table>

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
                {rows.map((row, idx) => (
                  <tr
                    key={row.text}
                    className={cn(
                      'border-t border-border/60',
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/15'
                    )}
                  >
                    <td className="py-2.5 pl-5 pr-5 text-xs sm:text-sm">
                      {label(row)}
                    </td>
                    {sortedTiers.map((t) => (
                      <td key={t.slug} className="px-3 py-2.5 text-center">
                        {row.kind === 'value' ? (
                          <span className="text-xs font-medium">{row.values[t.slug] ?? '—'}</span>
                        ) : isCovered(t.slug, row.lowestTier) ? (
                          <Check className="inline h-4 w-4 text-foreground/70" aria-label="Included" />
                        ) : (
                          <Minus className="inline h-3.5 w-3.5 text-muted-foreground/60" aria-label="Not included" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
