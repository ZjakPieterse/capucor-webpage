import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';
import { ServiceCtaPair } from '@/components/services/ServiceCtaPair';
import { ServiceHero } from '@/components/services/ServiceHero';
import { ServiceIncluded } from '@/components/services/ServiceIncluded';
import { ServiceConnects } from '@/components/services/ServiceConnects';
import { PAYROLL } from '@/config/servicePages';
import { SectionDivider } from '@/components/ui/SectionDivider';

export const metadata: Metadata = {
  title: 'Payroll for SA employers',
  description:
    'Monthly payroll for South African employers: payslips, EMP201, EMP501, UIF, COIDA and IRP5s, on one fixed monthly subscription.',
  alternates: { canonical: `${siteConfig.marketingUrl}/payroll` },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    siteName: siteConfig.name,
    url: `${siteConfig.marketingUrl}/payroll`,
    description:
      'Monthly payroll for South African employers: payslips, EMP201, EMP501, UIF, COIDA and IRP5s, on one fixed monthly subscription.',
    images: [{ url: `${siteConfig.marketingUrl}/api/og`, width: 1200, height: 630 }],
  },
};

export default function PayrollPage() {
  return (
    <>
      {/* Hero: text only, so the inclusions below carry the page */}
      <ServiceHero service={PAYROLL} title="Pay day without the panic, and every submission on its cycle">
        It&apos;s the 25th and your team is waiting to be paid. You approve the run and the payslips go out. The EMP201, UIF, the EMP501 with IRP5s and the COIDA Return of Earnings each follow on their own cycle, and the wages land straight in your books, next to your VAT and provisional tax.
      </ServiceHero>

      {/* What's included: the same four items as the homepage card */}
      <ServiceIncluded items={PAYROLL.items} />

      {/* What this means for you */}
      <section className="premium-section py-14 lg:py-20">
        <SectionDivider />
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-2xl font-semibold mb-4">What this means for you</h2>
          <p className="text-muted-foreground leading-relaxed">
            Your people get paid correctly, and you stop keeping SARS dates in your head. When you
            hire, give a raise or someone leaves, you tell us once and it flows through payroll,
            your books and your tax. Because we see payroll next to the rest of your numbers, we
            can tell you what a new hire really costs before you make the offer.
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
      <ServiceConnects current="payroll" />
    </>
  );
}
