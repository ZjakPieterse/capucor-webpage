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

// ── The core service ─────────────────────────────────────────────────────────
//
// Accounting and bookkeeping are the core of every package (calculator-v2).
// Proposals still store and price them as two services on their own ladders;
// every surface shows them as one "Monthly accounting" line (decision
// 2026-10-06, calculator review answers).

export const CORE_SERVICE_SLUGS = ['accounting', 'bookkeeping'] as const;
export const CORE_LINE_SLUG = 'core';
export const CORE_LINE_NAME = 'Monthly accounting';

/**
 * Null when the selection carries the core service (accounting and
 * bookkeeping, each with a priced bracket), else the message to show. Shared
 * by /api/proposals and the staff amend form so neither accepts a proposal
 * without it.
 */
export function coreServiceError(
  services: string[],
  brackets: Record<string, BracketValue>,
): string | null {
  const missing = CORE_SERVICE_SLUGS.some(
    (slug) => !services.includes(slug) || typeof brackets[slug] !== 'number',
  );
  return missing
    ? 'Monthly accounting (a revenue band and a transaction band) is part of every package. Choose both to continue.'
    : null;
}

/**
 * Shows accounting and bookkeeping as one "Monthly accounting" line, summing
 * their prices (a folded add-on already inside either is kept) and joining
 * their band labels. Other lines pass through in order; the core line takes
 * the first core line's place. With only one core line present it is renamed
 * in place, so a proposal never shows the two-service split.
 */
export function mergeCoreLines(items: ProposalLineItem[]): ProposalLineItem[] {
  const isCore = (i: ProposalLineItem) => (CORE_SERVICE_SLUGS as readonly string[]).includes(i.slug);
  const core = items.filter(isCore);
  if (core.length === 0) return items;
  const merged: ProposalLineItem = {
    slug: CORE_LINE_SLUG,
    name: CORE_LINE_NAME,
    label: core.map((i) => i.label).filter(Boolean).join(' · ') || null,
    price: core.reduce((sum, i) => sum + i.price, 0),
  };
  const out: ProposalLineItem[] = [];
  for (const item of items) {
    if (!isCore(item)) out.push(item);
    else if (item === core[0]) out.push(merged);
  }
  return out;
}

// "10 Mil – 15 Mil" → "R10m to R15m"; "350 Mil+" → "R350m+"; "0 – 1 Mil" → "R0 to R1m".
function revenueBand(label: string): string {
  if (/^dormant$/i.test(label.trim())) return 'Dormant';
  const amount = (s: string) => {
    const m = s.trim().match(/^([\d.]+)\s*(Mil)?\s*(\+)?$/i);
    return m ? `R${m[1]}${m[2] ? 'm' : ''}${m[3] ?? ''}` : null;
  };
  const parts = label.split(/\s*[–-]\s*/);
  const formatted = parts.map(amount);
  if (formatted.some((p) => p === null)) return label;
  return formatted.join(' to ');
}

/**
 * A bracket label in plain form for the client (F17, October 2026 review).
 * The rows in `brackets.label` stay as they are; this only changes display.
 * Unrecognised labels pass through unchanged.
 */
export function formatBandLabel(serviceSlug: string, label: string | null): string | null {
  if (!label) return label;
  const raw = label.trim();
  if (serviceSlug === 'accounting') return revenueBand(raw);
  if (serviceSlug === 'bookkeeping') {
    if (/^dormant$/i.test(raw)) return 'no transactions';
    const m = raw.match(/^up to\s+([\d,]+)$/i);
    return m ? `up to ${Number(m[1]!.replace(/,/g, '')).toLocaleString('en-US')} transactions` : raw;
  }
  if (serviceSlug === 'payroll') {
    const m = raw.match(/^employees:\s*(\d+)$/i);
    if (m) return `${m[1]} ${m[1] === '1' ? 'employee' : 'employees'}`;
  }
  return raw;
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
      label: formatBandLabel(slug, bracket.label ?? null),
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
// invoicing charge, retired 2026-10-06, means nothing from Pro up); a scope
// flag is always kept.
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
// count; one with a `chargedLabel` (Dext on Basic) shows that when charged.
// Scope flags and folded add-ons (see foldAddonsIntoLines) get no line.
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
      label: included ? `Included in ${tierDisplayName(tierSlug)}` : (count ?? addon.chargedLabel ?? null),
      price: selectionPrice(sel, tierSlug),
    });
  }
  return items;
}

// Adds each folded add-on's price into the line of the service it folds into
// (the retired Xero invoicing charge into Accounting on Basic, on proposals
// sent before 2026-10-06), so the lines still sum
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

