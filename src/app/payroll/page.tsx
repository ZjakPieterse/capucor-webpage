import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart2, BookMarked } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { PayrollDashboard } from '@/components/services/ServiceMiniDashboards';
import { PageCursorGlow } from '@/components/landing/PageCursorGlow';
import { SectionDivider } from '@/components/ui/SectionDivider';

export const metadata: Metadata = {
  title: 'Payroll for SA Businesses',
  description:
    'Accurate, compliant payroll for South African staff teams of any size. PAYE, UIF, and IRP5s handled.',
  alternates: { canonical: `${siteConfig.url}/payroll` },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: `${siteConfig.url}/payroll`,
    description:
      'Accurate, compliant payroll for South African staff teams of any size. PAYE, UIF, and IRP5s handled.',
    images: [{ url: `${siteConfig.url}/api/og`, width: 1200, height: 630 }],
  },
};

const INCLUDED = [
  {
    title: 'Payroll processing and payslips',
    description:
      'Your payroll calculated correctly each month: gross pay, deductions, net pay, and any variable items like overtime or commissions. Payslips issued to every employee before pay day, and your payroll records kept up to date.',
  },
  {
    title: 'PAYE and UIF submissions',
    description:
      'Your EMP201 prepared and submitted to SARS every month before the seventh. Employee PAYE deducted correctly, UIF contributions calculated for both employee and employer, and the payment reconciled to your declaration.',
  },
  {
    title: 'COIDA compliance',
    description:
      'Your Return of Earnings filed with the Compensation Fund each year before the March deadline. Your COIDA assessment calculated correctly based on your actual payroll figures.',
  },
  {
    title: 'IRP5 certificates',
    description:
      'Year-end IRP5 certificates issued for every employee and submitted to SARS via the EMP501 reconciliation. Done before the May deadline so your employees can file their personal tax returns without delays.',
  },
];

const OTHER_SERVICES = [
  { title: 'Accounting', href: '/accounting', icon: BarChart2 },
  { title: 'Bookkeeping', href: '/bookkeeping', icon: BookMarked },
];

export default function PayrollPage() {
  return (
    <PageCursorGlow>
      {/* Hero */}
      <section className="premium-section relative py-24 lg:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-4">
                Payroll
              </p>
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
                Payslips, EMP201 and IRP5s done before SARS comes asking
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                Every payslip calculated, every PAYE and UIF submission filed by the seventh, COIDA Return of Earnings filed annually. IRP5 certificates ready before the May deadline.
              </p>
              <Link
                href="/pricing"
                className="premium-button inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
              >
                Build your subscription
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <PayrollDashboard />
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
            Your staff get paid correctly and on time. SARS filings go in before the seventh,
            every month. At year-end, your IRP5s are issued before the deadline so your employees
            can file their personal tax without waiting on you.
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
            className="premium-button inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
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
