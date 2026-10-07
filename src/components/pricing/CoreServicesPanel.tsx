'use client';

import { Layers } from 'lucide-react';
import type { PackageCommonItem } from '@/config/tiers';
import { CORE_SERVICES_HEADING } from '@/config/calculatorCopy';
import { cn } from '@/lib/utils';
import { commonItemIcon } from './commonItemIcons';

interface CoreServicesPanelProps {
  items: PackageCommonItem[];
}

// The foundation every package card builds on: one titled panel of icon
// tiles, one row of five on desktop, two across on phones with the last tile
// spanning the row when the count is odd (package simplification, 2026-10-06).
// Each card's first line, "Core Services Included", points back here with the
// same icon.
export function CoreServicesPanel({ items }: CoreServicesPanelProps) {
  return (
    <section
      aria-labelledby="core-services-heading"
      className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 sm:p-5"
    >
      {/* No "in every package" badge: each card's first line already says so (tweaks round 2). */}
      <div className="mb-3 sm:mb-4 flex items-center gap-2.5">
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
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-2.5">
        {items.map((item, i) => {
          const spanLast = items.length % 2 === 1 && i === items.length - 1;
          const Icon = commonItemIcon(item.text);
          return (
            <li
              key={item.text}
              title={item.tooltip}
              className={cn(
                // Stacked and centred in the single desktop row, so no tile wraps mid-line.
                'flex items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-2.5 py-2 sm:px-3 sm:py-2.5 lg:flex-col lg:justify-center lg:gap-1.5 lg:py-3 lg:text-center',
                spanLast && 'col-span-2 sm:col-span-1'
              )}
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
