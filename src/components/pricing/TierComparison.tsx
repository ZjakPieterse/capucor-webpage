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
// value per package (the rhythm rows). "Core services" is a `group` row that
// expands to its services as greyed, indented `sub` rows (Zjak, 2026-10-13).
type MatrixRow =
  | { kind: 'tick'; text: string; tooltip: string; lowestTier: LowestTier; group?: boolean; sub?: boolean }
  | { kind: 'value'; text: string; tooltip: string; values: Record<string, string> };

const isSub = (row: MatrixRow) => row.kind === 'tick' && row.sub === true;

const RHYTHM_TEXTS = new Set(RHYTHM_ROWS.flatMap((r) => r.replaces));

// No price row: the cards above carry the prices, and the table says only
// what each package includes (Zjak, 2026-10-13).
export function TierComparison({
  tiers,
  selectedServices,
  defaultOpen = false,
}: TierComparisonProps) {
  const [open, setOpen] = useState(defaultOpen);
  // "Core services" starts expanded (Zjak, 2026-10-13).
  const [coreOpen, setCoreOpen] = useState(true);

  const sortedTiers = useMemo(
    () => [...tiers].sort((a, b) => a.display_order - b.display_order),
    [tiers]
  );

  const rows = useMemo<MatrixRow[]>(() => {
    if (selectedServices.size === 0) return [];

    const result: MatrixRow[] = [];
    const seen = new Set<string>();

    // Core services first: a ticked row like the others, then each service
    // on its own greyed sub-row (the strip above the cards went, so the
    // detail lives here).
    result.push({ kind: 'tick', text: 'Core services', tooltip: '', lowestTier: 'common', group: true });
    for (const line of CORE_SERVICE_LINES) {
      result.push({ kind: 'tick', text: line.text, tooltip: line.tooltip, lowestTier: 'common', sub: true });
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

  const visibleRows = coreOpen ? rows : rows.filter((row) => !isSub(row));

  // The row label: plain text with its tooltip, or for the group row a
  // toggle with the same chevron as the table's own header.
  function label(row: MatrixRow) {
    if (row.kind === 'tick' && row.group) {
      return (
        <button
          type="button"
          onClick={() => setCoreOpen((v) => !v)}
          aria-expanded={coreOpen}
          className="inline-flex items-center gap-1.5 rounded-sm text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {row.text}
          <ChevronDown
            aria-hidden
            className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', coreOpen && 'rotate-180')}
          />
        </button>
      );
    }
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
          {/* Mobile: card-per-package stack (no horizontal scroll) */}
          <div className="md:hidden divide-y divide-border">
            {sortedTiers.map((t) => (
              <div key={t.slug} className="px-5 py-4">
                <p className="mb-3 text-sm font-semibold">{t.name}</p>
                <ul className="space-y-1.5">
                  {visibleRows.map((row) => {
                    if (row.kind === 'value') {
                      return (
                        <li key={row.text} className="flex items-start gap-2 text-xs text-foreground">
                          <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-foreground/70" />
                          <span>
                            {row.text}: <span className="font-medium">{row.values[t.slug] ?? '—'}</span>
                            {row.tooltip.trim() !== '' && <InfoTooltip content={row.tooltip} />}
                          </span>
                        </li>
                      );
                    }
                    const covered = isCovered(t.slug, row.lowestTier);
                    return (
                      <li
                        key={row.text}
                        className={cn(
                          'flex items-start gap-2 text-xs',
                          row.sub && 'pl-5',
                          covered && !row.sub ? 'text-foreground' : 'text-muted-foreground/80'
                        )}
                      >
                        {covered ? (
                          <Check
                            className={cn(
                              'h-3.5 w-3.5 shrink-0 mt-0.5',
                              row.sub ? 'text-muted-foreground/60' : 'text-foreground/70'
                            )}
                          />
                        ) : (
                          <Minus className="h-3 w-3 shrink-0 mt-1 text-muted-foreground/60" />
                        )}
                        <span>{label(row)}</span>
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
                {visibleRows.map((row, idx) => {
                  const sub = isSub(row);
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
                          'py-2.5 pr-5 text-xs sm:text-sm',
                          sub ? 'pl-10 text-muted-foreground' : 'pl-5'
                        )}
                      >
                        {label(row)}
                      </td>
                      {sortedTiers.map((t) => (
                        <td key={t.slug} className="px-3 py-2.5 text-center">
                          {row.kind === 'value' ? (
                            <span className="text-xs font-medium">{row.values[t.slug] ?? '—'}</span>
                          ) : isCovered(t.slug, row.lowestTier) ? (
                            <Check
                              className={cn('inline h-4 w-4', sub ? 'text-muted-foreground/60' : 'text-foreground/70')}
                              aria-label="Included"
                            />
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
