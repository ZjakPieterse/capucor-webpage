import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Calendar,
  CalendarClock,
  ClipboardList,
  FileText,
  LineChart,
  MessageSquare,
  Building2,
  ShoppingBag,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { requireSession } from '@/lib/auth/requireSession';
import { SignOutButton } from '@/components/portal/SignOutButton';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatZAR } from '@/lib/utils';
import { siteConfig } from '@/config/site';
import type { SubscriptionStatus } from '@/types';

export const metadata: Metadata = {
  title: 'Client Portal',
  description: 'Your Capucor subscription, documents and compliance status.',
  robots: { index: false },
};

// Mirrors the `tiers` table — kept inline so the portal doesn't make a second
// round trip just to resolve a display name.
const TIER_NAMES: Record<string, string> = {
  basic: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
};

function StatusBadge({ status }: { status: SubscriptionStatus }) {
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

function formatLongDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default async function PortalPage() {
  const user = await requireSession();
  const supabase = createSupabaseAdminClient();

  // v1 = one client_org per user.
  const { data: membership } = await supabase
    .from('client_org_members')
    .select('client_org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return (
      <PortalEmptyState
        title="Your subscription is being set up"
        body="We're getting your account ready. Your subscription, documents and monthly reports will appear here once setup is complete. If this is taking longer than 24 hours, book a call so we can sort it out."
      />
    );
  }

  const orgId = membership.client_org_id as string;

  const [{ data: org }, { data: sub }] = await Promise.all([
    supabase
      .from('client_orgs')
      .select('id, name, status')
      .eq('id', orgId)
      .maybeSingle(),
    supabase
      .from('subscriptions')
      .select(
        'id, status, tier_slug, services, brackets, monthly_total_zar, vat_zar, total_charge_zar, current_period_end, created_at'
      )
      .eq('client_org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!org || !sub) {
    return (
      <PortalEmptyState
        title="Your subscription is being set up"
        body="Your account is connected, but the subscription record isn't ready yet. Refresh in a few minutes — if it still looks empty, book a call and we'll sort it out."
      />
    );
  }

  const status = sub.status as SubscriptionStatus;
  const tierName = TIER_NAMES[sub.tier_slug as string] ?? sub.tier_slug;
  const services = Array.isArray(sub.services) ? (sub.services as string[]) : [];
  const servicesDisplay = services.length ? services.join(', ') : '—';

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 lg:py-16">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {org.name}
          </p>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Your subscription</h1>
            <StatusBadge status={status} />
          </div>
        </div>
        <SignOutButton className="shrink-0" />
      </header>

      <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">

        {/* Main column */}
        <div className="space-y-6">

          {/* Plan card */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Plan & services
            </h2>
            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Tier
                </dt>
                <dd className="font-medium">{tierName}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Services
                </dt>
                <dd className="font-medium capitalize">{servicesDisplay}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Monthly subtotal
                </dt>
                <dd className="font-mono font-medium">
                  {formatZAR(Number(sub.monthly_total_zar))}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  VAT (15%)
                </dt>
                <dd className="font-mono font-medium">
                  {formatZAR(Number(sub.vat_zar))}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <Separator className="my-1" />
              </div>
              <div className="sm:col-span-2 flex items-baseline justify-between">
                <dt className="text-sm font-semibold">Total monthly charge</dt>
                <dd className="font-mono font-bold text-lg">
                  {formatZAR(Number(sub.total_charge_zar))}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="outline" disabled className="gap-2">
                Change tier or services
              </Button>
              <Button
                variant="ghost"
                disabled
                className="gap-2 text-destructive hover:text-destructive"
              >
                Cancel with 30 days notice
              </Button>
            </div>
          </section>

          {/* Documents */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Documents
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Your monthly P&amp;L, balance sheet, VAT201 confirmations and IRP5s live in your shared Drive folder. Drop receipts and supporting documents into the same folder.
            </p>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              className="gap-2"
              render={<Link href="/portal/documents" />}
            >
              Open documents
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </section>

          {/* Finance */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <LineChart className="h-4 w-4 text-primary" />
              Finance
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              A daily snapshot of your numbers — cash, revenue, expenses and runway — pulled straight from Xero once your organisation is linked.
            </p>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              className="gap-2"
              render={<Link href="/portal/finance" />}
            >
              View finance
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </section>

          {/* Key dates */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Key dates
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              The SARS and statutory deadlines on the horizon — PAYE, VAT, provisional tax and employer reconciliations. We handle the filing; this keeps you in the loop.
            </p>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              className="gap-2"
              render={<Link href="/portal/dates" />}
            >
              See key dates
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </section>

          {/* Add-on services */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              Add-on services
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              Once-off jobs outside your monthly plan — tax returns, annual financial statements, CIPC filings and more. Billed separately, only when you need them.
            </p>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              className="gap-2"
              render={<Link href="/portal/shop" />}
            >
              Browse services
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </section>

          {/* Year-end planner */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Year-end planner
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              A prep checklist for your annual financial statements. Tick off what you&apos;ve gathered — the sooner it&apos;s complete, the sooner your AFS and tax return are done.
            </p>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              className="gap-2"
              render={<Link href="/portal/year-end" />}
            >
              Open planner
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </section>
        </div>

        {/* Right column */}
        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              At a glance
            </h2>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> Next billing
                </dt>
                <dd className="font-medium">
                  {formatLongDate(sub.current_period_end as string | null)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3" /> Subscription started
                </dt>
                <dd className="font-medium">
                  {formatLongDate(sub.created_at as string)}
                </dd>
              </div>
            </dl>
            <Link
              href="/portal/billing"
              className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              View billing history
              <ArrowRight className="h-3 w-3" />
            </Link>
          </section>

          <section className="rounded-xl border border-primary/25 bg-primary/[0.04] p-6">
            <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Need to speak to your accountant?
            </h2>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Your assigned accountant responds within one business day.
            </p>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a
                  href={siteConfig.links.booking}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              Book a 15-minute call
            </Button>
          </section>
        </aside>
      </div>
    </main>
  );
}

interface EmptyStateProps {
  title: string;
  body: string;
}

function PortalEmptyState({ title, body }: EmptyStateProps) {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16 lg:py-24 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 mb-5">
        <Lock className="h-5 w-5 text-primary" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-3">{title}</h1>
      <p className="text-sm text-muted-foreground leading-relaxed mb-8">
        {body}
      </p>
      <div className="flex flex-col items-center gap-3">
        <Button
          nativeButton={false}
          render={
            <a
              href={siteConfig.links.booking}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          Book a 15-minute call
        </Button>
        <SignOutButton />
      </div>
    </main>
  );
}
