-- ─── Migration 009: Optional add-ons on proposals ────────────────────────────
-- The pricing calculator gained optional flat-fee add-ons (currently Dext
-- software access, R375/month excl. VAT). Slugs and prices live in code
-- (src/config/tiers.ts PRICING_ADDONS); the proposal row stores which slugs
-- the client picked so /proposal/<token> can rebuild the line items.
--
-- RLS unchanged — no anon policies. All proposal reads/writes go through the
-- service-role admin client, as established in 006.

alter table public.proposals
  add column if not exists addons jsonb not null default '[]'::jsonb;

comment on column public.proposals.addons is
  'Optional add-on slugs (PRICING_ADDONS in src/config/tiers.ts), e.g. ["dext"]. Flat monthly fees excl. VAT, included in monthly_total_zar.';
