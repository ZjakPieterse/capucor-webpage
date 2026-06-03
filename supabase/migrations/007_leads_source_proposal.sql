-- ─── Migration 007: Allow 'proposal' as a leads.source ───────────────────────
-- The Activate → proposal flow (Phase B0) inserts a lead with source='proposal'
-- before creating the proposals row. The original leads.source CHECK constraint
-- (001_schema.sql) only allowed signup/quote/enterprise/contact/call, so the
-- insert failed with "Could not save your details" and no proposal was created.
-- This widens the constraint to include 'proposal'. Additive only — every
-- existing row still satisfies the new (superset) constraint.
--
-- The DO block drops the existing source check by its real name (Postgres
-- auto-named it leads_source_check, but we look it up to be safe) before adding
-- the widened one.

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.leads'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%source%';
  if cname is not null then
    execute format('alter table public.leads drop constraint %I', cname);
  end if;
end $$;

alter table public.leads
  add constraint leads_source_check
  check (source in ('signup', 'quote', 'enterprise', 'contact', 'call', 'proposal'));
