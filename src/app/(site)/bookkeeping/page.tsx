import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { ServiceCtaPair } from '@/components/services/ServiceCtaPair';
import { ServiceHero } from '@/components/services/ServiceHero';
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
      {/* Hero: text only, so the inclusions below carry the page */}
      <ServiceHero service={BOOKKEEPING} title="Know where your business really stands, every month">
        Every transaction coded and reconciled in Xero each month, with your payroll in the same books and your VAT and tax returns built from them. Regular reports show you where you stand, and your accountant talks you through them.
      </ServiceHero>

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
            Fixed monthly fee. Build your exact subscription in minutes.
          </p>
          <ServiceCtaPair centered />
        </div>
      </section>

      {/* How it connects: the other two disciplines, as on the homepage cards */}
      <ServiceConnects current="bookkeeping" />
    </>
  );
}
