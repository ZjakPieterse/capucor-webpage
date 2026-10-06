import { PRICING_ADDONS, addonIncludedInTier, tierDisplayName } from '@/config/tiers';
import type { Bracket, BracketValue, Service } from '@/types';

export function bracketPrice(
  bracket: Pick<Bracket, 'basic_price' | 'pro_price' | 'premium_price'>,
  tierSlug: string
): number {
  if (tierSlug === 'pro')     return bracket.pro_price;
  if (tierSlug === 'premium') return bracket.premium_price;
  return bracket.basic_price;
}

export function monthlyTotal(
  selectedSlugs: string[],
  bracketSelections: Record<string, BracketValue>,
  tierSlug: string,
  allBrackets: Pick<Bracket, 'service_slug' | 'ordinal' | 'basic_price' | 'pro_price' | 'premium_price'>[]
): number {
  return selectedSlugs.reduce((sum, slug) => {
    const sel = bracketSelections[slug];
    if (sel === 'enterprise' || sel === undefined) return sum;
    const b = allBrackets.find((x) => x.service_slug === slug && x.ordinal === sel);
    return b ? sum + bracketPrice(b, tierSlug) : sum;
  }, 0);
}

export interface ProposalLineItem {
  slug: string;
  name: string;
  label: string | null;
  price: number;
}

// One priced line per selected service, for the proposal summary, email, and
// proposal page. Enterprise / unconfigured selections are skipped (they carry
// no self-serve price). Shares its price source with monthlyTotal so the lines
// always sum to the displayed total.
export function buildLineItems(
  selectedSlugs: string[],
  bracketSelections: Record<string, BracketValue>,
  tierSlug: string,
  services: Pick<Service, 'slug' | 'name'>[],
  allBrackets: Pick<Bracket, 'service_slug' | 'ordinal' | 'label' | 'basic_price' | 'pro_price' | 'premium_price'>[]
): ProposalLineItem[] {
  const items: ProposalLineItem[] = [];
  for (const slug of selectedSlugs) {
    const sel = bracketSelections[slug];
    if (sel === 'enterprise' || sel === undefined) continue;
    const bracket = allBrackets.find((x) => x.service_slug === slug && x.ordinal === sel);
    if (!bracket) continue;
    items.push({
      slug,
      name: services.find((s) => s.slug === slug)?.name ?? slug,
      label: bracket.label ?? null,
      price: bracketPrice(bracket, tierSlug),
    });
  }
  return items;
}

// The add-ons a proposal carries for a package: the selected ones that are on
// the PRICING_ADDONS whitelist, plus every add-on the package includes (Dext
// from Pro up), de-duplicated and in PRICING_ADDONS order. Unknown slugs drop.
export function addonsForTier(selectedAddons: string[], tierSlug: string): string[] {
  return PRICING_ADDONS.filter(
    (a) => selectedAddons.includes(a.slug) || addonIncludedInTier(a, tierSlug),
  ).map((a) => a.slug);
}

// Flat monthly total of the selected optional add-ons (e.g. Dext access).
// An add-on the package includes costs nothing. Unknown slugs are ignored —
// PRICING_ADDONS doubles as the whitelist.
export function addonTotal(selectedAddons: string[], tierSlug: string): number {
  return selectedAddons.reduce((sum, slug) => {
    const addon = PRICING_ADDONS.find((a) => a.slug === slug);
    return addon && !addonIncludedInTier(addon, tierSlug) ? sum + addon.priceZAR : sum;
  }, 0);
}

// One line per add-on, appended after the service lines in the proposal
// summary, email, and proposal page. An add-on the package includes shows at
// R 0.00 with an "Included in <package>" label.
export function buildAddonLineItems(selectedAddons: string[], tierSlug: string): ProposalLineItem[] {
  const items: ProposalLineItem[] = [];
  for (const slug of selectedAddons) {
    const addon = PRICING_ADDONS.find((a) => a.slug === slug);
    if (!addon) continue;
    const included = addonIncludedInTier(addon, tierSlug);
    items.push({
      slug: addon.slug,
      name: addon.name,
      label: included ? `Included in ${tierDisplayName(tierSlug)}` : null,
      price: included ? 0 : addon.priceZAR,
    });
  }
  return items;
}

export function hasEnterpriseService(
  selectedSlugs: string[],
  brackets: Record<string, BracketValue>
): boolean {
  return selectedSlugs.some((slug) => brackets[slug] === 'enterprise');
}

// hasEnterpriseService → true  → primary CTA = "Get a Custom Quote", source = 'enterprise'
// hasEnterpriseService → false → primary CTA = "Sign Up",             source = 'signup'
// monthlyTotal always excludes enterprise lines; a non-zero total is shown alongside
// "Custom" in mixed state (e.g. "From R 1,528/month + custom pricing").
