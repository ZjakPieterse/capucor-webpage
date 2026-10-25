import { cn, formatZAR } from '@/lib/utils';
import {
  addonTotal,
  addonsForTier,
  buildAddonLineItems,
  buildLineItems,
  foldAddonsIntoLines,
  mergeCoreLines,
  monthlyTotal,
} from '@/lib/pricing';
import { tierDisplayName } from '@/config/tiers';
import type { Bracket, BracketValue, Service, Tier } from '@/types';

interface ProposalSummaryProps {
  services: Service[];
  brackets: Bracket[];
  tiers: Tier[];
  selectedServices: string[]; // slugs
  selectedBrackets: Record<string, BracketValue>;
  tierSlug: string;
  /** Optional add-on slugs — rendered as flat-fee lines after the service lines. */
  selectedAddons?: string[];
  /** Server-stored total — pass to display the figure locked in at send time. */
  monthlyZAR?: number;
  /** Replaces "Total monthly charge", e.g. for a Premium "from" estimate. */
  totalLabel?: string;
  /** Lists accounting and bookkeeping as their own lines instead of one
   *  "Monthly accounting" line (the review step, Zjak 2026-10-25). */
  splitCore?: boolean;
  className?: string;
}

// Presentational line-item summary of a calculator selection. No 'use client'
// and no animation so it renders server-side on the proposal page; the modal
// uses it too. Static formatZAR (not AnimatedPrice) — the price is settled by
// the time this shows.
export function ProposalSummary({
  services,
  brackets,
  tiers,
  selectedServices,
  selectedBrackets,
  tierSlug,
  selectedAddons = [],
  monthlyZAR,
  totalLabel = 'Total monthly charge',
  splitCore = false,
  className,
}: ProposalSummaryProps) {
  const tier = tiers.find((t) => t.slug === tierSlug) ?? null;
  const tierName = tier?.name ?? tierDisplayName(tierSlug);
  // Same add-on rule as the server: the package's included add-ons are listed too.
  const addons = addonsForTier(selectedAddons, tierSlug);
  // Same as the server: a folded add-on (the retired Xero invoicing charge on
  // older proposals) is priced inside its service line, and accounting plus
  // bookkeeping show as one "Monthly accounting" line unless splitCore.
  const serviceLines = foldAddonsIntoLines(
    buildLineItems(selectedServices, selectedBrackets, tierSlug, services, brackets),
    addons,
    tierSlug,
  );
  const lineItems = [
    ...(splitCore ? serviceLines : mergeCoreLines(serviceLines)),
    ...buildAddonLineItems(addons, tierSlug),
  ];

  const monthly =
    monthlyZAR ??
    monthlyTotal(selectedServices, selectedBrackets, tierSlug, brackets) +
      addonTotal(addons, tierSlug);

  return (
    <div className={cn('rounded-2xl border border-primary/25 bg-primary/[0.04] p-5', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-primary">Your subscription</p>
        {tierName && (
          <span className="shrink-0 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {tierName} package
          </span>
        )}
      </div>

      <ul className="mb-4 space-y-2">
        {lineItems.map((item) => (
          <li key={item.slug} className="flex items-start justify-between gap-3 text-sm">
            <span className="min-w-0">
              {item.name}
              {item.label ? <span className="text-muted-foreground"> · {item.label}</span> : null}
            </span>
            <span className="text-sm font-medium tabular-nums whitespace-nowrap">{formatZAR(item.price)}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-1.5 border-t border-primary/20 pt-3 text-sm">
        {/* The amount never wraps: a long label ("Estimated monthly charge,
            from") wraps on its own side instead (design review, 2026-10-13). */}
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 font-semibold">{totalLabel}</span>
          <span className="shrink-0 whitespace-nowrap text-xl font-bold tracking-tight tabular-nums">
            {formatZAR(monthly)}
          </span>
        </div>
        <p className="pt-1 text-[11px] text-muted-foreground">
          Billed monthly in advance · cancel any time with 30 days&apos; notice
        </p>
      </div>
    </div>
  );
}
