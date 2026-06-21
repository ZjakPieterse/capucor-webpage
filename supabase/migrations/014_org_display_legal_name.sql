-- ─── Migration 014: Org display name vs legal name ───────────────────────────
-- One business now carries TWO names:
--
--   * display_name — the human name shown in the client portal, on proposals,
--     and (future) used to name the org in Karbon, Xero, and Google Shared
--     Drive. This is the name a proposal captures (business_name) at sign time.
--   * legal_name   — the registered/regulatory name, backend-only, set by an
--     admin internally. Nullable: it is often unknown at onboarding and stays
--     null until an admin fills it in (provisioning never sets it).
--
-- We rename the existing `name` column to `display_name` (this auto-backfills
-- every current org's name as its Display Name) and add `legal_name`. No data is
-- lost; legal_name is null for all existing rows.
--
-- ── Naming-convention note (load-bearing for later integrations) ──────────────
-- When the Karbon / Xero / Google Drive columns below are wired
-- (karbon_client_id, xero_tenant_id, drive_folder_id — all on client_orgs since
-- 004), the HUMAN names sent to those systems must come from display_name, never
-- legal_name. legal_name is for records/compliance only.
--
-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Unchanged. No policy references the renamed column — every client_orgs policy
-- keys off public.is_org_member(id) (004) or public.is_internal(auth.uid()) (011),
-- so the rename needs no policy edits. Writes stay service-role-only; the new
-- admin edit affordance goes through the service-role admin client plus an
-- app-side is_internal_admin check (no write RLS policy added).
--
-- ⚠️ Go-live order (same trap as PR7/PR12/PR13a): apply this in the Supabase SQL
-- editor BEFORE the deploy reaches prod. The portal + internal reads now SELECT
-- `display_name`; an un-migrated prod would error on every portal/internal load.
-- Then run `npm run db:types` (dev-only; the app uses untyped clients, so it is
-- not required for the build — but keep the generated types in sync).

alter table public.client_orgs
  rename column name to display_name;

alter table public.client_orgs
  add column if not exists legal_name text;
