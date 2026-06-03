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
