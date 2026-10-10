import type { Metadata } from 'next';
import { siteConfig } from '@/config/site';

import { HeroSection } from '@/components/landing/HeroSection';
import { PartnersAndTech } from '@/components/landing/PartnersAndTech';
import { ProblemCards } from '@/components/landing/ProblemCards';
import { ServicePillars } from '@/components/landing/ServicePillars';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { SwitchingSection } from '@/components/landing/SwitchingSection';
import { ContactSection } from '@/components/landing/ContactSection';
import { FinalCTA } from '@/components/landing/FinalCTA';
import { PageCursorGlow } from '@/components/landing/PageCursorGlow';
import { ScrollToTopOnMount } from '@/components/landing/ScrollToTopOnMount';
import { RevealObserver } from '@/components/ui/RevealObserver';

export function generateMetadata(): Metadata {
  return {
    title: { absolute: 'Capucor Business Solutions | Monthly accounting and payroll for employers' },
    description: siteConfig.description,
    alternates: { canonical: siteConfig.marketingUrl },
    openGraph: {
      type: 'website',
      locale: 'en_ZA',
      url: siteConfig.marketingUrl,
      title: { absolute: 'Capucor Business Solutions | Monthly accounting and payroll for employers' },
      description: siteConfig.description,
      siteName: siteConfig.name,
      images: [{ url: `${siteConfig.marketingUrl}/api/og`, width: 1200, height: 630 }],
    },
  };
}

export default function HomePage() {
  return (
    <>
      <ScrollToTopOnMount />
      <RevealObserver />
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'AccountingService',
            '@id': `${siteConfig.marketingUrl}/#organization`,
            name: 'Capucor Business Solutions',
            url: siteConfig.marketingUrl,
            // The light-background mark: search results render logos on white.
            logo: `${siteConfig.marketingUrl}/brand/capucor-logo-on-light.png`,
            image: `${siteConfig.marketingUrl}/api/og`,
            email: siteConfig.email.contact,
            description: siteConfig.description,
            areaServed: { '@type': 'Country', name: 'South Africa' },
            sameAs: [
              siteConfig.links.facebook,
              siteConfig.links.instagram,
              siteConfig.links.linkedin,
            ],
          }),
        }}
      />

        {/* 1. Hero — the only place with the cursor glow; the story below stays calm */}
        <PageCursorGlow>
          <HeroSection />
        </PageCursorGlow>
        {/* 2. Partners & tech logo strip (real brand marks, monochrome via .logo-mark) */}
        <PartnersAndTech />
        {/* 3. Problem */}
        <ProblemCards />
        {/* 4. How the monthly finance system works (now carries the outcome line per step) */}
        <HowItWorks />
        {/* 5. Services */}
        <ServicePillars />
        {/* 6. Testimonials / social proof — placeholder between Services and Switching. Hidden until real client quotes are collected. See AGENTS.md → Pending Content. */}
        {/* 7. Switching in any month (onboarding steps; catch-up rule, no amounts) */}
        <SwitchingSection />
        {/* 8. Contact + lead capture (replaced the homepage FAQ). */}
        <ContactSection />
        {/* 9. Final CTA */}
        <FinalCTA />
    </>
  );
}
