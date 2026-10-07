-- ════════════════════════════════════════════════════════════════════════════
-- 003_drop_legacy_signed_event_types.sql — web-standalone phase 5
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHAT IT CHANGES
--   finish_proposal_fulfilment_stage is re-created WITHOUT the release-window
--   acceptance 001 added: its client_email stage now accepts only a
--   `proposal.signed_client` delivery and its owner_email stage only a
--   `proposal.signed_owner` delivery. The old `proposal.portal_ready_client` /
--   `proposal.provisioned_owner` are refused with fulfilment_delivery_event_mismatch.
--   The body is otherwise identical to 001's, as are the signature, grants and
--   comment. Nothing else changes: no table, column, row, policy or other
--   function.
--
-- WHY. 001 accepted the two pre-phase-3 event types only so that sends open
-- across the phase-3 release could finish. That window is closed: the phase-3
-- Worker has been live since 2026-10-07, nothing sends either type, and Zjak's
-- read-only check on 2026-10-07 found no pending / processing / retry_scheduled
-- delivery of either type and no unfinished fulfilment row pointing at one.
-- The same PR removes the matching LEGACY_* branch from
-- scripts/reconcile-deliveries.mjs.
--
-- ORDER. Independent of the code: neither the Worker nor the retry runner
-- produces the old event types any more. Apply before or after the PR merges;
-- the in-transaction guards below abort if an open row has appeared.
--
-- Apply by hand in the Supabase SQL editor, as one run. An agent never applies a
-- production migration (docs/database.md). The statements are one transaction:
-- any failure rolls everything back.

-- ── PRE-FLIGHT (read-only; run each statement separately) ───────────────────
--
-- 1. Open deliveries of the two old event types.
--
-- select event_type, status, count(*), min(created_at) as oldest, max(created_at) as newest
--   from public.email_deliveries
--  where event_type in ('proposal.portal_ready_client', 'proposal.provisioned_owner')
--    and status in ('pending', 'processing', 'retry_scheduled')
--  group by 1, 2 order by 1, 2;
-- -- Expect 0 rows (2026-10-07: 0). Any row: stop; the guard below would abort.
--
-- 2. Unfinished fulfilment rows still pointing at an old-event delivery.
--
-- select f.proposal_id, f.client_email_status, f.owner_email_status, d.event_type, d.status
--   from public.proposal_fulfilment f
--   join public.email_deliveries d
--     on d.id in (f.client_email_delivery_id, f.owner_email_delivery_id)
--  where f.completed_at is null
--    and d.event_type in ('proposal.portal_ready_client', 'proposal.provisioned_owner');
-- -- Expect 0 rows (2026-10-07: 0). Any row: stop; the guard below would abort.
--
-- 3. The function, with the argument list re-created below, and that it still
--    carries the release-window acceptance.
--
-- select p.oid::regprocedure,
--        p.prosrc like '%proposal.portal_ready_client%' as accepts_legacy
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname = 'finish_proposal_fulfilment_stage';
-- -- Expect exactly one row:
-- --   finish_proposal_fulfilment_stage(uuid,uuid,text,text,timestamp with time zone,timestamp with time zone,uuid,text,text) | true
-- -- accepts_legacy = false means 003 is already applied; the guard below aborts.

begin;

-- Run-once guard, and the pre-flight re-checked inside the transaction.
do $$
begin
  if to_regprocedure('public.finish_proposal_fulfilment_stage(uuid,uuid,text,text,timestamptz,timestamptz,uuid,text,text)') is null then
    raise exception '003: finish_proposal_fulfilment_stage with the expected arguments is missing; nothing changed.';
  end if;
  if not exists (
    select 1 from pg_proc
     where oid = to_regprocedure('public.finish_proposal_fulfilment_stage(uuid,uuid,text,text,timestamptz,timestamptz,uuid,text,text)')
       and prosrc like '%proposal.portal_ready_client%'
  ) then
    raise exception '003: finish_proposal_fulfilment_stage no longer accepts the old event types (already applied?); nothing changed.';
  end if;
  if exists (
    select 1 from public.email_deliveries
     where event_type in ('proposal.portal_ready_client', 'proposal.provisioned_owner')
       and status in ('pending', 'processing', 'retry_scheduled')
  ) then
    raise exception '003: an open proposal.portal_ready_client / provisioned_owner delivery exists; nothing changed.';
  end if;
  if exists (
    select 1 from public.proposal_fulfilment f
      join public.email_deliveries d
        on d.id in (f.client_email_delivery_id, f.owner_email_delivery_id)
     where f.completed_at is null
       and d.event_type in ('proposal.portal_ready_client', 'proposal.provisioned_owner')
  ) then
    raise exception '003: an unfinished fulfilment row points at an old-event delivery; nothing changed.';
  end if;
