// ⚠️ HAND-SYNCED with capucor-os/src/lib/pricing.ts. Both repos price the same
// proposals off the same `brackets` table: capucor.com when a lead builds one on
// /pricing, capucor.app when staff amend one. A change to this math in one repo
// and not the other means the two surfaces quote different numbers for the same
// selection, with nothing to catch it — no compile error, no failing test.
// CHANGE IT HERE, CHANGE IT THERE, AND KEEP pricing.test.ts PASSING IN BOTH.
// The same applies to ./proposalPricing.ts and ../config/tiers.ts.
//
// This duplication is deliberate (see "Not worth paying for" in
// capucor-docs/archive/phase2-os-split-execution-plan.md): a shared package
// would mean a version bump plus two PRs for every pricing tweak, on the
// most-iterated surface of the site.

import { PRICING_ADDONS, addonIncludedInTier, tierDisplayName, type PricingAddon } from '@/config/tiers';
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

// ── Add-on tokens ────────────────────────────────────────────────────────────
//
// proposals.addons stores one token per add-on: the slug, or "slug:count" for a
// per-unit add-on (e.g. "personal-tax:3"). A token with no count, or a count
// that is not a whole number of at least 1, reads as 1 — so every row written
// before counts existed still prices exactly as it did.

export interface AddonSelection {
  addon: PricingAddon;
  quantity: number;
}

export function parseAddonToken(token: string): { slug: string; quantity: number } {
  const [slug = '', count] = token.split(':');
  const n = count === undefined ? 1 : Number(count);
  return { slug, quantity: Number.isInteger(n) && n >= 1 ? n : 1 };
}

/** The token for an add-on and count: "slug:count" for a per-unit add-on, else the slug. */
export function addonToken(slug: string, quantity = 1): string {
  const addon = PRICING_ADDONS.find((a) => a.slug === slug);
  return addon?.unit ? `${slug}:${quantity}` : slug;
}

// Whitelisted selections from a token list, one per add-on, in PRICING_ADDONS
// order. Unknown slugs drop; a repeated slug keeps its largest count; a
// per-unit count is capped at the add-on's max and a flat add-on is always 1.
export function resolveAddons(tokens: string[]): AddonSelection[] {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    const { slug, quantity } = parseAddonToken(token);
    counts.set(slug, Math.max(counts.get(slug) ?? 0, quantity));
  }
  const out: AddonSelection[] = [];
  for (const addon of PRICING_ADDONS) {
    const q = counts.get(addon.slug);
    if (q === undefined) continue;
    out.push({ addon, quantity: addon.unit ? Math.min(q, addon.unit.max) : 1 });
  }
  return out;
}

// The add-on tokens a proposal carries for a package: the selected ones on the
// PRICING_ADDONS whitelist, plus every offered add-on the package includes (Dext
// from Pro up). A hidden add-on the package includes is dropped (the Xero
// invoicing charge means nothing from Pro up); a scope flag is always kept.
export function addonsForTier(selectedAddons: string[], tierSlug: string): string[] {
  const selected = new Map(resolveAddons(selectedAddons).map((s) => [s.addon.slug, s.quantity]));
  const out: string[] = [];
  for (const addon of PRICING_ADDONS) {
    const included = addonIncludedInTier(addon, tierSlug);
    const q = selected.get(addon.slug);
    if (q !== undefined) {
      if (addon.hidden && !addon.scopeFlag && included) continue;
      out.push(addonToken(addon.slug, q));
    } else if (included && !addon.hidden) {
      out.push(addon.slug);
    }
  }
  return out;
}

// Monthly price of one add-on selection on a package: price × count, or 0 when
// the package includes it.
function selectionPrice({ addon, quantity }: AddonSelection, tierSlug: string): number {
  return addonIncludedInTier(addon, tierSlug) ? 0 : addon.priceZAR * quantity;
}

// Monthly total of the selected add-ons, folded ones included. An add-on the
// package includes costs nothing. Unknown slugs are ignored — PRICING_ADDONS
// doubles as the whitelist.
export function addonTotal(selectedAddons: string[], tierSlug: string): number {
  return resolveAddons(selectedAddons).reduce((sum, s) => sum + selectionPrice(s, tierSlug), 0);
}

// One line per add-on, appended after the service lines in the proposal
// summary, email, and proposal page. An add-on the package includes shows at
// R 0.00 with an "Included in <package>" label; a per-unit add-on shows its
// count. Scope flags and folded add-ons (see foldAddonsIntoLines) get no line.
export function buildAddonLineItems(selectedAddons: string[], tierSlug: string): ProposalLineItem[] {
  const items: ProposalLineItem[] = [];
  for (const sel of resolveAddons(selectedAddons)) {
    const { addon, quantity } = sel;
    if (addon.scopeFlag || addon.foldIntoService) continue;
    const included = addonIncludedInTier(addon, tierSlug);
    const count = addon.unit ? `${quantity} ${quantity === 1 ? addon.unit.singular : addon.unit.plural}` : null;
    items.push({
      slug: addon.slug,
      name: addon.name,
      label: included ? `Included in ${tierDisplayName(tierSlug)}` : count,
      price: selectionPrice(sel, tierSlug),
    });
  }
  return items;
}

// Adds each folded add-on's price into the line of the service it folds into
// (the Xero invoicing charge into Accounting on Basic), so the lines still sum
// to the total without a separate line. If that service has no line, the
// add-on gets its own line rather than vanishing from the breakdown.
export function foldAddonsIntoLines(
  lines: ProposalLineItem[],
  selectedAddons: string[],
  tierSlug: string,
): ProposalLineItem[] {
  const out = lines.map((l) => ({ ...l }));
  for (const sel of resolveAddons(selectedAddons)) {
    const target = sel.addon.foldIntoService;
    const price = selectionPrice(sel, tierSlug);
    if (!target || price === 0) continue;
    const line = out.find((l) => l.slug === target);
    if (line) {
      line.price += price;
    } else {
      out.push({ slug: sel.addon.slug, name: sel.addon.name, label: null, price });
    }
  }
  return out;
}

/** True when the add-on tokens mark the business as not VAT-registered. */
export function notVatRegistered(selectedAddons: string[]): boolean {
  return resolveAddons(selectedAddons).some((s) => s.addon.slug === 'not-vat-registered');
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
