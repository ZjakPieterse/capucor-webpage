import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { AccountingDashboard } from '@/components/services/ServiceMiniDashboards';
import { ServiceCtaPair } from '@/components/services/ServiceCtaPair';
import { ServiceIncluded } from '@/components/services/ServiceIncluded';
import { ServiceConnects } from '@/components/services/ServiceConnects';
import { ACCOUNTING } from '@/config/servicePages';
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

export default function AccountingPage() {
  return (
    <>
      {/* Hero */}
      <section className="premium-section relative py-24 lg:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
                Compliance, covered, from SARS returns to your annual financials
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                Your tax returns, VAT201, CIPC annual return and annual financial statements, built from the books and payroll we run every month. Each one is prepared on a calendar and checked before it goes in, so you know what&apos;s due before it lands.
              </p>
              <ServiceCtaPair />
            </div>
            <AccountingDashboard />
          </div>
        </div>
      </section>

      {/* What's included: the same four items as the homepage card */}
      <ServiceIncluded items={ACCOUNTING.items} />

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

      {/* How it connects: the other two disciplines, as on the homepage cards */}
      <ServiceConnects current="accounting" />
    </>
  );
}
