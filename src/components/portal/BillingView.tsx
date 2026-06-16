import { Receipt } from 'lucide-react';
import { formatZAR } from '@/lib/utils';
import { SubscriptionStatusBadge } from '@/components/portal/StatusBadge';
import type { OrgSubscriptionRow, OrgInvoiceRow } from '@/lib/portal/orgData';

// Read-only billing content (subscription summary + invoice history), shared by
// the client billing page and the internal view-only client mirror. Page chrome
// (back link, header, switcher) is supplied by the caller.

const TIER_NAMES: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
};

type InvoiceStatus = OrgInvoiceRow['status'];

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const styles: Record<InvoiceStatus, { label: string; cls: string }> = {
    paid: { label: 'Paid', cls: 'bg-primary/15 text-primary border-primary/30' },
    pending: { label: 'Pending', cls: 'bg-warning/15 text-warning border-warning/30' },
    failed: { label: 'Failed', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
    refunded: { label: 'Refunded', cls: 'bg-muted text-muted-foreground border-border' },
  };
  const s = styles[status] ?? styles.pending;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

function formatLongDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatMonthYear(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', {
    month: 'long',
    year: 'numeric',
  });
}

export function BillingView({
  sub,
  invoices,
}: {
  sub: OrgSubscriptionRow | null;
  invoices: OrgInvoiceRow[];
}) {
  if (!sub) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          No subscription on file yet. Billing details and invoices appear here once the
          subscription is provisioned.
        </p>
      </div>
    );
  }

  const tierName = TIER_NAMES[sub.tier_slug] ?? sub.tier_slug;

  return (
    <>
      <section className="mb-8 rounded-xl border border-border bg-card p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Current subscription
            </h2>
            <p className="text-base font-semibold">{tierName} tier</p>
          </div>
          <SubscriptionStatusBadge status={sub.status} />
        </div>
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total monthly charge
            </dt>
            <dd className="font-mono font-semibold">{formatZAR(Number(sub.total_charge_zar))}</dd>
          </div>
          <div>
            <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Next billing date
            </dt>
            <dd className="font-medium">{formatLongDate(sub.current_period_end)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Payment method
            </dt>
            <dd className="text-sm text-muted-foreground">
              Managed via Paystack. Receipts are sent by email after each successful charge.
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Receipt className="h-3.5 w-3.5" />
          Invoice history
        </h2>

        {invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
              No invoices yet. Your first invoice lands at the end of your current billing cycle.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 sm:px-5 sm:py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {formatMonthYear(inv.period_end ?? inv.created_at)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {inv.status === 'paid' && inv.paid_at
                      ? `Paid ${formatLongDate(inv.paid_at)}`
                      : `Issued ${formatLongDate(inv.created_at)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-sm font-semibold">
                    {formatZAR(Number(inv.amount_zar))}
                  </span>
                  <InvoiceStatusBadge status={inv.status} />
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          PDF receipts and downloadable invoices will appear here once Paystack billing is live. In
          the meantime, every successful charge sends a receipt to your account email.
        </p>
      </section>
    </>
  );
}
