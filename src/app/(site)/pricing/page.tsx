import type { Metadata } from 'next';
import { getPricingData } from '@/lib/pricing/getPricingData';
import { isBuildPrerender } from '@/lib/pricing/isBuildPrerender';
import { PricingCalculator } from '@/components/pricing/PricingCalculator';
import { PricingErrorBoundary, PricingUnavailable } from '@/components/pricing/PricingErrorBoundary';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Build your subscription',
  description:
    'Build your exact subscription: a few quick questions, then your fixed monthly fee for accounting, bookkeeping and payroll. No sign-up needed.',
  alternates: { canonical: `${siteConfig.marketingUrl}/pricing` },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    siteName: siteConfig.name,
    url: `${siteConfig.marketingUrl}/pricing`,
    description:
      'Build your exact subscription: a few quick questions, then your fixed monthly fee for accounting, bookkeeping and payroll. No sign-up needed.',
    images: [{ url: `${siteConfig.marketingUrl}/api/og?page=pricing`, width: 1200, height: 630 }],
  },
};

// ISR: cache for an hour via the OpenNext KV incremental cache. Pricing edits
// in Supabase show up after POST /api/revalidate?secret=... (or within the hour).
export const revalidate = 3600;

export default async function PricingPage() {
  const data = await getPricingData();

  if (!data) {
    // At runtime, throw: an ISR regeneration that throws keeps serving the
    // last good page, where rendering the fallback would cache "unavailable"
    // for the whole hour after one Supabase blip (Zjak, 2026-10-13, option a).
    // With nothing cached, error.tsx shows the fallback with a retry. The
    // build prerenders this page (and the offline build has no database), so
    // the build keeps rendering the fallback; ISR replaces it on first revalidate.
    if (isBuildPrerender()) return <PricingUnavailable />;
    throw new Error('pricing data unavailable after retries');
  }

  return (
    <PricingErrorBoundary>
      <PricingCalculator data={data.pricing} testimonials={data.testimonials} />
    </PricingErrorBoundary>
  );
}
