import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { siteConfig } from '@/config/site';
import {
  COMPLIANCE_CALENDAR,
  COMPLIANCE_CALENDAR_META,
} from '@/config/complianceCalendar';
import { PrintButton } from './PrintButton';

const PAGE_DESCRIPTION =
  'A one-page guide to the recurring SARS, CIPC and payroll deadlines South African small businesses need to meet: PAYE, VAT, provisional tax, EMP501, CIPC annual returns and more.';

export const metadata: Metadata = {
  title: 'SARS, CIPC & payroll compliance calendar for SA SMEs',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${siteConfig.url}/resources/compliance-calendar` },
  openGraph: {
    type: 'article',
    locale: 'en_ZA',
    url: `${siteConfig.url}/resources/compliance-calendar`,
    title: 'SARS, CIPC & payroll compliance calendar for SA SMEs',
    description: PAGE_DESCRIPTION,
    siteName: siteConfig.name,
    images: [{ url: `${siteConfig.url}/api/og`, width: 1200, height: 630 }],
  },
};

export default function ComplianceCalendarPage() {
  return (
    <div className="print-doc py-14 lg:py-20">
      <div className="mx-auto max-w-3xl px-6">
        {/* Header */}
        <header className="border-b border-white/10 pb-6">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            Capucor resource
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            {COMPLIANCE_CALENDAR_META.title}
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
            {COMPLIANCE_CALENDAR_META.subtitle}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              Reviewed {COMPLIANCE_CALENDAR_META.lastReviewed}
            </p>
            <div className="no-print">
              <PrintButton />
            </div>
          </div>
        </header>

        {/* Calendar groups */}
        <div className="mt-8 space-y-8">
          {COMPLIANCE_CALENDAR.map((group) => (
            <section key={group.cadence}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {group.cadence}
              </h2>
              <ul className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10">
                {group.items.map((item) => (
                  <li key={item.name} className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <h3 className="font-medium">{item.name}</h3>
                      <span className="text-sm font-semibold text-primary whitespace-nowrap">
                        {item.when}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                      {item.who}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {item.detail}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Disclaimer */}
        <p className="mt-8 rounded-lg border border-white/10 bg-card/50 p-4 text-xs leading-relaxed text-muted-foreground">
          {COMPLIANCE_CALENDAR_META.disclaimer}
        </p>

        {/* CTA — hidden in print */}
        <div className="no-print mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
          <p className="text-base font-medium">
            Want these handled without watching the calendar?
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Capucor runs your accounting, payroll and tax on a fixed monthly subscription, with
            every deadline tracked for you.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/pricing"
              className="premium-button inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Build your subscription <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/#contact"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-5 py-2 text-sm font-medium hover:border-primary/30"
            >
              Talk to us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
