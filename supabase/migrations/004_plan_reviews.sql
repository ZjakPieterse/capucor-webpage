-- ════════════════════════════════════════════════════════════════════════════
-- 004_plan_reviews.sql — plan-review-tool scaffolding
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHAT IT CHANGES
--   1. proposals gains five nullable-or-defaulted columns (no data is touched):
--        kind                 'new' (default) | 'review'
--        effective_from       date the fee starts; always a 1st of the month
--        change_summary       jsonb "what changed" for the client view
--        replaces_legacy_ref  engagement-letter ref a legacy client's review replaces
--        previous_monthly_zar the fee being replaced, excl. VAT
--      plus CHECKs: a 'review' replaces exactly one thing (supersedes_id OR
--      replaces_legacy_ref) and states effective_from; effective_from is a 1st;
--      previous_monthly_zar >= 0.
--   2. A partial unique index: at most one OPEN (sent/viewed) proposal
--      supersedes any one plan ("one open review per plan").
--   3. New table plan_reviews: the review log (no_change | proposal_sent).
--      RLS on, no policies; service_role only.
--   4. commit_proposal_signature is re-created (same signature, grants and
--      return shape). In the signing transaction it now also:
--        a. when supersedes_id is set, locks the old plan and REFUSES the
--           signature (returns no row, as for any other refusal) unless the old
--           plan is still in force — status 'signed' or 'active' with no
--           superseded_by_id; otherwise marks it 'superseded' with
--           superseded_by_id = the new proposal;
--        b. when effective_from is set and the signing date (South African
--           time) is on or after it, moves effective_from to the 1st of the
--           month after the signing date. Never back-dated.
--      Proposals without supersedes_id / effective_from (every row today) sign
--      exactly as before.
--   Nothing is dropped.
--
-- DELETES. Nothing in this repo deletes proposals. If one ever must go (e.g. a
-- POPIA erasure): delete its plan_reviews rows first (their FKs have no ON
-- DELETE action), and delete a client's review proposals before the plan they
-- supersede — the FK's SET NULL would otherwise break the "review replaces
-- exactly one thing" CHECK and the delete fails.
--
-- CONCURRENCY. Two reviews of one plan cannot both be open (the index), and
-- the function locks new row → old row, so a second signer waits and then sees
-- the old plan superseded. The lock is verified by reading (READ COMMITTED
-- re-reads the locked row), not by test: PGlite has a single connection.
--
-- WHY. Decision 2026-10-15 (plan-review-tool): a signed review proposal
-- replaces the client's plan ON SIGNING, never on sending — the old plan stays
-- in force until then (engagement terms, "changes" block in
-- src/config/proposalTerms.ts). "In force" includes 'active': plans signed
-- before 2026-10-07 were promoted to 'active' by the old portal provisioning
-- (Zjak, 2026-10-15). New fee from the 1st of the next month; if signed on or
-- after that date, from the next 1st (decision #7).
--
-- ORDER. Apply before the code that writes the new columns (web PR 3). The
-- current Worker is unaffected: it never sets supersedes_id or effective_from
-- on a new proposal, and finalizeSign already treats "no row" as a refusal.
--
-- Apply by hand in the Supabase SQL editor, as one run. An agent never applies a
-- production migration (docs/database.md). The statements are one transaction:
-- any failure rolls everything back.

-- ── PRE-FLIGHT (read-only; run each statement separately) ───────────────────
--
-- 1. The new columns and table do not exist yet.
--
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'proposals'
--    and column_name in ('kind', 'effective_from', 'change_summary',
--                        'replaces_legacy_ref', 'previous_monthly_zar');
-- select to_regclass('public.plan_reviews');
-- -- Expect 0 rows, then NULL. Anything else: stop; the guard below aborts.
--
-- 2. No plan already has two open proposals superseding it (the new unique
--    index would fail).
--
-- select supersedes_id, count(*)
--   from public.proposals
--  where supersedes_id is not null and status in ('sent', 'viewed')
--  group by 1 having count(*) > 1;
-- -- Expect 0 rows (2026-10-15: 0 open proposals with supersedes_id).
--
-- 3. Every proposal by status (for comparison with verify 4). In force =
--    signed or active, not superseded; anything else (e.g. 'paid') is not.
--
-- select status, superseded_by_id is not null as superseded, count(*)
--   from public.proposals group by 1, 2 order by 1, 2;
-- -- 2026-10-15, after the 28 test plans were retired (Zjak): expired 35,
-- -- superseded 1, viewed 1; none in force. No 'paid'; one would need a
-- -- decision before reviews start.
--
-- 4. The function being replaced has the expected signature.
--
-- select to_regprocedure('public.commit_proposal_signature(uuid,text,timestamptz)');
-- -- Expect commit_proposal_signature(uuid,text,timestamp with time zone).

begin;

-- Run-once guard.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'proposals' and column_name = 'kind'
  ) or to_regclass('public.plan_reviews') is not null then
    raise exception '004: proposals.kind or plan_reviews already exists; this migration has run.';
  end if;
