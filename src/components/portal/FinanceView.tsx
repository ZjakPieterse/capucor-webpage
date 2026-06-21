import {
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
import { formatZAR } from '@/lib/utils';
import { siteConfig } from '@/config/site';
import type { OrgFinance, XeroSnapshot } from '@/lib/portal/orgData';

// Read-only finance content (Xero snapshot tiles + connect prompt), shared by the
// client finance page and the internal view-only client mirror. Page chrome is
// supplied by the caller.
//
// `surface`: 'flat' (default) keeps the internal mirror's plain card look;
// 'glass' opts the client portal into the glassy premium card system.

type Surface = 'flat' | 'glass';

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

export function FinanceView({
  finance,
  surface = 'flat',
}: {
  finance: OrgFinance;
  surface?: Surface;
}) {
  const { xeroConnected, snapshot, asOf } = finance;
  // Live only when Xero is connected *and* a snapshot has landed.
  const live = xeroConnected && snapshot != null;
  const tileClass =
    surface === 'glass'
      ? 'premium-glass rounded-xl border border-white/10 bg-card/80'
      : 'rounded-xl border border-border bg-card';
  const prompt =
    surface === 'glass'
      ? 'premium-glass rounded-xl border border-primary/25 bg-primary/[0.04]'
      : 'rounded-xl border border-primary/25 bg-primary/[0.04]';

  return (
    <>
      {live ? (
        <p className="mb-5 text-xs text-muted-foreground">
          Last updated {formatLongDate(asOf)}. Figures refresh once a day.
        </p>
      ) : (
        <section className={`mb-8 p-6 ${prompt}`}>
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <h2 className="mb-2 text-lg font-semibold">Connect Xero to switch this on</h2>
          <p className="mb-5 max-w-prose text-sm leading-relaxed text-muted-foreground">
            Once your Xero organisation is linked, these tiles fill with a read-only daily snapshot:
            cash position, revenue and expenses for the month, debtors, creditors and runway. We only
            ever read; we never post to your ledger.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button disabled className="gap-2">
              <Link2 className="h-4 w-4" />
              Connect Xero (coming soon)
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<a href={siteConfig.links.booking} target="_blank" rel="noopener noreferrer" />}
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
            <div key={tile.key} className={`p-5 ${tileClass}`}>
              <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon className="h-3.5 w-3.5 text-primary" />
                {tile.label}
              </div>
              {value != null ? (
                <p className="font-mono text-2xl font-bold tabular-nums tracking-tight">{value}</p>
              ) : (
                <p className="font-mono text-2xl font-bold tracking-tight text-muted-foreground/40">
                  —
                </p>
              )}
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {value != null ? tile.hint : 'Awaiting Xero connection'}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Banknote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        Read-only access, scoped to reports, transactions and contacts. You stay in control of your
        Xero, and you can disconnect any time.
      </p>
    </>
  );
}
