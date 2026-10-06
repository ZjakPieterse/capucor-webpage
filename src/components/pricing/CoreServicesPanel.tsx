'use client';

import { Layers } from 'lucide-react';
import type { PackageCommonItem } from '@/config/tiers';
import { CORE_SERVICES_BADGE, CORE_SERVICES_HEADING } from '@/config/calculatorCopy';
import { commonItemIcon } from './commonItemIcons';

interface CoreServicesPanelProps {
  items: PackageCommonItem[];
}

// The foundation every package card builds on (tweaks round 1, 2026-10-06):
// one titled panel of icon tiles, two across on phones and up to four on
// desktop, so six or seven items stay compact above the cards. Each card's
// first line, "Core Services Included", points back here with the same icon.
export function CoreServicesPanel({ items }: CoreServicesPanelProps) {
  return (
    <section
      aria-labelledby="core-services-heading"
      className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 sm:p-5"
    >
      <div className="mb-3 sm:mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
          >
            <Layers className="h-4 w-4" />
          </span>
          <h3 id="core-services-heading" className="text-sm sm:text-base font-semibold">
            {CORE_SERVICES_HEADING}
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
          {CORE_SERVICES_BADGE}
        </span>
      </div>
      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        {items.map((item) => {
          const Icon = commonItemIcon(item.text);
          return (
            <li
              key={item.text}
              title={item.tooltip}
              className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-2.5 py-2 sm:px-3 sm:py-2.5"
            >
              <Icon aria-hidden className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-xs sm:text-[13px] leading-snug text-foreground/90">{item.text}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
