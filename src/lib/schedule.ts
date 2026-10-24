/**
 * Schedule-of-Services derivation for the proposal document.
 *
 * "What's included" comes from the same TIER_HIGHLIGHTS / CORE_SERVICES
 * the calculator uses, filtered to the client's selected services and tier
 * (cumulative: basic → pro → premium). The out-of-scope and fair-usage views
 * come from config/serviceScope.ts. One source of truth, no re-typed lists.
 */

import {
  CORE_SERVICES,
  PAYROLL_ONLY_TIER,
  TIER_HIGHLIGHTS,
  scheduleCommonItemsFor,
  tierDisplayName,
} from '@/config/tiers';
import { reviewInclusionsHeading } from '@/config/calculatorCopy';
import { PAYROLL } from '@/config/servicePages';
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
 * there drops VAT201 from the core items. `wording` picks the signed
 * schedule's text or the comparison table's short text; the card walks only
 * the chosen package's own list (each lists its package in full), so its order
 * matches that package's comparison card, with payroll last.
 */
function inclusions(
  selectedServices: string[],
  tierSlug: string,
  addons: string[],
  wording: 'schedule' | 'card',
): string[] {
  // The payroll-only package (2026-10-18) has no core services: its schedule
  // is the /payroll page's four items, as the calculator review lists them.
  if (tierSlug === PAYROLL_ONLY_TIER) return PAYROLL.items.map((i) => i.title);

  const sel = new Set(selectedServices);
  const vatRegistered = !notVatRegistered(addons);
  const out: string[] = [];

  const core =
    wording === 'schedule'
      ? scheduleCommonItemsFor(vatRegistered)
      : CORE_SERVICES.filter((item) => vatRegistered || !item.vatOnly);
  for (const item of core) {
    if (!SERVICE_TIED_TEXTS.has(item.text)) out.push(item.text);
  }

  // A card summary line ("Core services included") is not a schedule item: the
  // core items are listed above. Within a group (rhythm, reports) a higher
  // package's item replaces the lower one, so a Premium schedule says "Daily
  // processing" once, not monthly, weekly and daily. Payroll goes last, as on
  // the cards (2026-10-24).
  const maxRank = tierRank(tierSlug);
  const groupAt = new Map<string, number>();
  const payroll: string[] = [];
  const tiers = wording === 'card' ? [tierSlug] : TIER_ORDER.filter((t) => tierRank(t) <= maxRank);
  for (const tier of tiers) {
    for (const h of TIER_HIGHLIGHTS[tier] ?? []) {
      if (h.summary || !h.services.some((s) => sel.has(s))) continue;
      const text = wording === 'schedule' ? (h.scheduleText ?? h.text) : h.text;
      if (h.group && groupAt.has(h.group)) {
        out[groupAt.get(h.group)!] = text;
        continue;
      }
      if (h.group) groupAt.set(h.group, out.length);
      (h.services.includes('payroll') ? payroll : out).push(text);
    }
  }

  return [...new Set([...out, ...payroll])];
}

/** The signed Schedule of Services' "what's included" lines, in contract wording. */
export function cumulativeInclusions(
  selectedServices: string[],
  tierSlug: string,
  addons: string[] = [],
): string[] {
  return inclusions(selectedServices, tierSlug, addons, 'schedule');
}

/**
 * The calculator review's "What your <package> subscription includes" card on
 * every package: the signed schedule's items in the comparison table's short
 * wording (Zjak, 2026-10-18). Add-ons are not listed; they are price lines.
 */
export function reviewInclusions(
  selectedServices: string[],
  tierSlug: string,
  addons: string[] = [],
): { heading: string; items: string[] } {
  return {
    heading: reviewInclusionsHeading(tierDisplayName(tierSlug)),
    items: inclusions(selectedServices, tierSlug, addons, 'card'),
  };
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
    if (!sel.has(svc.slug)) items.push(`${svc.name} (not part of this package)`);
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
