import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Square } from 'lucide-react';
import { siteConfig } from '@/config/site';
import {
  ONBOARDING_CHECKLIST,
  ONBOARDING_CHECKLIST_META,
} from '@/config/onboardingChecklist';
import { PrintButton } from '../compliance-calendar/PrintButton';

// The "What we'll need" card from Your first 90 days, printable, with a line
// on each item (onboarding-checklist config). Ungated: it is what a fitting
// visitor needs to start gathering before they sign.
const PAGE_DESCRIPTION =
  'What a new Capucor client gathers before their first month: CIPC and SARS details, UIF and COIDA references, opening balances and payroll details.';

export const metadata: Metadata = {
  title: 'Onboarding checklist: what we need to start',
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${siteConfig.marketingUrl}/resources/onboarding-checklist` },
  openGraph: {
    type: 'article',
    locale: 'en_ZA',
    url: `${siteConfig.marketingUrl}/resources/onboarding-checklist`,
    title: 'Onboarding checklist: what we need to start',
    description: PAGE_DESCRIPTION,
    siteName: siteConfig.name,
    images: [{ url: `${siteConfig.marketingUrl}/api/og`, width: 1200, height: 630 }],
  },
};

export default function OnboardingChecklistPage() {
  return (
    <div className="print-doc py-14 lg:py-20">
      <div className="mx-auto max-w-3xl px-6">
        <header className="border-b border-white/10 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {ONBOARDING_CHECKLIST_META.title}
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">
            {ONBOARDING_CHECKLIST_META.subtitle}
          </p>
          <div className="no-print mt-5">
            <PrintButton />
          </div>
        </header>

        <ul className="mt-8 divide-y divide-white/10 rounded-xl border border-white/10">
          {ONBOARDING_CHECKLIST.map((c) => (
            <li key={c.item} className="flex gap-4 p-4 sm:p-5">
              <Square className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <h2 className="font-medium">{c.item}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 rounded-lg border border-white/10 bg-card/50 p-4 text-sm leading-relaxed text-muted-foreground">
          Can&apos;t find something? Send what you have and tell us what&apos;s missing. We&apos;ll
          chase the rest, and with your go-ahead we ask your previous accountant for it.
        </p>

        <div className="no-print mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
          <p className="text-base font-medium">Ready when you are</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Build your subscription for an exact monthly price, or see how your first 90 days
            run.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link
              href="/pricing"
              className="premium-button inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Build your subscription <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/#first-90-days"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-5 py-2 text-sm font-medium hover:border-primary/30"
            >
              See your first 90 days
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
