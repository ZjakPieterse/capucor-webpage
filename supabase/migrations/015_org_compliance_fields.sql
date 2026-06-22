-- ─── Migration 015: Org compliance master-data fields ────────────────────────
-- The internal client view (/internal/clients/[orgId]) Organisation card now
-- holds a client's compliance master-data, editable by an internal admin. Most
-- of these numbers are unknown at onboarding (provisioning never sets them) and
-- get filled in later, so every new column is nullable text.
--
-- Already on client_orgs (since 004 / 014), reused as-is — NOT re-added here:
--   * business_reg_no       — rendered as "Registration No." (CIPC)
--   * primary_contact_email — the client's primary contact email
--   * display_name / legal_name
--
-- New columns:
--   * address              — postal/physical address (free text)
--   * income_tax_no        — SARS income tax reference (10 digits)
--   * vat_no               — SARS VAT number (10 digits)
--   * paye_no              — SARS PAYE/EMP reference (10 digits)
--   * uif_no               — UIF reference
--   * coida_no             — COIDA (Workmen's Compensation) reference
--   * primary_contact_name — the client's primary contact person
--
-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Unchanged. Every client_orgs policy keys off public.is_org_member(id) (004) or
-- public.is_internal(auth.uid()) (011), so adding columns needs no policy edits.
-- Writes stay service-role-only; the admin edit affordance goes through the
-- service-role admin client plus an app-side is_internal admin check (no write
-- RLS policy added).
--
-- ⚠️ Go-live order (same trap as 014): apply this in the Supabase SQL editor
-- BEFORE the deploy reaches prod. getOrgRecord now SELECTs these columns; an
-- un-migrated prod would error on every portal/internal load. Then run
-- `npm run db:types` to keep the generated types in sync (dev-only).

alter table public.client_orgs
  add column if not exists address              text,
  add column if not exists income_tax_no        text,
  add column if not exists vat_no               text,
  add column if not exists paye_no              text,
  add column if not exists uif_no               text,
  add column if not exists coida_no             text,
  add column if not exists primary_contact_name text;

comment on column public.client_orgs.address              is 'Client postal/physical address (free text).';
comment on column public.client_orgs.income_tax_no        is 'SARS income tax reference number (10 digits).';
comment on column public.client_orgs.vat_no               is 'SARS VAT number (10 digits).';
comment on column public.client_orgs.paye_no              is 'SARS PAYE/EMP reference number (10 digits).';
comment on column public.client_orgs.uif_no               is 'UIF reference number.';
comment on column public.client_orgs.coida_no             is 'COIDA (Workmen''s Compensation) reference number.';
comment on column public.client_orgs.primary_contact_name is 'Name of the client''s primary contact person.';
