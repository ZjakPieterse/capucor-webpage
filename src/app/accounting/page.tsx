import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookMarked, Users } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { AccountingDashboard } from '@/components/services/ServiceMiniDashboards';
import { PageCursorGlow } from '@/components/landing/PageCursorGlow';
import { SectionDivider } from '@/components/ui/SectionDivider';

export const metadata: Metadata = {
  title: 'Outsourced Accounting for SMEs',
  description:
    'Annual financial statements, tax returns, and CIPC compliance for South African SMEs. Done properly, on time.',
  alternates: { canonical: `${siteConfig.url}/accounting` },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: `${siteConfig.url}/accounting`,
    description:
      'Annual financial statements, tax returns, and CIPC compliance for South African SMEs. Done properly, on time.',
    images: [{ url: `${siteConfig.url}/api/og`, width: 1200, height: 630 }],
  },
};

const INCLUDED = [
  {
    title: 'Annual financial statements',
    description:
      "Compiled by a professional accountant each year and signed off correctly. Whether you need them for SARS, your bank, a potential investor, or just to understand where your business stands, they're ready when you need them.",
  },
  {
    title: 'Income tax and provisional tax',
    description:
      'Your income tax return filed before the SARS deadline, and your provisional tax calculated and submitted on time for both the August and February cycles. No late-filing penalties, no guesswork on the estimates.',
  },
  {
    title: 'VAT201 reporting and submission',
    description:
      'Your VAT return prepared and submitted every cycle, monthly or bi-monthly depending on your registration. Input and output VAT reconciled correctly before each submission goes in.',
  },
  {
    title: 'CIPC annual return filings',
    description:
      "Your company's annual return filed with CIPC every year, before the due date. It's a straightforward requirement that carries real consequences if missed: deregistration risk, director liability.",
  },
];

const OTHER_SERVICES = [
  { title: 'Bookkeeping', href: '/bookkeeping', icon: BookMarked },
  { title: 'Payroll', href: '/payroll', icon: Users },
];

export default function AccountingPage() {
  return (
    <PageCursorGlow>
      {/* Hero */}
      <section className="premium-section relative py-24 lg:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">
                Accounting
              </p>
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
                Financial statements, tax returns and CIPC, handled before the deadlines move
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                Annual financials, provisional and income tax, VAT201 and CIPC annual returns. A SAICA-registered accountant signs off on the file before anything reaches SARS.
              </p>
              <Link
                href="/pricing"
                className="premium-button inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Build your subscription
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <AccountingDashboard />
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
            At year-end, you don&apos;t chase an accountant or scramble to find documents. Your
            financials are ready when SARS needs them, when your bank asks, and when you want to
            know where your business stands. Filings go in on time. If SARS ever asks, your
            records are clean.
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
