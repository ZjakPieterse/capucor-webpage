import { cn, formatZAR } from '@/lib/utils';
import { addonTotal, buildAddonLineItems, buildLineItems, monthlyTotal } from '@/lib/pricing';
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
  className,
}: ProposalSummaryProps) {
  const tier = tiers.find((t) => t.slug === tierSlug) ?? null;
  const lineItems = [
    ...buildLineItems(selectedServices, selectedBrackets, tierSlug, services, brackets),
    ...buildAddonLineItems(selectedAddons),
  ];

  const monthly =
    monthlyZAR ??
    monthlyTotal(selectedServices, selectedBrackets, tierSlug, brackets) +
      addonTotal(selectedAddons);

  return (
    <div className={cn('rounded-2xl border border-primary/25 bg-primary/[0.04] p-5', className)}>
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-primary">
        Your subscription
      </p>

      <ul className="mb-4 space-y-2">
        {lineItems.map((item) => (
          <li key={item.slug} className="flex items-center justify-between text-sm">
            <span>
              {item.name}
              {item.label ? <span className="text-muted-foreground"> · {item.label}</span> : null}
            </span>
            <span className="font-mono text-sm">{formatZAR(item.price)}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-1.5 border-t border-primary/20 pt-3 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">Total monthly charge</span>
          <span className="font-mono text-lg font-bold">{formatZAR(monthly)}</span>
        </div>
        {tier && (
          <p className="pt-1 text-[11px] text-muted-foreground">
            {tier.name} tier · billed monthly in arrears · cancel any time with 30 days notice
          </p>
        )}
      </div>
    </div>
  );
}
