-- ════════════════════════════════════════════════════════════════════════════
-- 007_annual_proposal_ref.sql — reference numbers FT-YYYYMMNNNN, counted per year
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHAT IT CHANGES
--   New proposals get a reference like FT-2026110007 in place of
--   FT-2026-11-0003: 'FT-', the year and month the proposal is created
--   (South African time), then a 4-digit number that counts every proposal
--   in the YEAR. The count does not restart each month; it restarts on
--   1 January. Past the 9 999th proposal in a year the number simply grows
--   (never truncated, so never a clash).
--
--   * public.proposal_ref_for(timestamptz) — new: builds the reference for a
--     given moment and bumps that year's counter.
--   * public.next_proposal_ref() — same name, no arguments, same grants;
--     now calls proposal_ref_for(now()). The insert trigger is unchanged.
--   * public.proposal_ref_counters — same table; yearly rows keyed 'YYYY'
--     sit beside the old monthly 'YYYY-MM' rows, which stay as history.
--     The current year's row is seeded with the number of references the
--     monthly counters already issued this year, so the next proposal
--     continues the year's count (e.g. 3 issued in 2026 → next is …0004).
--   Existing proposals keep their old references. Nothing is dropped.
--
-- WHY. Zjak, 2026-11-07: a shorter reference with one running count for the
--   year. Months are also now taken in South African time (the old function
--   used the database's UTC clock, so a proposal made just after midnight
--   on the 1st was filed under the previous month).
--
-- ORDER. Independent of any code deploy: no code parses the reference. It
--   takes effect for the next proposal created after it is applied.
--
-- Apply by hand in the Supabase SQL editor, as one run. An agent never applies a
-- production migration (docs/database.md). One transaction: any failure rolls
-- everything back.

-- ── PRE-FLIGHT (read-only) ───────────────────────────────────────────────────
--
-- select period, last_seq from public.proposal_ref_counters order by period;
-- -- Expect only 'YYYY-MM' rows. A 4-character 'YYYY' row means 007 has run; stop.
--
-- select count(*) from public.proposals
--  where ref_number like 'FT-' || to_char(now() at time zone 'Africa/Johannesburg', 'YYYY') || '-%';
-- -- Proposals referenced this year; should equal the seed shown in VERIFY
-- -- (the seed can be higher if a referenced proposal was since deleted).

begin;

-- Run-once guard.
do $$
begin
  if exists (select 1 from public.proposal_ref_counters where length(period) = 4) then
    raise exception '007: a yearly counter row already exists; nothing to do.';
  end if;
end $$;

-- Seed this year's running count from the monthly counters already used.
insert into public.proposal_ref_counters (period, last_seq)
select to_char(now() at time zone 'Africa/Johannesburg', 'YYYY'),
       coalesce(sum(last_seq), 0)
  from public.proposal_ref_counters
 where period like to_char(now() at time zone 'Africa/Johannesburg', 'YYYY') || '-%';

create or replace function public.proposal_ref_for(p_at timestamptz)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_local timestamp := p_at at time zone 'Africa/Johannesburg';
  v_year  text      := to_char(v_local, 'YYYY');
  v_seq   int;
begin
  insert into public.proposal_ref_counters (period, last_seq)
    values (v_year, 1)
  on conflict (period)
    do update set last_seq = public.proposal_ref_counters.last_seq + 1
  returning last_seq into v_seq;

  return 'FT-' || to_char(v_local, 'YYYYMM')
              || case when v_seq > 9999 then v_seq::text
                      else lpad(v_seq::text, 4, '0') end;
end;
$$;

create or replace function public.next_proposal_ref()
returns text
language plpgsql
set search_path = ''
as $$
begin
  return public.proposal_ref_for(now());
end;
$$;

revoke all on function public.proposal_ref_for(timestamptz) from public, anon, authenticated;
grant execute on function public.proposal_ref_for(timestamptz) to service_role;

comment on table public.proposal_ref_counters is
  'Proposal reference counters. Since 007: one row per year (period ''YYYY''), refs FT-YYYYMMNNNN. Older ''YYYY-MM'' rows are the pre-007 monthly counters, kept as history.';

commit;

-- ── VERIFY (read-only) ───────────────────────────────────────────────────────
--
-- select period, last_seq from public.proposal_ref_counters where length(period) = 4;
-- -- Expect one row for this year; last_seq = references issued this year so far.
--
-- The next proposal created on the site shows FT-<YYYYMM><last_seq + 1, 4 digits>.
-- (Don't call next_proposal_ref() to test it: every call uses up a number.)
--
-- New function: run `npm run db:types` afterwards to add proposal_ref_for.
--
-- ── ROLL BACK ────────────────────────────────────────────────────────────────
-- Restores monthly FT-YYYY-MM-NNNN refs. The monthly counters were left as
-- they were and the two formats can't produce the same string, so no clash.
-- In one run:
--
-- begin;
-- create or replace function public.next_proposal_ref()
-- returns text
-- language plpgsql
-- set search_path = ''
-- as $$
-- declare
--   v_period text := to_char(now(), 'YYYY-MM');
--   v_seq    int;
-- begin
--   insert into public.proposal_ref_counters (period, last_seq)
--     values (v_period, 1)
--   on conflict (period)
--     do update set last_seq = public.proposal_ref_counters.last_seq + 1
--   returning last_seq into v_seq;
--   return 'FT-' || v_period || '-' || lpad(v_seq::text, 4, '0');
-- end;
-- $$;
-- drop function public.proposal_ref_for(timestamptz);
-- delete from public.proposal_ref_counters where length(period) = 4;
-- commit;
