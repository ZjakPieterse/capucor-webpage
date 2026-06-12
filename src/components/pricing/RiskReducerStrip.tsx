'use client';

import { Users, ShieldCheck, CalendarCheck, Cloud } from 'lucide-react';
import { PACKAGE_COMMON_ITEMS } from '@/config/tiers';

// Icons are positional — one per PACKAGE_COMMON_ITEMS entry, same order as the
// homepage "Included in every package" strip (PackagesTeaser).
const ICONS = [Users, ShieldCheck, Cloud, CalendarCheck];

export function RiskReducerStrip() {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
      {/* Constrained + centered (milder than the homepage strip — this card is
          already narrower) so the items pull toward the middle. */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2.5 max-w-3xl mx-auto">
        {PACKAGE_COMMON_ITEMS.map((item, idx) => {
          const Icon = ICONS[idx] ?? Users;
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
