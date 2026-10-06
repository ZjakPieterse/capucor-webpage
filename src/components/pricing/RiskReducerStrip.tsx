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
      {/* Constrained + centered (milder than the homepage strip — this card is
          already narrower) so the items pull toward the middle. */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2.5 max-w-3xl mx-auto">
        {items.map((item) => {
          const Icon = commonItemIcon(item.text);
          return (
            <div key={item.text} className="flex items-center justify-center gap-2.5">
              <Icon className="h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-foreground/85">{item.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
