'use client';

import { Layers } from 'lucide-react';
import type { PackageCommonItem } from '@/config/tiers';
import { CORE_SERVICES_HEADING } from '@/config/calculatorCopy';
import { commonItemIcon } from './commonItemIcons';

interface CoreServicesPanelProps {
  items: PackageCommonItem[];
}

// The foundation every package card builds on: one slim strip above the
// cards, so the prices stay in view (calculator design review, 2026-10-13;
// replaced a panel of boxed tiles). Desktop: the heading, then the four items
// spread across one line. Phones: the heading, then the items as one dotted line of text, so
// the Basic price lands on the first screen. Each card's first line, "Core
// Services Included", points back here.
export function CoreServicesPanel({ items }: CoreServicesPanelProps) {
  return (
    <section
      aria-labelledby="core-services-heading"
      className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3 sm:px-5"
    >
      <h3
        id="core-services-heading"
        className="mb-1.5 flex items-center gap-2 text-sm font-semibold sm:mb-2.5"
      >
        <Layers aria-hidden className="h-4 w-4 shrink-0 text-primary" />
        {CORE_SERVICES_HEADING}
      </h3>
      <ul className="text-xs leading-relaxed text-foreground/85 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-1.5 sm:text-[13px] lg:justify-between lg:gap-x-4">
        {items.map((item, i) => {
          const Icon = commonItemIcon(item.text);
          return (
            <li
              key={item.text}
              title={item.tooltip}
              className="inline sm:flex sm:items-start sm:gap-1.5 sm:whitespace-nowrap sm:leading-snug"
            >
              <Icon aria-hidden className="mt-px hidden h-3.5 w-3.5 shrink-0 text-primary sm:block" />
              {/* An item never breaks mid-name; the line breaks between items. */}
              <span className="whitespace-nowrap">
                {item.text}
                {i < items.length - 1 && (
                  <span aria-hidden className="pl-1.5 pr-0.5 text-primary/70 sm:hidden">
                    ·
                  </span>
                )}
              </span>{' '}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
