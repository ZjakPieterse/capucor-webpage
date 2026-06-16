import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CalendarClock, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPortalContext } from '@/lib/portal/portalContext';
import { PortalOrgLabel } from '@/components/portal/PortalOrgLabel';
import { siteConfig } from '@/config/site';
import { upcomingKeyDates } from '@/config/keyDates';

export const metadata: Metadata = {
  title: 'Key dates',
  description: 'Upcoming SARS and statutory deadlines for your business.',
  robots: { index: false },
};

function formatLongDate(d: Date): string {
  return d.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function dueLabel(daysUntil: number): { text: string; cls: string } {
  if (daysUntil <= 0) return { text: 'Due today', cls: 'bg-destructive/15 text-destructive border-destructive/30' };
  if (daysUntil === 1) return { text: 'Tomorrow', cls: 'bg-warning/15 text-warning border-warning/30' };
  if (daysUntil <= 14) return { text: `In ${daysUntil} days`, cls: 'bg-warning/15 text-warning border-warning/30' };
  return { text: `In ${daysUntil} days`, cls: 'bg-muted text-muted-foreground border-border' };
}

export default async function PortalKeyDatesPage() {
  // General SARS reference — useful even before the org is fully provisioned, so
  // we gate on a session only (getPortalContext → requireSession) and personalise
  // the header when an org exists.
  const { orgs, activeOrg } = await getPortalContext();

  const dates = upcomingKeyDates();

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
        <PortalOrgLabel orgs={orgs} activeOrg={activeOrg} />
        <h1 className="text-3xl font-bold tracking-tight">Key dates</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-prose">
          The standard SARS and statutory deadlines on the horizon. Your assigned accountant manages every submission — this list is here so nothing catches you by surprise.
        </p>
      </header>

      <ul className="space-y-3">
        {dates.map((d) => {
          const badge = dueLabel(d.daysUntil);
          return (
            <li
              key={d.id}
              className="rounded-xl border border-border bg-card p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <CalendarClock className="h-4 w-4 text-primary" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold">{d.label}</h2>
                      <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wide text-muted-foreground">
                        {d.tag}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mt-0.5">
                      {d.cadence}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{formatLongDate(d.due)}</p>
                  <span
                    className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                  >
                    {badge.text}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {d.detail}
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 rounded-xl border border-dashed border-border bg-card p-5">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
          <Info className="h-4 w-4 text-primary" />
          A note on these dates
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Exact deadlines shift for weekends, public holidays, your VAT category and your financial year-end. Two more land on your calendar each year but depend on your own dates: your <span className="font-medium text-foreground">CIPC annual return</span> (within 30 business days of your registration anniversary) and your <span className="font-medium text-foreground">company income tax return, ITR14</span> (within 12 months of your year-end). We track all of these for you.
        </p>
        <div className="mt-4">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={
              <a href={siteConfig.links.booking} target="_blank" rel="noopener noreferrer" />
            }
          >
            Talk through your calendar
          </Button>
        </div>
      </div>
    </main>
  );
}