end $$;

-- 1. New proposals columns.
alter table public.proposals
  add column kind                 text not null default 'new',
  add column effective_from       date,
  add column change_summary       jsonb,
  add column replaces_legacy_ref  text,
  add column previous_monthly_zar numeric(12,2);

alter table public.proposals
  add constraint proposals_kind_check check (kind in ('new', 'review')),
  add constraint proposals_review_replaces_one_check check (
    kind <> 'review'
    or ((supersedes_id is not null) <> (replaces_legacy_ref is not null))
  ),
  add constraint proposals_effective_from_first_check check (
    effective_from is null or extract(day from effective_from) = 1
  ),
  -- Decision #7: a review always states its start date.
  add constraint proposals_review_effective_from_check check (
    kind <> 'review' or effective_from is not null
  ),
  add constraint proposals_previous_monthly_check check (
    previous_monthly_zar is null or previous_monthly_zar >= 0
  ),
  add constraint proposals_replaces_legacy_ref_check check (
    replaces_legacy_ref is null
    or (replaces_legacy_ref = btrim(replaces_legacy_ref) and replaces_legacy_ref <> '')
  );

comment on column public.proposals.kind is
  '''new'' (calculator or internal new client) or ''review'' (replaces a plan: supersedes_id, or replaces_legacy_ref for a legacy client). 004.';
comment on column public.proposals.effective_from is
  'The 1st of the month the fee starts. commit_proposal_signature moves it to the next 1st when signed on or after it (SA time). Null on rows before 004.';
comment on column public.proposals.change_summary is
  'What changed against the replaced plan, for the client''s "Updated plan" view. Shape owned by the internal tool. 004.';
comment on column public.proposals.replaces_legacy_ref is
  'Engagement-letter reference a legacy client''s first review proposal replaces. 004.';
comment on column public.proposals.previous_monthly_zar is
  'Monthly fee (excl. VAT) of the plan being replaced. 004.';

-- 2. One open review per plan.
create unique index proposals_one_open_review_idx
  on public.proposals (supersedes_id)
  where supersedes_id is not null and status in ('sent', 'viewed');

-- 3. The review log.
create table public.plan_reviews (
  id              uuid primary key default gen_random_uuid(),
  proposal_id     uuid not null references public.proposals(id),   -- the plan reviewed
  reviewed_at     timestamptz not null default now(),
  outcome         text not null check (outcome in ('no_change', 'proposal_sent')),
  new_proposal_id uuid references public.proposals(id),
  note            text,
  constraint plan_reviews_new_proposal_check check (
    (outcome = 'proposal_sent') = (new_proposal_id is not null)
  )
);
create index plan_reviews_proposal_idx on public.plan_reviews (proposal_id, reviewed_at desc);

alter table public.plan_reviews enable row level security;
revoke all on table public.plan_reviews from public, anon, authenticated;
grant select, insert, update, delete on table public.plan_reviews to service_role;
comment on table public.plan_reviews is
  'Service-role-only quarterly review log. proposal_id = the plan reviewed; new_proposal_id = the review proposal sent, if any. 004.';

-- 4. commit_proposal_signature: supersede on sign + effective_from roll-forward.
--    The 000 body plus the two blocks marked 004.
create or replace function public.commit_proposal_signature(
  p_proposal_id uuid,
  p_confirm_token text,
  p_signed_at timestamptz
)
returns table (proposal_id uuid)
language plpgsql
set search_path = ''
as $$
declare
  v_proposal public.proposals%rowtype;
  v_old public.proposals%rowtype;
  v_signed_date date;
  v_effective_from date;
begin
  select p.*
    into v_proposal
    from public.proposals p
   where p.id = p_proposal_id
     and p.sign_confirm_token = p_confirm_token
   for update;

  if not found
     or v_proposal.status not in ('sent', 'viewed')
     or v_proposal.sign_confirm_expires_at is null
     or v_proposal.sign_confirm_expires_at < p_signed_at
     or v_proposal.pending_signature_name is null
     or v_proposal.pending_signature_method is null
     or v_proposal.pending_signature_image is null then
    return;
  end if;

  -- 004: the plan this proposal replaces must still be in force. Locked after
  -- the new row (always new → old), so two reviews of one plan serialise and
  -- the second is refused.
  if v_proposal.supersedes_id is not null then
    select p.*
      into v_old
      from public.proposals p
     where p.id = v_proposal.supersedes_id
     for update;

    if not found
       or v_old.status not in ('signed', 'active')
       or v_old.superseded_by_id is not null then
      return;
    end if;
  end if;

  -- 004: never back-dated. Signed on or after the start date → next 1st.
  v_signed_date := (p_signed_at at time zone 'Africa/Johannesburg')::date;
  v_effective_from := v_proposal.effective_from;
  if v_effective_from is not null and v_signed_date >= v_effective_from then
    v_effective_from := (date_trunc('month', v_signed_date::timestamp) + interval '1 month')::date;
  end if;

  update public.proposals
     set status = 'signed',
         signed_at = p_signed_at,
         effective_from = v_effective_from,
         signature_name = v_proposal.pending_signature_name,
         signature_method = v_proposal.pending_signature_method,
         signature_image = v_proposal.pending_signature_image,
         signature_ip = v_proposal.pending_signature_ip,
         pending_signature_name = null,
         pending_signature_method = null,
         pending_signature_image = null,
         pending_signature_ip = null,
         sign_confirm_token = null,
         sign_confirm_expires_at = null
   where id = v_proposal.id;

  -- 004: retire the old plan in the same transaction.
  if v_proposal.supersedes_id is not null then
    update public.proposals
       set status = 'superseded',
           superseded_by_id = v_proposal.id
     where id = v_old.id;
  end if;

  insert into public.proposal_fulfilment (proposal_id, next_attempt_at)
  values (v_proposal.id, p_signed_at)
  on conflict on constraint proposal_fulfilment_pkey do nothing;

  return query select v_proposal.id;
end;
$$;
revoke all on function public.commit_proposal_signature(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.commit_proposal_signature(uuid, text, timestamptz)
  to service_role;
comment on function public.commit_proposal_signature(uuid, text, timestamptz) is
  'Service-role-only atomic signature commit and fulfilment-row creation. The confirmation token is consumed in the same transaction. Since 004: supersedes the replaced plan (refused unless it is still in force) and rolls effective_from forward.';

-- Final guard: the new body is in place.
do $$
begin
  if not exists (
    select 1 from pg_proc
     where oid = to_regprocedure('public.commit_proposal_signature(uuid,text,timestamptz)')
       and prosrc like '%superseded_by_id = v_proposal.id%'
       and prosrc like '%Africa/Johannesburg%'
  ) then
    raise exception '004: commit_proposal_signature body is not as expected; rolled back.';
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
--    and column_name in ('kind', 'effective_from', 'change_summary',
--                        'replaces_legacy_ref', 'previous_monthly_zar')
--  order by column_name;
-- -- Expect 5 rows; kind: text, default 'new'::text, NOT NULL; the rest nullable.
--
-- 2. Every existing row is 'new'.
--
-- select kind, count(*) from public.proposals group by 1;
-- -- Expect one row: new | <all proposals> (2026-10-15: 37).
--
-- 3. plan_reviews is locked down.
--
-- select relrowsecurity,
--        has_table_privilege('anon', 'public.plan_reviews', 'select') as anon_sel,
--        has_table_privilege('authenticated', 'public.plan_reviews', 'select') as auth_sel,
--        has_table_privilege('service_role', 'public.plan_reviews', 'insert') as svc_ins
--   from pg_class where oid = 'public.plan_reviews'::regclass;
-- -- Expect true, false, false, true.
--
-- 4. Plans in force are unchanged (compare with pre-flight 3).
--
-- select status, count(*) from public.proposals
--  where status in ('signed', 'active') and superseded_by_id is null
--  group by 1 order by 1;
--
-- 5. The signing function is the new one and still service-role only.
--
-- select p.prosrc like '%Africa/Johannesburg%' as rolls_forward,
--        has_function_privilege('service_role', p.oid, 'execute') as svc_exec,
--        has_function_privilege('anon', p.oid, 'execute') as anon_exec
--   from pg_proc p
--  where p.oid = to_regprocedure('public.commit_proposal_signature(uuid,text,timestamptz)');
-- -- Expect true, true, false.
--
-- Then, on the dev box: `npm run db:types` (unset SUPABASE_ACCESS_TOKEN for the
-- command if it fails with Unauthorized). Expect the five new proposals columns
-- and the plan_reviews table in src/types/db.ts; commit it with the code that
-- first uses them.
--
-- ── ROLL BACK ────────────────────────────────────────────────────────────────
-- Only before any review proposal exists (the dropped columns would lose data).
-- In one run:
--
-- begin;
-- -- paste from 000_baseline_funnel.sql the block from
-- -- "create or replace function public.commit_proposal_signature(" down to and
-- -- including its `comment on function …` statement, then:
-- drop table public.plan_reviews;
-- drop index public.proposals_one_open_review_idx;
-- alter table public.proposals
--   drop constraint proposals_kind_check,
--   drop constraint proposals_review_replaces_one_check,
--   drop constraint proposals_review_effective_from_check,
--   drop constraint proposals_effective_from_first_check,
--   drop constraint proposals_previous_monthly_check,
--   drop constraint proposals_replaces_legacy_ref_check,
--   drop column kind,
--   drop column effective_from,
--   drop column change_summary,
--   drop column replaces_legacy_ref,
--   drop column previous_monthly_zar;
-- commit;