end $$;

create or replace function public.finish_proposal_fulfilment_stage(
  p_proposal_id uuid,
  p_lease_token uuid,
  p_stage text,
  p_outcome text,
  p_finished_at timestamptz,
  p_next_attempt_at timestamptz default null,
  p_delivery_id uuid default null,
  p_error_code text default null,
  p_error_message text default null
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_row public.proposal_fulfilment%rowtype;
  v_delivery public.email_deliveries%rowtype;
  v_pdf_status text;
  v_client_status text;
  v_owner_status text;
  v_pdf_at timestamptz;
  v_client_at timestamptz;
  v_owner_at timestamptz;
  v_client_delivery_id uuid;
  v_owner_delivery_id uuid;
  v_completed_at timestamptz;
begin
  if p_stage not in ('pdf', 'client_email', 'owner_email')
     or p_outcome not in ('success', 'retry_scheduled', 'permanently_failed', 'not_required')
     or p_finished_at is null then
    raise exception 'invalid_fulfilment_completion' using errcode = '22023';
  end if;
  if p_outcome in ('retry_scheduled', 'permanently_failed')
     and (p_error_code is null or p_error_message is null) then
    raise exception 'fulfilment_error_required' using errcode = '22023';
  end if;
  if p_outcome = 'retry_scheduled' and p_next_attempt_at is null then
    raise exception 'fulfilment_retry_time_required' using errcode = '22023';
  end if;
  if p_outcome = 'not_required' and p_stage <> 'owner_email' then
    raise exception 'not_required_only_valid_for_owner_email' using errcode = '22023';
  end if;

  select f.*
    into v_row
    from public.proposal_fulfilment f
   where f.proposal_id = p_proposal_id
     and f.lease_token = p_lease_token
     and f.lease_expires_at is not null
   for update;

  if not found then
    return false;
  end if;
  if (p_stage = 'pdf' and v_row.pdf_status <> 'processing')
     or (p_stage = 'client_email' and v_row.client_email_status <> 'processing')
     or (p_stage = 'owner_email' and v_row.owner_email_status <> 'processing') then
    return false;
  end if;

  v_pdf_status := v_row.pdf_status;
  v_client_status := v_row.client_email_status;
  v_owner_status := v_row.owner_email_status;
  v_pdf_at := v_row.pdf_completed_at;
  v_client_at := v_row.client_email_accepted_at;
  v_owner_at := v_row.owner_email_accepted_at;
  v_client_delivery_id := v_row.client_email_delivery_id;
  v_owner_delivery_id := v_row.owner_email_delivery_id;

  if p_stage in ('client_email', 'owner_email') and p_delivery_id is not null then
    select d.* into v_delivery
      from public.email_deliveries d
     where d.id = p_delivery_id
       and d.source_type = 'proposal'
       and d.source_id = p_proposal_id;
    if not found then
      raise exception 'fulfilment_delivery_not_found' using errcode = 'P0002';
    end if;
    if (p_stage = 'client_email' and v_delivery.event_type <> 'proposal.signed_client')
       or (p_stage = 'owner_email' and v_delivery.event_type <> 'proposal.signed_owner') then
      raise exception 'fulfilment_delivery_event_mismatch' using errcode = 'P0001';
    end if;
  end if;

  if p_stage = 'pdf' then
    v_pdf_status := case p_outcome
      when 'success' then 'complete'
      when 'retry_scheduled' then 'retry_scheduled'
      else 'permanently_failed' end;
    v_pdf_at := case when p_outcome = 'success' then p_finished_at else null end;
  elsif p_stage = 'client_email' then
    v_client_delivery_id := coalesce(p_delivery_id, v_client_delivery_id);
    if p_outcome = 'success' then
      if v_delivery.status <> 'accepted' or v_delivery.accepted_at is null then
        raise exception 'fulfilment_delivery_not_accepted' using errcode = 'P0001';
      end if;
      v_client_status := 'accepted';
      v_client_at := v_delivery.accepted_at;
    else
      v_client_status := case when p_outcome = 'retry_scheduled'
        then 'retry_scheduled' else 'permanently_failed' end;
      v_client_at := null;
    end if;
  else
    v_owner_delivery_id := coalesce(p_delivery_id, v_owner_delivery_id);
    if p_outcome = 'not_required' then
      v_owner_status := 'not_required';
      v_owner_delivery_id := null;
      v_owner_at := null;
    elsif p_outcome = 'success' then
      if v_delivery.status <> 'accepted' or v_delivery.accepted_at is null then
        raise exception 'fulfilment_delivery_not_accepted' using errcode = 'P0001';
      end if;
      v_owner_status := 'accepted';
      v_owner_at := v_delivery.accepted_at;
    else
      v_owner_status := case when p_outcome = 'retry_scheduled'
        then 'retry_scheduled' else 'permanently_failed' end;
      v_owner_at := null;
    end if;
  end if;

  v_completed_at := case
    when v_pdf_status = 'complete'
      and v_client_status = 'accepted'
      and v_owner_status in ('accepted', 'not_required')
    then coalesce(v_row.completed_at, p_finished_at)
    else null
  end;

  update public.proposal_fulfilment
     set pdf_status = v_pdf_status,
         client_email_status = v_client_status,
         owner_email_status = v_owner_status,
         client_email_delivery_id = v_client_delivery_id,
         owner_email_delivery_id = v_owner_delivery_id,
         pdf_completed_at = v_pdf_at,
         client_email_accepted_at = v_client_at,
         owner_email_accepted_at = v_owner_at,
         completed_at = v_completed_at,
         last_error_stage = case when p_outcome in ('retry_scheduled', 'permanently_failed') then p_stage else null end,
         last_error_code = case when p_outcome in ('retry_scheduled', 'permanently_failed') then pg_catalog.left(p_error_code, 2000) else null end,
         last_error_message = case when p_outcome in ('retry_scheduled', 'permanently_failed') then pg_catalog.left(p_error_message, 2000) else null end,
         next_attempt_at = coalesce(p_next_attempt_at, p_finished_at),
         lease_token = null,
         lease_expires_at = null
   where proposal_fulfilment.proposal_id = p_proposal_id;

  return true;
end;
$$;
revoke all on function public.finish_proposal_fulfilment_stage(
  uuid, uuid, text, text, timestamptz, timestamptz, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.finish_proposal_fulfilment_stage(
  uuid, uuid, text, text, timestamptz, timestamptz, uuid, text, text
) to service_role;
comment on function public.finish_proposal_fulfilment_stage(
  uuid, uuid, text, text, timestamptz, timestamptz, uuid, text, text
) is 'Service-role-only completion of one leased fulfilment stage (pdf, client_email, owner_email).';

-- Final guard: the new body refuses both old types and keeps the new ones.
do $$
begin
  if not exists (
    select 1 from pg_proc
     where oid = to_regprocedure('public.finish_proposal_fulfilment_stage(uuid,uuid,text,text,timestamptz,timestamptz,uuid,text,text)')
       and prosrc not like '%proposal.portal_ready_client%'
       and prosrc not like '%proposal.provisioned_owner%'
       and prosrc like '%proposal.signed_client%'
       and prosrc like '%proposal.signed_owner%'
  ) then
    raise exception '003: finish_proposal_fulfilment_stage body is not as expected; rolled back.';
  end if;
end $$;

commit;

-- ── VERIFY (read-only) ───────────────────────────────────────────────────────
--
-- select p.prosrc like '%proposal.portal_ready_client%' as accepts_old_client,
--        p.prosrc like '%proposal.provisioned_owner%' as accepts_old_owner,
--        has_function_privilege('service_role', p.oid, 'execute') as svc_exec,
--        has_function_privilege('anon', p.oid, 'execute') as anon_exec
--   from pg_proc p
--  where p.oid = to_regprocedure('public.finish_proposal_fulfilment_stage(uuid,uuid,text,text,timestamptz,timestamptz,uuid,text,text)');
-- -- Expect false, false, true, false.
--
-- Then, on the dev box: `npm run db:types`. Expect NO diff in src/types/db.ts
-- (the signature is unchanged). Then dispatch cron-reconcile-deliveries once
-- and expect it green.
--
-- ── ROLL BACK ────────────────────────────────────────────────────────────────
-- Not expected to be needed: nothing produces the old event types. If it is,
-- re-create 001's version: paste from 001_signing_stops_at_signed_pdf.sql the
-- block from "create or replace function public.finish_proposal_fulfilment_stage("
-- down to and including its `comment on function …` statement, inside
-- begin; … commit;. The code rollback is reverting this PR (the runner's
-- LEGACY_* branch); the two are independent.
