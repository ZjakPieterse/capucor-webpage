// Canonical card surfaces for the client portal. The portal uses the same glassy
// premium primitives as the marketing site (`.premium-card` / `.premium-glass`
// in globals.css), paired with the standard rounded-xl + faint border + card
// background. Keep these in one place so the hub and every sub-page stay visually
// consistent.
//
// - PORTAL_CARD   — interactive / clickable cards. `.premium-card` adds the
//   @media-all hover lift (see globals.css) that signals the card is actionable.
// - PORTAL_PANEL  — static information panels. `.premium-glass` is the same
//   premium surface with no hover movement.
//
// Callers add their own padding (`p-6`, `p-5`, …) so spacing stays per-context.

export const PORTAL_CARD =
  'premium-card rounded-xl border border-white/10 bg-card/80';

export const PORTAL_PANEL =
  'premium-glass rounded-xl border border-white/10 bg-card/80';
