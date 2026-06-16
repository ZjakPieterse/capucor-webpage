import type { Metadata } from 'next';
import { getPricingData } from '@/lib/pricing/getPricingData';
import { PricingCalculator } from '@/components/pricing/PricingCalculator';
import { PricingErrorBoundary, PricingUnavailable } from '@/components/pricing/PricingErrorBoundary';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Pricing Calculator',
  description:
    'Build your exact subscription. Transparent, fixed monthly pricing for accounting, bookkeeping, and payroll.',
  alternates: { canonical: `${siteConfig.url}/pricing` },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: `${siteConfig.url}/pricing`,
    description:
      'Build your exact subscription. Transparent, fixed monthly pricing for accounting, bookkeeping, and payroll.',
    images: [{ url: `${siteConfig.url}/api/og?page=pricing`, width: 1200, height: 630 }],
  },
};

// ISR: cache for an hour via the OpenNext KV incremental cache. Pricing edits
// in Supabase show up after POST /api/revalidate?secret=... (or within the hour).
export const revalidate = 3600;

export default async function PricingPage() {
  const data = await getPricingData();

  if (!data) {
    return <PricingUnavailable />;
  }

  return (
    <PricingErrorBoundary>
      <PricingCalculator data={data.pricing} testimonials={data.testimonials} />
    </PricingErrorBoundary>
  );
}
