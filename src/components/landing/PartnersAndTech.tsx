'use client';

import type { CSSProperties } from 'react';
import { ScrollReveal } from '@/components/ui/ScrollReveal';

// Real brand marks, painted monochrome via `.logo-mark` (see globals.css) so they
// inherit the marquee's muted text colour. `ratio` is each asset's natural aspect
// ratio, so a single shared height renders every logo at its correct proportions.
const PARTNERS = [
  { name: 'Xero',      href: 'https://www.xero.com/za/',        logo: '/logos/tools/xero.svg',      ratio: '1 / 1' },
  { name: 'Dext',      href: 'https://dext.com/za',             logo: '/logos/tools/dext.svg',      ratio: '620 / 384' },
  { name: 'SimplePay', href: 'https://www.simplepay.co.za/',    logo: '/logos/tools/simplepay.png', ratio: '203 / 58' },
  { name: 'Karbon',    href: 'https://karbonhq.com/',           logo: '/logos/tools/karbon.svg',    ratio: '1 / 1' },
  { name: 'Draftworx', href: 'https://draftworx.com/',          logo: '/logos/tools/draftworx.png', ratio: '241 / 81' },
  { name: 'SAICA',     href: 'https://www.saica.org.za/',       logo: '/logos/tools/saica.png',     ratio: '1 / 1' },
  { name: 'Intersect', href: 'https://intersectconnect.com/',   logo: '/logos/tools/intersect.png', ratio: '350 / 101' },
  { name: 'Syft',      href: 'https://www.syftanalytics.com/',  logo: '/logos/tools/syft.png',      ratio: '1 / 1' },
];

const MARQUEE_ROW = [...PARTNERS, ...PARTNERS, ...PARTNERS, ...PARTNERS];

export function PartnersAndTech() {
  return (
    <section
      aria-label="Partners and tech we work with"
      className="relative -mt-12 lg:-mt-20 border-y border-border/40 bg-background py-8 lg:py-10"
    >
      <ScrollReveal>
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/70 mb-6">
          Trusted partners &amp; tools
        </p>
      </ScrollReveal>

      <div className="partners-marquee-mask relative overflow-hidden">
        <ul
          className="animate-marquee flex w-max items-center gap-x-12 lg:gap-x-16 px-6"
          role="list"
        >
          {MARQUEE_ROW.map((p, i) => (
            <li key={`${p.name}-${i}`} className="shrink-0">
              <a
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={p.name}
                className="inline-flex items-center text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                <span
                  aria-hidden
                  className="logo-mark h-6 lg:h-7"
                  style={{ '--logo': `url(${p.logo})`, aspectRatio: p.ratio } as CSSProperties}
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
