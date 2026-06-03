import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Link2,
  Timer,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requireSession } from '@/lib/auth/requireSession';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatZAR } from '@/lib/utils';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Finance',
  description: 'A live snapshot of your numbers, powered by Xero.',
  robots: { index: false },
};

// Daily Xero snapshot shape (X4 cron will upsert this into xero_snapshot_cache).
// Every field is optional so a partial snapshot still renders gracefully.
interface XeroSnapshot {
  cash?: number;
  mtd_revenue?: number;
  mtd_expenses?: number;
  debtors?: number;
  creditors?: number;
  runway_months?: number;
}

type TileKind = 'zar' | 'months';

interface TileDef {
  key: keyof XeroSnapshot;
  label: string;
  hint: string;
  icon: LucideIcon;
  kind: TileKind;
}

// Mirrors X5 — never hit Xero on page load; render from the cached snapshot.
const TILES: TileDef[] = [
  { key: 'cash', label: 'Cash position', hint: 'Across linked bank accounts', icon: Wallet, kind: 'zar' },
  { key: 'mtd_revenue', label: 'Revenue (month to date)', hint: 'Income recognised this month', icon: TrendingUp, kind: 'zar' },
  { key: 'mtd_expenses', label: 'Expenses (month to date)', hint: 'Spend recognised this month', icon: TrendingDown, kind: 'zar' },
  { key: 'debtors', label: 'Debtors', hint: 'Owed to you by customers', icon: ArrowDownLeft, kind: 'zar' },
  { key: 'creditors', label: 'Creditors', hint: 'Owed by you to suppliers', icon: ArrowUpRight, kind: 'zar' },
  { key: 'runway_months', label: 'Runway', hint: 'Months of cover at current burn', icon: Timer, kind: 'months' },
];

function formatTile(value: number | undefined, kind: TileKind): string | null {
  if (value == null || Number.isNaN(value)) return null;
  if (kind === 'months') {
    const rounded = Math.round(value * 10) / 10;
    return `${rounded} ${rounded === 1 ? 'month' : 'months'}`;
  }
  return formatZAR(value);
}

function formatLongDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function PortalFinancePage() {
  const user = await requireSession();
  const supabase = createSupabaseAdminClient();

  const { data: membership } = await supabase
    .from('client_org_members')
    .select('client_org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  let orgName: string | null = null;
  let xeroConnected = false;
  let snapshot: XeroSnapshot | null = null;
  let asOf: string | null = null;

  if (membership) {
    const orgId = membership.client_org_id as string;
    const [{ data: org }, { data: snap }] = await Promise.all([
      supabase
        .from('client_orgs')
        .select('name, xero_connected_at')
        .eq('id', orgId)
        .maybeSingle(),
      supabase
        .from('xero_snapshot_cache')
        .select('snapshot, as_of_date')
        .eq('client_org_id', orgId)
        .maybeSingle(),
    ]);

    orgName = (org?.name as string | undefined) ?? null;
    xeroConnected = Boolean(org?.xero_connected_at);
    if (snap?.snapshot) {
      snapshot = snap.snapshot as XeroSnapshot;
      asOf = (snap.as_of_date as string | null) ?? null;
    }
  }

  // Live only when Xero is connected *and* a snapshot has landed.
  const live = xeroConnected && snapshot != null;

  return (
    <main className="max-w-4xl mx-auto px-6 py-12 lg:py-16">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to portal
      </Link>

      <header className="mb-8">
        {orgName && (
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {orgName}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-prose">
          A daily snapshot of your numbers, pulled from Xero. No spreadsheets, no waiting for month-end.
        </p>
      </header>

      {live ? (
        <p className="mb-5 text-xs text-muted-foreground">
          Last updated {formatLongDate(asOf)}. Figures refresh once a day.
        </p>
      ) : (
        <section className="mb-8 rounded-xl border border-primary/25 bg-primary/[0.04] p-6">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 mb-4">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Connect Xero to switch this on</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-5 max-w-prose">
            Once your Xero organisation is linked, these tiles fill with a read-only daily snapshot — cash position, revenue and expenses for the month, debtors, creditors and runway. We only ever read; we never post to your ledger.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button disabled className="gap-2">
              <Link2 className="h-4 w-4" />
              Connect Xero (coming soon)
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a href={siteConfig.links.booking} target="_blank" rel="noopener noreferrer" />
              }
            >
              Ask us to set it up
            </Button>
          </div>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => {
          const value = live ? formatTile(snapshot?.[tile.key], tile.kind) : null;
          const Icon = tile.icon;
          return (
            <div
              key={tile.key}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                <Icon className="h-3.5 w-3.5 text-primary" />
                {tile.label}
              </div>
              {value != null ? (
                <p className="font-mono text-2xl font-bold tracking-tight tabular-nums">
                  {value}
                </p>
              ) : (
                <p className="font-mono text-2xl font-bold tracking-tight text-muted-foreground/40">
                  —
                </p>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                {value != null ? tile.hint : 'Awaiting Xero connection'}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
        <Banknote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        Read-only access, scoped to reports, transactions and contacts. You stay in control of your Xero — disconnect any time.
      </p>
    </main>
  );
}
