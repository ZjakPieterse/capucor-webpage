import type { Metadata } from 'next';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { siteConfig } from '@/config/site';
import type { Service, Tier } from '@/types';

import { HeroSection } from '@/components/landing/HeroSection';
import { PartnersAndTech } from '@/components/landing/PartnersAndTech';
import { ProblemCards } from '@/components/landing/ProblemCards';
import { ServicePillars } from '@/components/landing/ServicePillars';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { PackagesTeaser } from '@/components/landing/PackagesTeaser';
import { TechStackShowcase } from '@/components/landing/TechStackShowcase';
import { FaqAccordion } from '@/components/landing/FaqAccordion';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { PageCursorGlow } from '@/components/landing/PageCursorGlow';
import { ScrollToTopOnMount } from '@/components/landing/ScrollToTopOnMount';

export function generateMetadata(): Metadata {
  return {
    title: { absolute: 'Capucor Business Solutions | Outsourced Finance for SMEs' },
    description: siteConfig.description,
    alternates: { canonical: siteConfig.url },
    openGraph: {
      type: 'website',
      locale: 'en_ZA',
      url: siteConfig.url,
      title: { absolute: 'Capucor Business Solutions | Outsourced Finance for SMEs' },
      description: siteConfig.description,
      siteName: siteConfig.name,
      images: [{ url: `${siteConfig.url}/api/og`, width: 1200, height: 630 }],
    },
  };
}

async function getLandingData(): Promise<{
  services: Service[];
  tiers: Tier[];
}> {
  try {
    const supabase = await createSupabaseServerClient();

    const [servicesRes, tiersRes] = await Promise.all([
      supabase
        .from('services')
        .select('*')
        .eq('active', true)
        .order('display_order')
        .returns<Service[]>(),
      supabase
        .from('tiers')
        .select('*')
        .eq('active', true)
        .order('display_order')
        .returns<Tier[]>(),
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
            url: siteConfig.url,
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
        {/* 6. Packages */}
        <PackagesTeaser services={services} tiers={tiers} />
        {/* 7. Tech stack */}
        <TechStackShowcase />
        {/* 8. Testimonials / social proof — placeholder. Section is intentionally hidden until real client quotes are collected. See AGENT.md → Phase 2 Pending Items. */}
        {/* 9. FAQ */}
        <FaqAccordion />
        {/* 10. Final CTA */}
        <FinalCTA />
      </PageCursorGlow>
    </>
  );
}
