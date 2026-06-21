import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  Layers,
  Lock,
  MessageSquare,
  Receipt,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { PortalOrgLabel } from '@/components/portal/PortalOrgLabel';
import { PortalFinanceSnapshot } from '@/components/portal/PortalFinanceSnapshot';
import { PortalSummaryHeader } from '@/components/portal/PortalSummaryHeader';
import { PortalQuickActions, type PortalQuickAction } from '@/components/portal/PortalQuickActions';
import { PortalKeyDatesWidget } from '@/components/portal/PortalKeyDatesWidget';
import { PORTAL_CARD, PORTAL_PANEL } from '@/components/portal/portalCard';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getPortalContext } from '@/lib/portal/portalContext';
import {
  getOrgFinance,
  getOrgRecord,
  getOrgSubscription,
  resolveUpcomingPayment,
} from '@/lib/portal/orgData';
import { upcomingKeyDates } from '@/config/keyDates';
import { formatZAR } from '@/lib/utils';
import { tierDisplayName } from '@/config/tiers';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Client Portal',
  description: 'Your Capucor subscription, documents and compliance status.',
  robots: { index: false },
};

export default async function PortalPage() {
  const { orgs, activeOrg } = await getPortalContext();

  if (!activeOrg) {
    return (
      <PortalEmptyState
        title="Your subscription is being set up"
        body="We're getting your account ready. Your subscription, documents and monthly reports will appear here once setup is complete. If this is taking longer than 24 hours, book a call so we can sort it out."
      />
    );
  }

  const admin = createSupabaseAdminClient();
  const [sub, org, finance] = await Promise.all([
    getOrgSubscription(admin, activeOrg.id),
    getOrgRecord(admin, activeOrg.id),
    getOrgFinance(admin, activeOrg.id),
  ]);

  if (!sub) {
    return (
      <PortalEmptyState
        title="Your subscription is being set up"
        body="Your account is connected, but the subscription record isn't ready yet. Refresh in a few minutes — if it still looks empty, book a call and we'll sort it out."
      />
    );
  }

  const tierName = tierDisplayName(sub.tier_slug);
  const services = Array.isArray(sub.services) ? sub.services : [];
  const servicesDisplay = services.length ? services.join(', ') : '—';

  const payment = resolveUpcomingPayment(sub);

  // Setup checklist — auto-hides once a client is fully connected.
  const setupSteps = [
    { label: 'Account activated', done: true, href: null as string | null },
    {
      label: 'Connect your shared Drive folder',
      done: Boolean(org?.drive_folder_url),
      href: '/portal/documents',
    },
    {
      label: 'Connect Xero for live finance',
      done: Boolean(org?.xero_connected_at),
      href: '/portal/finance',
    },
  ];
  const setupComplete = setupSteps.every((s) => s.done);

  const keyDates = upcomingKeyDates().slice(0, 3);

  const quickActions: PortalQuickAction[] = [
    { label: 'Billing', icon: Receipt, href: '/portal/billing' },
    { label: 'Documents', icon: FileText, href: '/portal/documents' },
    { label: 'Key dates', icon: CalendarClock, href: '/portal/dates' },
    { label: 'Book a call', icon: MessageSquare, href: siteConfig.links.booking, external: true },
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-12 lg:py-16">
      {/* Summary header */}
      <PortalSummaryHeader
        className="mb-6"
        orgLabel={<PortalOrgLabel orgs={orgs} activeOrg={activeOrg} />}
        heading={activeOrg.display_name}
        tierName={tierName}
        status={sub.status}
        monthlyZar={Number(sub.total_charge_zar)}
        payment={payment}
      />

      {/* Quick actions */}
      <PortalQuickActions actions={quickActions} className="mb-6" />

      {/* Setup checklist (new clients only) */}
      {!setupComplete && (
        <section className={`${PORTAL_PANEL} mb-6 p-6`}>
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
            <ClipboardList className="h-4 w-4 text-primary" />
            Get your portal set up
          </h2>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            A couple of steps left to switch everything on. We do the work — just point us at the
            right places.
          </p>
          <ul className="space-y-1">
            {setupSteps.map((step) => (
              <li key={step.label}>
                {step.done ? (
                  <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm text-muted-foreground line-through">{step.label}</span>
                  </div>
                ) : (
                  <Link
                    href={step.href ?? '/portal'}
                    className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-white/[0.04]"
                  >
                    <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium">{step.label}</span>
                    <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-6">
          {/* Upcoming key dates */}
          <PortalKeyDatesWidget dates={keyDates} seeAllHref="/portal/dates" />

          {/* Finance snapshot */}
          <PortalFinanceSnapshot finance={finance} />
        </div>

        {/* Right column */}
        <aside className="space-y-6">
          {/* Plan & services */}
          <section className={`${PORTAL_PANEL} p-6`}>
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <Layers className="h-4 w-4 text-primary" />
              Plan &amp; services
            </h2>
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tier
                </dt>
                <dd className="font-medium">{tierName}</dd>
              </div>
              <div>
                <dt className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Services
                </dt>
                <dd className="font-medium capitalize">{servicesDisplay}</dd>
              </div>
              <Separator />
              <div className="flex items-baseline justify-between">
                <dt className="font-semibold">Total monthly</dt>
                <dd className="font-mono text-base font-bold">
                  {formatZAR(Number(sub.total_charge_zar))}
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex flex-col gap-2">
              <Button variant="outline" size="sm" disabled className="justify-start">
                Change tier or services
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled
                className="justify-start text-destructive hover:text-destructive"
              >
                Cancel with 30 days notice
              </Button>
            </div>
          </section>

          {/* Explore */}
          <section>
            <h2 className="mb-2.5 px-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Explore
            </h2>
            <div className="space-y-2.5">
              <ExploreRow
                href="/portal/shop"
                icon={ShoppingBag}
                title="Add-on services"
                hint="Once-off jobs outside your plan"
              />
              <ExploreRow
                href="/portal/year-end"
                icon={ClipboardList}
                title="Year-end planner"
                hint="Prep checklist for your AFS"
              />
            </div>
          </section>

          {/* Accountant */}
          <section className={`${PORTAL_PANEL} p-6`}>
            <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
              <MessageSquare className="h-4 w-4 text-primary" />
              Speak to your accountant
            </h2>
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
              Your assigned accountant responds within one business day.
            </p>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={
                <a href={siteConfig.links.booking} target="_blank" rel="noopener noreferrer" />
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

function ExploreRow({
  href,
  icon: Icon,
  title,
  hint,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  hint: string;
}) {
  return (
    <Link href={href} className={`${PORTAL_CARD} flex items-center gap-3 p-4`}>
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
        <Icon className="h-4 w-4 text-primary" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{hint}</p>
      </div>
      <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

interface EmptyStateProps {
  title: string;
  body: string;
}

function PortalEmptyState({ title, body }: EmptyStateProps) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center lg:py-24">
      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
        <Lock className="h-5 w-5 text-primary" />
      </div>
      <h1 className="mb-3 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mb-8 text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="flex flex-col items-center gap-3">
        <Button
          nativeButton={false}
          render={<a href={siteConfig.links.booking} target="_blank" rel="noopener noreferrer" />}
        >
          Book a 15-minute call
        </Button>
      </div>
    </main>
  );
}
