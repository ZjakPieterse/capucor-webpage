import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PricingCalculator } from '@/components/pricing/PricingCalculator';
import { PricingErrorBoundary, PricingUnavailable } from '@/components/pricing/PricingErrorBoundary';
import { siteConfig } from '@/config/site';
import type { PricingData, Testimonial } from '@/types';

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

async function getPricingData(): Promise<{
  pricing: PricingData;
  testimonials: Testimonial[];
} | null> {
  try {
    const supabase = await createSupabaseServerClient();

    const [servicesRes, bracketsRes, tiersRes, inclusionsRes, testimonialsRes] =
      await Promise.all([
        supabase
          .from('services')
          .select('*')
          .eq('active', true)
          .order('display_order'),
        supabase
          .from('brackets')
          .select('*')
          .eq('active', true)
          .order('display_order'),
        supabase
          .from('tiers')
          .select('*')
          .eq('active', true)
          .order('display_order'),
        supabase
          .from('tier_inclusions')
          .select('*')
          .order('display_order'),
        supabase
          .from('testimonials')
          .select('*')
          .eq('active', true)
          .order('display_order'),
      ]);

    if (
      servicesRes.error ||
      bracketsRes.error ||
      tiersRes.error ||
      inclusionsRes.error
    ) {
      throw new Error('Supabase query error');
    }

    const rawTestimonials = (testimonialsRes.data ?? []) as Testimonial[];
    // Filter out seed placeholders like "[Client Name]"
    const testimonials = rawTestimonials.filter(
      (t) => !t.name.startsWith('[') && !t.quote.startsWith('[')
    );

    const pricing: PricingData = {
      services: (servicesRes.data ?? []) as PricingData['services'],
      brackets: (bracketsRes.data ?? []) as PricingData['brackets'],
      tiers: (tiersRes.data ?? []) as PricingData['tiers'],
      inclusions: (inclusionsRes.data ?? []) as PricingData['inclusions'],
    };

    // A successful query can still come back empty (e.g. a transient Supabase
    // cold-start). The calculator can't function without these three essential
    // tables — treat empty as unavailable so users get the clear fallback
    // message instead of a dead step 1 with no options to select.
    if (
      pricing.services.length === 0 ||
      pricing.brackets.length === 0 ||
      pricing.tiers.length === 0
    ) {
      console.error('[pricing] empty pricing data', {
        services: pricing.services.length,
        brackets: pricing.brackets.length,
        tiers: pricing.tiers.length,
      });
      return null;
    }

    return { pricing, testimonials };
  } catch (err) {
    console.error('[pricing] supabase fetch failed', err);
    return null;
  }
}

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
