import Link from 'next/link';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { PORTAL_PANEL } from '@/components/portal/portalCard';
import type { UpcomingKeyDate } from '@/config/keyDates';

// Glassy "upcoming key dates" widget shared by the client portal hub and the
// internal view-only client mirror. The static SARS/statutory calendar is the
// same for every client, so the page passes the resolved dates in. `seeAllHref`
// is optional — the portal links through to /portal/dates; the internal mirror
// has no dates tab and omits the link.

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function dueLabel(daysUntil: number): { text: string; cls: string } {
  if (daysUntil <= 0)
    return { text: 'Due today', cls: 'bg-destructive/15 text-destructive border-destructive/30' };
  if (daysUntil === 1) return { text: 'Tomorrow', cls: 'bg-warning/15 text-warning border-warning/30' };
  if (daysUntil <= 14)
    return { text: `In ${daysUntil} days`, cls: 'bg-warning/15 text-warning border-warning/30' };
  return { text: `In ${daysUntil} days`, cls: 'bg-muted text-muted-foreground border-border' };
}

export function PortalKeyDatesWidget({
  dates,
  seeAllHref,
  className,
}: {
  dates: UpcomingKeyDate[];
  seeAllHref?: string;
  className?: string;
}) {
  return (
    <section className={`${PORTAL_PANEL} p-6 ${className ?? ''}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="h-4 w-4 text-primary" />
          Upcoming key dates
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80"
          >
            See all
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <ul className="divide-y divide-border">
        {dates.map((d) => {
          const badge = dueLabel(d.daysUntil);
          return (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {d.tag}
                </span>
                <span className="truncate text-sm font-medium">{d.label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="text-xs text-muted-foreground">{formatShortDate(d.due)}</span>
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                >
                  {badge.text}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
