-- ════════════════════════════════════════════════════════════════════════════
-- 006_sign_without_registered_address.sql — a signature no longer needs an address
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHAT IT CHANGES
--   proposals_signer_authority_complete_check (from 005) required a legal
--   name, a registered address and a terms version whenever the signer
--   confirmed authority. It is replaced by the same check without the
--   address. The client_registered_address column and its own format check
--   stay: proposals signed under 005 keep their address as the record.
--   No data is touched.
--
-- WHY. Zjak, 2026-11-06: the sign form stops asking for the client's
--   registered address. Notices to the client go to the proposal email
--   (proposalTerms.ts, notices block) and onboarding collects the address.
--   The registered name and (optional) registration number still identify
--   the entity that is bound.
--
-- ORDER. Apply BEFORE deploying the code that stops sending the address
-- (capucor-webpage PR "proposal doc width + no registered address"). The
-- relaxed check also accepts what the live code writes, so applying it early
-- is safe. Deploying first would make every signature fail this check.
--
-- Apply by hand in the Supabase SQL editor, as one run. An agent never applies a
-- production migration (docs/database.md). One transaction: any failure rolls
-- everything back.

-- ── PRE-FLIGHT (read-only) ───────────────────────────────────────────────────
--
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conname = 'proposals_signer_authority_complete_check';
-- -- Expect one row that mentions client_registered_address. No row: 005 has
-- -- not run; stop. A row without it: 006 has run; stop.

begin;

-- Run-once guard.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'proposals_signer_authority_complete_check'
       and pg_get_constraintdef(oid) like '%client_registered_address%'
  ) then
    raise exception '006: the 005 authority check is missing or already relaxed; nothing to do.';
  end if;
end $$;

alter table public.proposals
  drop constraint proposals_signer_authority_complete_check,
  add constraint proposals_signer_authority_complete_check check (
    not signer_authority_confirmed
    or (client_legal_name is not null
        and terms_version is not null)
  );

comment on column public.proposals.client_registered_address is
  'Client''s registered address, captured on the sign form under 005; no longer asked from 006 (null on later rows). 005, 006.';

commit;

-- ── VERIFY (read-only) ───────────────────────────────────────────────────────
--
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conname = 'proposals_signer_authority_complete_check';
-- -- Expect one row naming client_legal_name and terms_version only.
--
-- No type change: `npm run db:types` is not needed.
--
-- ── ROLL BACK ────────────────────────────────────────────────────────────────
-- Only while no row is signed without an address (the old check would refuse
-- it), and only after rolling the code back. In one run:
--
-- begin;
-- alter table public.proposals
--   drop constraint proposals_signer_authority_complete_check,
--   add constraint proposals_signer_authority_complete_check check (
--     not signer_authority_confirmed
--     or (client_legal_name is not null
--         and client_registered_address is not null
--         and terms_version is not null)
--   );
-- commit;
