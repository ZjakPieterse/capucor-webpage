-- ════════════════════════════════════════════════════════════════════════════
-- 002_drop_staff_proposal_rpcs.sql — web-standalone phase 4
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHAT IT CHANGES
--   Drops the two staff-only proposal RPCs recorded in 000_baseline_funnel.sql
--   section 6:
--     - create_proposal_amendment (capucor-os 019): staff amend → new revision,
--       old one superseded.
--     - start_proposal_resend (capucor-os 020): staff resend → token rotated,
--       pending `proposal.resent_client` delivery created.
--   Nothing else. No table, column, row, policy or other function changes.
--
-- WHY. Decision 2026-10-07 (web-standalone, item 4): no staff proposal tools,
-- on capucor.app or capucor.com. The capucor-os PR that removes
-- /internal/proposals, /api/proposals/amend and /api/proposals/resend removes
-- the only callers. capucor-webpage never called either function.
--
-- ⛔ ORDER. Apply ONLY after that capucor-os PR is merged AND DEPLOYED to
-- capucor.app, and verified (POST https://capucor.app/api/proposals/amend
-- returns 404). Applied earlier, the still-live staff Amend / Resend buttons
-- fail with a 500 ("Could not create the revised proposal" / "Could not
-- re-send the proposal"). No data is lost either way.
--
-- Apply by hand in the Supabase SQL editor, as one run. An agent never applies a
-- production migration (docs/database.md). The statements are one transaction:
-- any failure rolls everything back.

-- ── PRE-FLIGHT (read-only; run each statement separately) ───────────────────
--
-- 1. The two functions, with the argument lists dropped below.
--
-- select p.oid::regprocedure
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('create_proposal_amendment', 'start_proposal_resend');
-- -- Expect exactly two rows:
-- --   create_proposal_amendment(uuid,text,text,text,text,text,text[],jsonb,text,jsonb,numeric,numeric,numeric,timestamp with time zone,timestamp with time zone)
-- --   start_proposal_resend(uuid,text,timestamp with time zone,timestamp with time zone)
-- -- Different argument lists: stop and report; the guard below would abort.
--
-- 2. Amend / resend email deliveries by status. Also decides whether the web
--    PR may remove the runner's amended/resent branch.
--
-- select event_type, status, count(*),
--        min(created_at) as oldest, max(created_at) as newest
--   from public.email_deliveries
--  where event_type in ('proposal.amended_client', 'proposal.resent_client')
--  group by 1, 2 order by 1, 2;
-- -- Expect no pending / processing / retry_scheduled row. accepted and
-- -- permanently_failed rows are history and are left alone. ANY open row:
-- -- stop. Either wait for the web retry runner to send it (it still rebuilds
-- -- these two events until the web PR merges), or tell the agent; do not merge
-- -- the web PR while one is open, or the runner fails it permanently as
-- -- `unsupported_event`.
--
-- 3. Nothing else in the database calls either function.
--
-- select p.oid::regprocedure
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname not in ('create_proposal_amendment', 'start_proposal_resend')
--    and (p.prosrc ilike '%create_proposal_amendment%'
--         or p.prosrc ilike '%start_proposal_resend%');
-- -- Expect 0 rows.
--
-- 4. Proposals superseded through amendment, for the record (unchanged by this
--    migration; supersedes_id / superseded_by_id stay).
--
-- select count(*) filter (where status = 'superseded') as superseded,
--        count(*) filter (where supersedes_id is not null) as revisions
--   from public.proposals;

begin;

-- Run-once guard: both functions must be present with the expected arguments.
do $$
begin
  if to_regprocedure('public.create_proposal_amendment(uuid,text,text,text,text,text,text[],jsonb,text,jsonb,numeric,numeric,numeric,timestamptz,timestamptz)') is null
     or to_regprocedure('public.start_proposal_resend(uuid,text,timestamptz,timestamptz)') is null then
    raise exception '002: create_proposal_amendment or start_proposal_resend is missing (already dropped, or a different signature); nothing changed.';
  end if;
end $$;

-- RESTRICT (the default): fails, and rolls back, if anything depends on them.
drop function public.create_proposal_amendment(
  uuid, text, text, text, text, text, text[], jsonb, text, jsonb,
  numeric, numeric, numeric, timestamptz, timestamptz
);

drop function public.start_proposal_resend(
  uuid, text, timestamptz, timestamptz
);

-- Final guard: no overload of either name survives.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('create_proposal_amendment', 'start_proposal_resend')
  ) then
    raise exception '002: a create_proposal_amendment or start_proposal_resend overload survived; rolled back.';
  end if;
end $$;

commit;

-- ── VERIFY (read-only) ───────────────────────────────────────────────────────
--
-- select to_regprocedure('public.create_proposal_amendment(uuid,text,text,text,text,text,text[],jsonb,text,jsonb,numeric,numeric,numeric,timestamptz,timestamptz)') as amend_gone,
--        to_regprocedure('public.start_proposal_resend(uuid,text,timestamptz,timestamptz)') as resend_gone;
-- -- Expect both null.
--
-- Then, on the dev box: `npm run db:types`. Expect the diff in src/types/db.ts
-- to remove exactly the create_proposal_amendment and start_proposal_resend
-- entries under Functions, nothing else.
--
-- ── ROLL BACK (only together with a capucor-os rollback) ───────────────────
-- Needed ONLY if capucor.app is rolled back to a Worker version that still has
-- the staff Amend / Resend tools. Re-create both functions from
-- 000_baseline_funnel.sql section 6: paste the two `create or replace function`
-- statements (from "-- create_proposal_amendment — 019" to the end of
-- start_proposal_resend's `$$;`), then restore the grants:
--
-- begin;
-- -- <paste the two function bodies from 000 section 6 here>
-- revoke all on function public.create_proposal_amendment(
--   uuid, text, text, text, text, text, text[], jsonb, text, jsonb,
--   numeric, numeric, numeric, timestamptz, timestamptz
-- ) from public, anon, authenticated;
-- grant execute on function public.create_proposal_amendment(
--   uuid, text, text, text, text, text, text[], jsonb, text, jsonb,
--   numeric, numeric, numeric, timestamptz, timestamptz
-- ) to service_role;
-- revoke all on function public.start_proposal_resend(uuid, text, timestamptz, timestamptz)
--   from public, anon, authenticated;
-- grant execute on function public.start_proposal_resend(uuid, text, timestamptz, timestamptz)
--   to service_role;
-- commit;
--
-- Do NOT paste the baseline's first statement: it raises on purpose. Then
-- `npm run db:types` again. A resend delivery created after a rollback is
-- rebuilt only by a runner that still has the amended/resent branch (revert
-- this PR's scripts/reconcile-deliveries.mjs change too).
