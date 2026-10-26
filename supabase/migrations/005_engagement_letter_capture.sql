-- ════════════════════════════════════════════════════════════════════════════
-- 005_engagement_letter_capture.sql — who signs for whom, and on which terms
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHAT IT CHANGES
--   proposals gains five columns (no data is touched, nothing is dropped):
--     client_legal_name           the client's registered name
--     client_registration_number  CIPC / trust / other registration number;
--                                 null for a sole proprietor
--     client_registered_address   the client's registered address
--     signer_authority_confirmed  the signer ticked "I am authorised to sign
--                                 for this business" (default false)
--     terms_version               the TERMS_VERSION the signer accepted
--                                 (src/config/proposalTerms.ts, e.g. '2026.1')
--   plus CHECKs: text values are trimmed, non-empty and bounded; terms_version
--   looks like '2026.1'; a confirmed authority always comes with a legal name,
--   an address and a terms version.
--
--   The sign form (POST /api/proposals/sign, Step A) writes all five with the
--   pending signature. Once the client confirms from their inbox,
--   commit_proposal_signature sets status 'signed' and the sign route's status
--   guard stops any later write, so on a signed row they are the record.
--   commit_proposal_signature itself is NOT changed.
--
-- WHY. Engagement-letter decision 2026-10-26, agent's calls rows 2, 3 and 30:
--   every signed proposal is the client's engagement letter, so it must say
--   which legal entity is bound, that the signer may bind it, and which terms
--   version was signed.
--
-- ORDER. Apply before the code that writes the columns (capucor-webpage PR B).
-- The live Worker is unaffected: it never reads or writes them, and every new
-- column is nullable or defaulted.
--
-- Apply by hand in the Supabase SQL editor, as one run. An agent never applies a
-- production migration (docs/database.md). The statements are one transaction:
-- any failure rolls everything back.

-- ── PRE-FLIGHT (read-only) ───────────────────────────────────────────────────
--
-- 1. The new columns do not exist yet.
--
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'proposals'
--    and column_name in ('client_legal_name', 'client_registration_number',
--                        'client_registered_address', 'signer_authority_confirmed',
--                        'terms_version');
-- -- Expect 0 rows. Anything else: stop; the guard below aborts.

begin;

-- Run-once guard.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'proposals'
       and column_name in ('client_legal_name', 'client_registration_number',
                           'client_registered_address', 'signer_authority_confirmed',
                           'terms_version')
  ) then
    raise exception '005: an engagement-letter column already exists on proposals; this migration has run.';
  end if;
end $$;

alter table public.proposals
  add column client_legal_name          text,
  add column client_registration_number text,
  add column client_registered_address  text,
  add column signer_authority_confirmed boolean not null default false,
  add column terms_version              text;

alter table public.proposals
  add constraint proposals_client_legal_name_check check (
    client_legal_name is null
    or (client_legal_name = btrim(client_legal_name) and char_length(client_legal_name) between 2 and 160)
  ),
  add constraint proposals_client_registration_number_check check (
    client_registration_number is null
    or (client_registration_number = btrim(client_registration_number)
        and char_length(client_registration_number) between 2 and 40)
  ),
  add constraint proposals_client_registered_address_check check (
    client_registered_address is null
    or (client_registered_address = btrim(client_registered_address)
        and char_length(client_registered_address) between 5 and 300)
  ),
  add constraint proposals_terms_version_check check (
    terms_version is null or terms_version ~ '^[0-9]{4}\.[0-9]{1,3}$'
  ),
  add constraint proposals_signer_authority_complete_check check (
    not signer_authority_confirmed
    or (client_legal_name is not null
        and client_registered_address is not null
        and terms_version is not null)
  );

comment on column public.proposals.client_legal_name is
  'Client''s registered name, captured on the sign form with the signature. 005.';
comment on column public.proposals.client_registration_number is
  'Client''s registration number; null for a sole proprietor. 005.';
comment on column public.proposals.client_registered_address is
  'Client''s registered address, captured on the sign form. 005.';
comment on column public.proposals.signer_authority_confirmed is
  'The signer confirmed they are authorised to sign for the business (required by the sign form). False on rows before 005. 005.';
comment on column public.proposals.terms_version is
  'TERMS_VERSION (src/config/proposalTerms.ts) the signer accepted; shown on the signed PDF. Null on rows before 005. 005.';

-- Final guard: all five columns are in place.
do $$
begin
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'proposals'
         and column_name in ('client_legal_name', 'client_registration_number',
                             'client_registered_address', 'signer_authority_confirmed',
                             'terms_version')) <> 5 then
    raise exception '005: expected five new proposals columns; rolled back.';
  end if;
end $$;

commit;

-- ── VERIFY (read-only) ───────────────────────────────────────────────────────
--
-- 1. Columns and defaults.
--
-- select column_name, data_type, column_default, is_nullable
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'proposals'
--    and column_name in ('client_legal_name', 'client_registration_number',
--                        'client_registered_address', 'signer_authority_confirmed',
--                        'terms_version')
--  order by column_name;
-- -- Expect 5 rows; signer_authority_confirmed: boolean, default false, NOT NULL;
-- -- the rest text, nullable.
--
-- 2. Every existing row is untouched.
--
-- select signer_authority_confirmed, terms_version is null as no_version, count(*)
--   from public.proposals group by 1, 2;
-- -- Expect one row: false | true | <all proposals>.
--
-- Then, on the dev box: `npm run db:types`. Expect the five new proposals
-- columns in src/types/db.ts; commit it with the code that first uses them.
--
-- ── ROLL BACK ────────────────────────────────────────────────────────────────
-- Only before any client has signed with them (dropping loses the record).
-- In one run:
--
-- begin;
-- alter table public.proposals
--   drop constraint proposals_client_legal_name_check,
--   drop constraint proposals_client_registration_number_check,
--   drop constraint proposals_client_registered_address_check,
--   drop constraint proposals_terms_version_check,
--   drop constraint proposals_signer_authority_complete_check,
--   drop column client_legal_name,
--   drop column client_registration_number,
--   drop column client_registered_address,
--   drop column signer_authority_confirmed,
--   drop column terms_version;
-- commit;
