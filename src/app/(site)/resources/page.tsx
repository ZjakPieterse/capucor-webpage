import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ListChecks } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { LeadMagnetSignup } from '@/components/landing/LeadMagnetSignup';

// The free resources in one place. The compliance-calendar sign-up moved here
// from the homepage "Start a conversation" section (decision 2026-10-12).
const PAGE_TITLE = 'Free resources for South African SMEs';
const PAGE_DESCRIPTION =
  'A one-page compliance calendar of SARS, CIPC and payroll deadlines, and the checklist of what a new Capucor client gathers before their first month.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${siteConfig.marketingUrl}/resources` },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: `${siteConfig.marketingUrl}/resources`,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: siteConfig.name,
    images: [{ url: `${siteConfig.marketingUrl}/api/og`, width: 1200, height: 630 }],
  },
};

export default function ResourcesPage() {
  return (
    <section className="premium-section py-14 lg:py-20">
      <div className="mx-auto max-w-5xl px-6">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Free resources</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Practical one-pagers for running a South African small business.
          </p>
        </header>

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="premium-glass rounded-2xl border border-white/10 bg-card/75 p-6 sm:p-8">
            <LeadMagnetSignup />
          </div>

          <div className="premium-glass rounded-2xl border border-white/10 bg-card/75 p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <ListChecks className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold">Onboarding checklist</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  What a new client gathers before their first month: CIPC and SARS details, UIF
                  and COIDA references, opening balances and payroll details.
                </p>
              </div>
            </div>
            <Link
              href="/resources/onboarding-checklist"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              Open the checklist <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
