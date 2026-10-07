import { Layers, Star, Zap, type LucideIcon } from 'lucide-react';
import { TIER_NUDGES } from '@/config/calculatorCopy';
import { cn } from '@/lib/utils';

const NUDGE_ICONS: Record<string, LucideIcon> = {
  basic: Layers,
  pro: Star,
  premium: Zap,
};

// The pill under each package's price. The pre-round-1 treatment (Zjak
// preferred it, tweaks round 2): quiet styling, only the icon and wording
// differ, except the featured package, whose pill is filled so it reads as
// the recommendation (tweaks round 3).
const FEATURED_TIER = 'pro';
export function TierNudge({ tierSlug }: { tierSlug: string }) {
  const nudge = TIER_NUDGES[tierSlug];
  if (!nudge) return null;
  const Icon = NUDGE_ICONS[tierSlug] ?? Layers;
  const featured = tierSlug === FEATURED_TIER;
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-semibold border rounded-md px-2.5 py-1 w-fit whitespace-nowrap',
        featured
          ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/30'
          : 'text-foreground bg-primary/5 border-primary/10'
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', featured ? 'fill-current' : 'text-primary')} />
      {nudge}
    </div>
  );
}
