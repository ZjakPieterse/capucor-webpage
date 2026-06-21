import type { ReactNode } from 'react';
import { Layers } from 'lucide-react';
import { SubscriptionStatusBadge } from '@/components/portal/StatusBadge';
import { PORTAL_PANEL } from '@/components/portal/portalCard';
import { formatZAR } from '@/lib/utils';

// Glassy summary header shared by the client portal hub and the internal
// view-only client mirror. The page fetches the data and passes it in; the
// component is purely presentational.
//
// - `heading` / `orgLabel` are the portal's org name + switcher. The internal
//   mirror omits both (the org name/status/email already sit in its layout
//   header) and renders just the tier + subscription-status badges and the
//   billing figures, so nothing is duplicated.

function formatLongDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function PortalSummaryHeader({
  orgLabel,
  heading,
  tierName,
  status,
  monthlyZar,
  payment,
  className,
}: {
  orgLabel?: ReactNode;
  heading?: string;
  tierName: string;
  status: string;
  monthlyZar: number;
  payment: { label: string; date: string | null };
  className?: string;
}) {
  return (
    <section className={`${PORTAL_PANEL} p-6 sm:p-8 ${className ?? ''}`}>
      {orgLabel}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {heading && (
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{heading}</h1>
          )}
          <div className={`flex flex-wrap items-center gap-2 ${heading ? 'mt-2.5' : ''}`}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">
              <Layers className="h-3 w-3" />
              {tierName}
            </span>
            <SubscriptionStatusBadge status={status} />
          </div>
        </div>
        <div className="sm:text-right">
          <p className="flex items-baseline gap-1 font-mono text-2xl font-bold tracking-tight sm:justify-end">
            {formatZAR(monthlyZar)}
            <span className="whitespace-nowrap text-sm font-medium text-muted-foreground">
              /month
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {payment.label} · {formatLongDate(payment.date)}
          </p>
        </div>
      </div>
    </section>
  );
}
