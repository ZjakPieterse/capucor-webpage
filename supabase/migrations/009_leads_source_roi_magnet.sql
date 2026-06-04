-- ─── Migration 009: Allow 'roi' and 'lead_magnet' as leads.source values ─────
-- The homepage contact section adds two left-column lead-capture variants — a
-- savings/ROI estimator (source='roi') and a lead-magnet signup
-- (source='lead_magnet') — alongside the existing contact form (source='contact').
-- The leads.source CHECK constraint (last widened in 007 to include 'proposal')
-- must accept the two new values or the insert fails with
-- "Could not save your enquiry." This widens it again. Additive only — every
-- existing row still satisfies the new (superset) constraint.
--
-- Mirrors 007: drop the existing source check by its real name (looked up to be
-- safe) before adding the widened one.

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
  check (source in ('signup', 'quote', 'enterprise', 'contact', 'call', 'proposal', 'roi', 'lead_magnet'));
