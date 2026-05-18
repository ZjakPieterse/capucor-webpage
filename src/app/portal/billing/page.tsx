import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Receipt, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requireSession } from '@/lib/auth/requireSession';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatZAR } from '@/lib/utils';
import type { SubscriptionStatus } from '@/types';

export const metadata: Metadata = {
  title: 'Billing',
  description: 'Your Capucor subscription and invoice history.',
  robots: { index: false },
};

const TIER_NAMES: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
};

type InvoiceStatus = 'pending' | 'paid' | 'failed' | 'refunded';

function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const styles: Record<SubscriptionStatus, { label: string; cls: string }> = {
    active: { label: 'Active', cls: 'bg-primary/15 text-primary border-primary/30' },
    pending_payment: { label: 'Pending payment', cls: 'bg-warning/15 text-warning border-warning/30' },
    cancelling: { label: 'Cancelling', cls: 'bg-warning/15 text-warning border-warning/30' },
    cancelled: { label: 'Cancelled', cls: 'bg-muted text-muted-foreground border-border' },
    past_due: { label: 'Past due', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  };
  const s = styles[status] ?? styles.pending_payment;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const styles: Record<InvoiceStatus, { label: string; cls: string }> = {
    paid: { label: 'Paid', cls: 'bg-primary/15 text-primary border-primary/30' },
    pending: { label: 'Pending', cls: 'bg-warning/15 text-warning border-warning/30' },
    failed: { label: 'Failed', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
    refunded: { label: 'Refunded', cls: 'bg-muted text-muted-foreground border-border' },
  };
  const s = styles[status] ?? styles.pending;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>
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

export default async function PortalBillingPage() {
  const user = await requireSession();
  const supabase = createSupabaseAdminClient();

  const { data: membership } = await supabase
    .from('client_org_members')
    .select('client_org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return <BillingNotReadyState />;
  }

  const orgId = membership.client_org_id as string;

  const [{ data: org }, { data: sub }] = await Promise.all([
    supabase
      .from('client_orgs')
      .select('name')
      .eq('id', orgId)
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select(
        'id, status, tier_slug, total_charge_zar, current_period_end, created_at'
      )
      .eq('client_org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!org || !sub) {
    return <BillingNotReadyState />;
  }

  const { data: invoiceRows } = await supabase
    .from('invoices')
    .select(
      'id, amount_zar, status, period_start, period_end, paid_at, created_at, paystack_reference'
    )
    .eq('client_org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(24);

  const invoices = (invoiceRows ?? []) as Array<{
    id: string;
    amount_zar: string | number;
    status: InvoiceStatus;
    period_start: string | null;
    period_end: string | null;
    paid_at: string | null;
    created_at: string;
    paystack_reference: string | null;
  }>;

  const subStatus = sub.status as SubscriptionStatus;
  const tierName = TIER_NAMES[sub.tier_slug as string] ?? sub.tier_slug;
  const orgName = org.name as string;

  return (
    <main className="max-w-3xl mx-auto px-6 py-12 lg:py-16">
      <Link
        href="/portal"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to portal
      </Link>

      <header className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          {orgName}
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
      </header>

      <section className="rounded-xl border border-border bg-card p-6 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Current subscription
            </h2>
            <p className="text-base font-semibold">{tierName} tier</p>
          </div>
          <SubscriptionStatusBadge status={subStatus} />
        </div>
        <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Total monthly charge
            </dt>
            <dd className="font-mono font-semibold">
              {formatZAR(Number(sub.total_charge_zar))}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Next billing date
            </dt>
            <dd className="font-medium">
              {formatLongDate(sub.current_period_end as string | null)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Payment method
            </dt>
            <dd className="text-sm text-muted-foreground">
              Managed via Paystack. Receipts are sent by email after each successful charge.
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
          <Receipt className="h-3.5 w-3.5" />
          Invoice history
        </h2>

        {invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              No invoices yet. Your first invoice lands at the end of your current billing cycle.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="rounded-lg border border-border bg-card px-4 py-3 sm:px-5 sm:py-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {formatMonthYear(inv.period_end ?? inv.created_at)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {inv.status === 'paid' && inv.paid_at
                      ? `Paid ${formatLongDate(inv.paid_at)}`
                      : `Issued ${formatLongDate(inv.created_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm font-semibold">
                    {formatZAR(Number(inv.amount_zar))}
                  </span>
                  <InvoiceStatusBadge status={inv.status} />
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-5 text-xs text-muted-foreground leading-relaxed">
          PDF receipts and downloadable invoices will appear here once Paystack billing is live. In the meantime, every successful charge sends a receipt to your account email.
        </p>
      </section>
    </main>
  );
}

function BillingNotReadyState() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 lg:py-24 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 mb-5">
        <Lock className="h-5 w-5 text-primary" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-3">
        Your subscription is being set up
      </h1>
      <p className="text-sm text-muted-foreground leading-relaxed mb-8">
        Billing details and invoices will appear here once your account is provisioned.
      </p>
      <Button nativeButton={false} render={<Link href="/portal" />}>
        Back to portal
      </Button>
    </main>
  );
}
