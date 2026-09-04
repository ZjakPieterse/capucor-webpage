// Narrowing for the two unconstrained `jsonb` columns on `proposals`.
//
// ⚠️ WHY THIS EXISTS. `proposals.brackets` and `proposals.addons` are `jsonb`,
// so the generated schema types them `Json` — Postgres can legitimately hold
// anything there, including `null`, a string or an array. Every read of them
// used to arrive through `as unknown as SomeRow`, which asserted
// `Record<string, number>` and `string[] | null` over whatever was actually
// stored and, far worse, threw away supabase-js's parse of the WHOLE select
// string. Removing those casts on 2026-09-04 turned the column check back on
// and left these two columns as the only genuine mismatch.
//
// ⛔ THESE FUNCTIONS ARE PERMISSIVE, AND THAT IS A DELIBERATE CHOICE WITH A
// COST. A value that is already the right shape passes through UNCHANGED, so
// every real proposal is unaffected. A malformed value narrows to empty rather
// than throwing, because these sit on the proposal display, the signing confirm
// and the archived-PDF paths: refusing would take a signable proposal off the
// air over a display-only field. `../capucor-os`'s `amendPayload.ts` made the
// same call for the same reason.
//
// ⚠️ Narrowing away a non-empty value is therefore NOT silent — it is logged at
// warn level with the proposal id, because "the mandate lost its bracket map"
// must be findable in Workers Logs rather than inferred from a wrong total.

import { logWarn } from '@/lib/log';
import type { Json } from '@/types/db';

/**
 * The stored bracket map, keeping only non-negative integer ordinals.
 *
 * @param stored The raw `proposals.brackets` value.
 * @param proposalId Included in the warning when a stored value is discarded.
 */
export function bracketMapFromStored(
  stored: Json | null | undefined,
  proposalId: string,
): Record<string, number> {
  const asObject =
    stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : null;

  if (!asObject) {
    warnIfLossy(stored, proposalId, 'brackets');
    return {};
  }

  const map: Record<string, number> = {};
  for (const [slug, value] of Object.entries(asObject)) {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) map[slug] = value;
  }

  if (Object.keys(map).length !== Object.keys(asObject).length) {
    logWarn('proposal.brackets_partially_discarded', {
      proposalId,
      stored: Object.keys(asObject).length,
      kept: Object.keys(map).length,
    });
  }
  return map;
}

/**
 * The stored add-on slugs, keeping only strings.
 *
 * @param stored The raw `proposals.addons` value.
 * @param proposalId Included in the warning when a stored value is discarded.
 */
export function addonSlugsFromStored(
  stored: Json | null | undefined,
  proposalId: string,
): string[] {
  if (stored === null || stored === undefined) return [];

  if (!Array.isArray(stored)) {
    warnIfLossy(stored, proposalId, 'addons');
    return [];
  }

  const slugs = stored.filter((value): value is string => typeof value === 'string');
  if (slugs.length !== stored.length) {
    logWarn('proposal.addons_partially_discarded', {
      proposalId,
      stored: stored.length,
      kept: slugs.length,
    });
  }
  return slugs;
}

// A stored `null` is the ordinary empty case and says nothing. Anything else
// that narrows to empty means the column held a shape nothing here can read.
function warnIfLossy(stored: Json | null | undefined, proposalId: string, column: string): void {
  if (stored === null || stored === undefined) return;
  logWarn('proposal.json_column_unreadable', { proposalId, column, type: typeof stored });
}
