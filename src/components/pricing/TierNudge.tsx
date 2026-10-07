import { Layers, Star, Zap, type LucideIcon } from 'lucide-react';
import { TIER_NUDGES } from '@/config/calculatorCopy';

const NUDGE_ICONS: Record<string, LucideIcon> = {
  basic: Layers,
  pro: Star,
  premium: Zap,
};

// The pill under each package's price. The pre-round-1 treatment (Zjak
// preferred it, tweaks round 2): identical quiet styling on every card, only
// the icon and the nudge wording differ.
export function TierNudge({ tierSlug }: { tierSlug: string }) {
  const nudge = TIER_NUDGES[tierSlug];
  if (!nudge) return null;
  const Icon = NUDGE_ICONS[tierSlug] ?? Layers;
  return (
    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground bg-primary/5 border border-primary/10 rounded-md px-2.5 py-1 w-fit whitespace-nowrap">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      {nudge}
    </div>
  );
}
