import type { Metadata } from 'next';
import { createSupabaseAnonClient } from '@/lib/supabase/anon';
import { siteConfig } from '@/config/site';
import type { Service, Tier } from '@/types';

import { HeroSection } from '@/components/landing/HeroSection';
import { PartnersAndTech } from '@/components/landing/PartnersAndTech';
import { ProblemCards } from '@/components/landing/ProblemCards';
import { ServicePillars } from '@/components/landing/ServicePillars';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { PackagesTeaser } from '@/components/landing/PackagesTeaser';
import { ContactSection } from '@/components/landing/ContactSection';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { PageCursorGlow } from '@/components/landing/PageCursorGlow';
import { ScrollToTopOnMount } from '@/components/landing/ScrollToTopOnMount';

// ISR: cache for an hour via the OpenNext KV incremental cache. Pricing edits
// in Supabase show up after POST /api/revalidate?secret=... (or within the hour).
export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return {
    title: { absolute: 'Capucor Business Solutions | Outsourced Finance for SMEs' },
    description: siteConfig.description,
    alternates: { canonical: siteConfig.marketingUrl },
    openGraph: {
      type: 'website',
      locale: 'en_ZA',
      url: siteConfig.marketingUrl,
      title: { absolute: 'Capucor Business Solutions | Outsourced Finance for SMEs' },
      description: siteConfig.description,
      siteName: siteConfig.name,
      images: [{ url: `${siteConfig.marketingUrl}/api/og`, width: 1200, height: 630 }],
    },
  };
}

async function getLandingData(): Promise<{
  services: Service[];
  tiers: Tier[];
}> {
  try {
    // Public pricing config — read as `anon` so it works for signed-in visitors too.
    const supabase = createSupabaseAnonClient();

    const [servicesRes, tiersRes] = await Promise.all([
      supabase
        .from('services')
        .select('*')
        .eq('active', true)
        .order('display_order'),
      supabase
        .from('tiers')
        .select('*')
        .eq('active', true)
        .order('display_order'),
    ]);

    return {
      services: servicesRes.data ?? [],
      tiers: tiersRes.data ?? [],
    };
  } catch (err) {
    console.error('[landing] supabase fetch failed', err);
    return { services: [], tiers: [] };
  }
}

export default async function HomePage() {
  const { services, tiers } = await getLandingData();

  return (
    <>
      <ScrollToTopOnMount />
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'AccountingService',
            name: 'Capucor Business Solutions',
            url: siteConfig.marketingUrl,
            description: siteConfig.description,
            areaServed: 'ZA',
            sameAs: [
              siteConfig.links.facebook,
              siteConfig.links.instagram,
              siteConfig.links.linkedin,
            ],
          }),
        }}
      />

      <PageCursorGlow>
        {/* 1. Hero */}
        <HeroSection />
        {/* 2. Partners & tech logo strip (real brand marks, monochrome via .logo-mark) */}
        <PartnersAndTech />
        {/* 3. Problem */}
        <ProblemCards />
        {/* 4. How the monthly finance system works (now carries the outcome line per step) */}
        <HowItWorks />
        {/* 5. Services */}
        <ServicePillars />
        {/* 6. Testimonials / social proof — placeholder between Services and Packages. Hidden until real client quotes are collected. See AGENTS.md → Pending Content. */}
        {/* 7. Packages */}
        <PackagesTeaser services={services} tiers={tiers} />
        {/* 8. Contact + lead capture (replaced the homepage FAQ). */}
        <ContactSection />
        {/* 9. Final CTA */}
        <FinalCTA />
      </PageCursorGlow>
    </>
  );
}
