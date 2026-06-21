import Link from 'next/link';
import { ArrowRight, LineChart, Link2, Timer, Wallet, TrendingUp } from 'lucide-react';
import { formatZAR } from '@/lib/utils';
import { PORTAL_PANEL } from '@/components/portal/portalCard';
import type { OrgFinance } from '@/lib/portal/orgData';

// Compact finance widget for the portal hub. Lights up with a three-tile snapshot
// once Xero is connected and a daily snapshot has landed; until then it shows a
// graceful "connect Xero" state. The full breakdown lives at /portal/finance.

function formatMonths(value: number | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} ${rounded === 1 ? 'month' : 'months'}`;
}

function formatZ(value: number | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return formatZAR(value);
}

export function PortalFinanceSnapshot({
  finance,
  href = '/portal/finance',
}: {
  finance: OrgFinance;
  href?: string;
}) {
  const { xeroConnected, snapshot } = finance;
  const live = xeroConnected && snapshot != null;

  return (
    <section className={`${PORTAL_PANEL} p-6`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <LineChart className="h-4 w-4 text-primary" />
          Finance snapshot
        </h2>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          View finance
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {live ? (
        <div className="grid grid-cols-3 gap-3">
          <SnapshotTile
            icon={<Wallet className="h-3.5 w-3.5 text-primary" />}
            label="Cash"
            value={formatZ(snapshot?.cash)}
          />
          <SnapshotTile
            icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />}
            label="Revenue (MTD)"
            value={formatZ(snapshot?.mtd_revenue)}
          />
          <SnapshotTile
            icon={<Timer className="h-3.5 w-3.5 text-primary" />}
            label="Runway"
            value={formatMonths(snapshot?.runway_months)}
          />
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
            <Link2 className="h-4 w-4 text-primary" />
          </span>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Connect Xero and this fills with a daily read-only snapshot: cash, revenue, expenses,
            debtors, creditors and runway. We only ever read; we never post to your ledger.
          </p>
        </div>
      )}
    </section>
  );
}

function SnapshotTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-background/40 p-3">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="font-mono text-lg font-bold tabular-nums tracking-tight">
        {value ?? <span className="text-muted-foreground/40">—</span>}
      </p>
    </div>
  );
}
