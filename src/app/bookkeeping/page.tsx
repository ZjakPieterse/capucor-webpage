import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart2, Users } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { BookkeepingDashboard } from '@/components/services/ServiceMiniDashboards';
import { PageCursorGlow } from '@/components/landing/PageCursorGlow';
import { SectionDivider } from '@/components/ui/SectionDivider';

export const metadata: Metadata = {
  title: 'Bookkeeping for SA SMEs',
  description:
    'Real-time bookkeeping for South African SMEs. Monthly reconciliations, management accounts, and Xero included.',
  alternates: { canonical: `${siteConfig.url}/bookkeeping` },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: `${siteConfig.url}/bookkeeping`,
    description:
      'Real-time bookkeeping for South African SMEs. Monthly reconciliations, management accounts, and Xero included.',
    images: [{ url: `${siteConfig.url}/api/og`, width: 1200, height: 630 }],
  },
};

const INCLUDED = [
  {
    title: 'Xero included',
    description:
      "Your Xero subscription is part of the service, set up correctly for your business from day one. You get access to proper cloud accounting software, the same platform your bookkeeper works in, without paying for it separately or setting it up yourself.",
  },
  {
    title: 'Transaction processing and categorisation',
    description:
      'Every transaction from your bank feeds captured and coded to the right account each month. Your books reflect your actual business activity, not a rough approximation of it.',
  },
  {
    title: 'Monthly bank reconciliations',
    description:
      'Every bank account and credit card reconciled against your actual statements each month. By the time the new month starts, your books match your bank, and any discrepancies have already been investigated.',
  },
  {
    title: 'Monthly management accounts',
    description:
      'A profit and loss statement and balance sheet delivered every month. Pull them any time to see how the business is performing, what your cash position is, and whether your margins are holding.',
  },
];

const OTHER_SERVICES = [
  { title: 'Accounting', href: '/accounting', icon: BarChart2 },
  { title: 'Payroll', href: '/payroll', icon: Users },
];

export default function BookkeepingPage() {
  return (
    <PageCursorGlow>
      {/* Hero */}
      <section className="premium-section relative py-24 lg:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">
                Bookkeeping
              </p>
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
                Your ledger, reconciled before the new month starts
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                Every transaction processed, categorised and reconciled against your bank statements each month. By the time the new month begins, your P&amp;L and balance sheet are already there.
              </p>
              <Link
                href="/pricing"
                className="premium-button inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Build your subscription
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <BookkeepingDashboard />
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="premium-section py-14 lg:py-20">
        <SectionDivider />
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-semibold mb-8 text-center">What&apos;s included</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {INCLUDED.map((item) => (
              <div
                key={item.title}
                className="feature-card premium-card rounded-xl border border-white/10 bg-card/80 p-6"
              >
                <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What this means for you */}
      <section className="premium-section py-14 lg:py-20">
        <SectionDivider />
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-2xl font-semibold mb-4">What this means for you</h2>
          <p className="text-muted-foreground leading-relaxed">
            You stop running your business on gut feel and bank balance. You have a real P&amp;L, a
            clean balance sheet, and books your accountant can sign off on. At year-end,
            there&apos;s nothing to scramble for. When you need to decide whether to hire, invest,
            or pull back, the numbers are already there.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="premium-section py-14 lg:py-20">
        <SectionDivider />
        <div className="max-w-xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-semibold mb-3">See what it costs</h2>
          <p className="text-muted-foreground mb-8">
            Flat monthly pricing. Build your exact subscription in minutes.
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Build your subscription →
          </a>
        </div>
      </section>

      {/* Other services */}
      <section className="premium-section py-14 lg:py-20">
        <SectionDivider />
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-lg font-semibold mb-6 text-muted-foreground">Other services</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {OTHER_SERVICES.map((svc) => (
              <a
                key={svc.title}
                href={svc.href}
                className="feature-card premium-card flex items-center gap-4 rounded-xl border border-white/10 bg-card/80 px-6 py-5"
              >
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <svc.icon className="h-5 w-5 text-foreground" />
                </div>
                <span className="text-sm font-medium">{svc.title}</span>
                <span className="ml-auto text-muted-foreground text-sm">→</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </PageCursorGlow>
  );
}
