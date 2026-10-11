import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { BookkeepingDashboard } from '@/components/services/ServiceMiniDashboards';
import { ServiceCtaPair } from '@/components/services/ServiceCtaPair';
import { ServiceIncluded } from '@/components/services/ServiceIncluded';
import { ServiceConnects } from '@/components/services/ServiceConnects';
import { BOOKKEEPING } from '@/config/servicePages';
import { SectionDivider } from '@/components/ui/SectionDivider';

export const metadata: Metadata = {
  title: 'Monthly bookkeeping for SA businesses',
  description:
    'Monthly bookkeeping for owner-run South African businesses. Bank reconciliations, management accounts and Xero included.',
  alternates: { canonical: `${siteConfig.marketingUrl}/bookkeeping` },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    siteName: siteConfig.name,
    url: `${siteConfig.marketingUrl}/bookkeeping`,
    description:
      'Monthly bookkeeping for owner-run South African businesses. Bank reconciliations, management accounts and Xero included.',
    images: [{ url: `${siteConfig.marketingUrl}/api/og`, width: 1200, height: 630 }],
  },
};

export default function BookkeepingPage() {
  return (
    <>
      {/* Hero */}
      <section className="premium-section relative py-24 lg:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
                Know where your business really stands, every month
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-lg">
                Every transaction coded and reconciled in Xero each month, with your payroll in the same books and your VAT and tax returns built from them. Your P&amp;L and balance sheet arrive on your package&apos;s rhythm, and your accountant talks you through them.
              </p>
              <ServiceCtaPair />
            </div>
            <BookkeepingDashboard />
          </div>
        </div>
      </section>

      {/* What's included: the same four items as the homepage card */}
      <ServiceIncluded items={BOOKKEEPING.items} />

      {/* What this means for you */}
      <section className="premium-section py-14 lg:py-20">
        <SectionDivider />
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-2xl font-semibold mb-4">What this means for you</h2>
          <p className="text-muted-foreground leading-relaxed">
            A big client asks for a discount and you hesitate. Is this a good month, or just a busy
            one? You stop guessing from your bank balance: the answer is in your books, and so are
            we. When we spot a margin slipping or a debtor drifting, we raise it during the year,
            while you can still do something about it.
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
      <ServiceConnects current="bookkeeping" />
    </>
  );
}
