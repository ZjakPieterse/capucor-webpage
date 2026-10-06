/**
 * Schedule-of-Services derivation for the proposal document.
 *
 * "What's included" comes from the same TIER_HIGHLIGHTS / PACKAGE_COMMON_ITEMS
 * the calculator uses, filtered to the client's selected services and tier
 * (cumulative: basic → pro → premium). The out-of-scope and fair-usage views
 * come from config/serviceScope.ts. One source of truth, no re-typed lists.
 */

import { TIER_HIGHLIGHTS, packageCommonItemsFor } from '@/config/tiers';
import { formatBandLabel, notVatRegistered } from '@/lib/pricing';
import {
  FAIR_USAGE,
  ALWAYS_OUT_OF_SCOPE,
  SERVICE_OUT_OF_SCOPE,
  type ServiceFairUsage,
} from '@/config/serviceScope';
import type { Bracket, BracketValue, Service } from '@/types';

const TIER_ORDER = ['basic', 'pro', 'premium'] as const;

function tierRank(slug: string): number {
  const i = TIER_ORDER.indexOf(slug as (typeof TIER_ORDER)[number]);
  return i === -1 ? 0 : i;
}

// Every text that is tied to a specific service in TIER_HIGHLIGHTS. Used to keep
// service-tied items (e.g. "SARS & CIPC Compliance") out of the universal
// package list — they should only appear when their service is selected.
const SERVICE_TIED_TEXTS = new Set(
  Object.values(TIER_HIGHLIGHTS)
    .flat()
    .map((h) => h.text),
);

/**
 * Cumulative "what's included" lines for the chosen services + tier. Package-
 * wide items first (only the genuinely universal ones), then the tier highlights
 * that apply to a selected service, accumulating up to the chosen tier.
 * `addons` is the proposal's add-on tokens: a not-VAT-registered scope flag
 * there drops VAT201 from the core items.
 */
export function cumulativeInclusions(
  selectedServices: string[],
  tierSlug: string,
  addons: string[] = [],
): string[] {
  const sel = new Set(selectedServices);
  const out: string[] = [];

  for (const item of packageCommonItemsFor(!notVatRegistered(addons))) {
    if (!SERVICE_TIED_TEXTS.has(item.text)) out.push(item.text);
  }

  // A card summary line ("Core Services Included") is not a schedule item: the
  // core items are listed above. Within a group (rhythm, reports, review) a
  // higher package's item replaces the lower one, so a Premium schedule says
  // "Processing Rhythm: Daily" once, not monthly, weekly and daily.
  const maxRank = tierRank(tierSlug);
  const groupAt = new Map<string, number>();
  for (const tier of TIER_ORDER) {
    if (tierRank(tier) > maxRank) break;
    for (const h of TIER_HIGHLIGHTS[tier] ?? []) {
      if (h.summary || !h.services.some((s) => sel.has(s))) continue;
      if (h.group && groupAt.has(h.group)) {
        out[groupAt.get(h.group)!] = h.text;
        continue;
      }
      if (h.group) groupAt.set(h.group, out.length);
      out.push(h.text);
    }
  }

  return [...new Set(out)];
}

/**
 * Out-of-scope lines: services we offer but the client didn't pick, any
 * service-specific exclusions for what they did pick, then the always-excluded
 * master list. Order goes from most selection-specific to most general.
 */
export function outOfScopeItems(selectedServices: string[], allServices: Service[]): string[] {
  const sel = new Set(selectedServices);
  const items: string[] = [];

  for (const svc of allServices) {
    if (!sel.has(svc.slug)) items.push(`${svc.name} (not part of this plan)`);
  }
  for (const slug of selectedServices) {
    for (const x of SERVICE_OUT_OF_SCOPE[slug] ?? []) items.push(x);
  }
  items.push(...ALWAYS_OUT_OF_SCOPE);

  return [...new Set(items)];
}

export interface FairUsageLine extends ServiceFairUsage {
  slug: string;
  /** The chosen bracket's label, e.g. "Up to 50 transactions" — null if missing. */
  bracketLabel: string | null;
}

/**
 * Per-selected-service fair-usage rows, resolving the chosen bracket's label.
 * A service whose allowance differs by package uses the chosen tier's wording
 * (none does since 2026-10-06, when every package counts all transactions).
 * Band labels are shown in plain form (formatBandLabel).
 */
export function buildFairUsage(
  selectedServices: string[],
  selectedBrackets: Record<string, BracketValue>,
  brackets: Pick<Bracket, 'service_slug' | 'ordinal' | 'label'>[],
  tierSlug?: string,
): FairUsageLine[] {
  const lines: FairUsageLine[] = [];
  for (const slug of selectedServices) {
    const fu = FAIR_USAGE[slug];
    if (!fu) continue;
    const sel = selectedBrackets[slug];
    let bracketLabel: string | null = null;
    if (typeof sel === 'number') {
      bracketLabel = formatBandLabel(
        slug,
        brackets.find((b) => b.service_slug === slug && b.ordinal === sel)?.label ?? null,
      );
    }
    const allowance = (tierSlug && fu.allowanceByTier?.[tierSlug]) || fu.allowance;
    lines.push({ slug, bracketLabel, ...fu, allowance });
  }
  return lines;
}
