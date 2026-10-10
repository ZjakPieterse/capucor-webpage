import type { Metadata } from 'next';
import { BookMarked, Users } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { AccountingDashboard } from '@/components/services/ServiceMiniDashboards';
import { ServiceCtaPair } from '@/components/services/ServiceCtaPair';
import { SectionDivider } from '@/components/ui/SectionDivider';

export const metadata: Metadata = {
  title: 'Outsourced accounting for SA businesses',
  description:
    'Annual financial statements, income and provisional tax, VAT201 and CIPC returns for owner-run South African businesses, on one fixed monthly subscription.',
  alternates: { canonical: `${siteConfig.marketingUrl}/accounting` },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    siteName: siteConfig.name,
    url: `${siteConfig.marketingUrl}/accounting`,
    description:
      'Annual financial statements, income and provisional tax, VAT201 and CIPC returns for owner-run South African businesses, on one fixed monthly subscription.',
    images: [{ url: `${siteConfig.marketingUrl}/api/og`, width: 1200, height: 630 }],
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
      'Your income tax return prepared and filed before the SARS deadline, and your provisional tax calculated and submitted for both the August and February cycles, when we have your information in time.',
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
  { title: 'Bookkeeping', note: 'The books your returns are built from', href: '/bookkeeping', icon: BookMarked },
  { title: 'Payroll', note: 'PAYE and wages, already in the numbers', href: '/payroll', icon: Users },
];

export default function AccountingPage() {
  return (
    <>
      {/* Hero */}
      <section className="premium-section relative py-24 lg:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
                No surprises from SARS, because we&apos;ve watched the year with you
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                VAT201, provisional and income tax, CIPC annual returns and your annual financial statements, built from the books and payroll we run every month. Each one is prepared on a calendar and checked before anything reaches SARS, so year-end is just another month.
              </p>
              <ServiceCtaPair />
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
            Provisional tax comes round and you already have a good idea of the amount. The bank
            asks for financials and they come from books that are already up to date. Because we
            talk to you during the year, we plan the tax with you while the year is still open,
            and you hear from us long before the year-end bill.
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
          <ServiceCtaPair centered />
        </div>
      </section>

      {/* Other services */}
      <section className="premium-section py-14 lg:py-20">
        <SectionDivider />
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-lg font-semibold mb-6 text-muted-foreground">How it connects</h2>
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
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{svc.title}</span>
                  <span className="text-xs text-muted-foreground">{svc.note}</span>
                </span>
                <span className="ml-auto text-muted-foreground text-sm">→</span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
