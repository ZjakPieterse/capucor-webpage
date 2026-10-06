'use client';

import { PACKAGE_COMMON_ITEMS, type PackageCommonItem } from '@/config/tiers';
import { commonItemIcon } from './commonItemIcons';

interface RiskReducerStripProps {
  /** The core items to show; defaults to all of them. */
  items?: PackageCommonItem[];
}

export function RiskReducerStrip({ items = PACKAGE_COMMON_ITEMS }: RiskReducerStripProps) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
      {/* Two aligned columns at every size keep six or seven core items tidy.
          Smaller type on phones keeps the package cards near the fold. */}
      <div className="grid grid-cols-2 gap-x-4 sm:gap-x-6 gap-y-2 sm:gap-y-2.5 max-w-3xl mx-auto">
        {items.map((item) => {
          const Icon = commonItemIcon(item.text);
          return (
            <div key={item.text} className="flex items-center justify-start gap-2 sm:gap-2.5">
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-primary" />
              <p className="text-[11px] sm:text-xs leading-snug sm:leading-relaxed text-foreground/85">{item.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
