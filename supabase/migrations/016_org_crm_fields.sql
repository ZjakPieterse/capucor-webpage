-- ─── Migration 016: Org CRM fields + manual subscription plan label ──────────
-- The internal portal can now hold clients that never came through provision-on-
-- sign (PR9): legacy clients on older/custom plans, and prospects/ad-hoc clients
-- not on any subscription. An internal admin adds these by hand at
-- /internal/clients/new. Two new bits of CRM master-data live on client_orgs, and
-- subscriptions gains a free-text label for the manual/legacy plans the live
-- pricing calculator can't express.
--
-- New columns:
--   * client_orgs.notes        — internal free-text notes. Admin-only: rendered
--                                only in the internal Organisation card, NEVER in
--                                the client portal (same containment as the 015
--                                compliance fields).
--   * client_orgs.client_type  — CRM category. NOT NULL, defaults to 'subscription'
--                                so every existing signed client is correctly typed
--                                without a backfill; manual additions pick
--                                legacy / ad_hoc / prospect.
--   * subscriptions.plan_label — human label for a manually-recorded plan (e.g.
--                                "2023 retainer"). NULL for calculator-driven subs,
--                                which keep deriving their name from tier_slug.
--
-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Unchanged. Every client_orgs / subscriptions policy keys off
-- public.is_org_member(id) (004) or public.is_internal(auth.uid()) (011), so adding
-- columns needs no policy edits. Writes stay service-role-only: the admin
-- create/edit go through the service-role admin client plus an app-side is_internal
-- admin check (no write RLS policy added).
--
-- ⚠️ Go-live order (same trap as 014/015): apply this in the Supabase SQL editor
-- BEFORE the deploy reaches prod. getOrgRecord / getOrgSubscription now SELECT
-- these columns; an un-migrated prod would error on every internal/portal load.
-- Then run `npm run db:types` to keep the generated types in sync (dev-only).

alter table public.client_orgs
  add column if not exists notes       text,
  add column if not exists client_type text not null default 'subscription'
    check (client_type in ('subscription', 'legacy', 'ad_hoc', 'prospect'));

alter table public.subscriptions
  add column if not exists plan_label text;

comment on column public.client_orgs.notes       is 'Internal free-text notes about the client (admin-only; never shown in the client portal).';
comment on column public.client_orgs.client_type is 'CRM category: subscription | legacy | ad_hoc | prospect. Defaults to subscription.';
comment on column public.subscriptions.plan_label is 'Human label for a manually-recorded/legacy plan; NULL for calculator-driven subscriptions (which derive the name from tier_slug).';
