-- ════════════════════════════════════════════════════════════════════════════
-- 001_signing_stops_at_signed_pdf.sql — web-standalone phase 3
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHAT IT CHANGES
--   1. proposal_fulfilment loses its `portal` stage: the columns portal_status,
--      portal_attempt_count and portal_completed_at, and every CHECK that names
--      them. The stages left are pdf → client_email → owner_email.
--   2. claim_proposal_fulfilment_stage, finish_proposal_fulfilment_stage and
--      sync_proposal_fulfilment_email are re-created without the portal stage.
--      finish_… accepts the new email event types `proposal.signed_client` /
--      `proposal.signed_owner` AND, for the release window only, the old
--      `proposal.portal_ready_client` / `proposal.provisioned_owner` (see
--      "Release window" below).
--   3. provision_from_signed_proposal is dropped. Signing no longer writes the
--      portal-owned client_orgs / client_org_members / subscriptions.
--
-- WHY. Decision 2026-10-07 (web-standalone): after signing, the funnel stops at
-- proposal `signed` + signed PDF in Drive. capucor.app plays no part.
--
-- ROWS IN, OR WAITING ON, THE PORTAL STAGE. Any proposal_fulfilment row that is
-- not complete and whose portal stage is pending, retry_scheduled, processing or
-- permanently_failed is RELEASED into the pdf stage: a portal lease is cleared,
-- a portal error is cleared, and the row is made due now. The proposal itself is
-- left as it is (`signed`); NO portal records are created for it. The next
-- signing request or retry run then archives the PDF and sends the two "signed"
-- emails. A row whose portal stage had permanently failed already sent Zjak a
-- "Provisioning FAILED" email; it now also gets the normal signed emails.
-- Rows already complete are untouched. Proposals already promoted to `active`
-- by past provisioning stay `active`; client_org_id stays as it is (unused).
--
-- RELEASE WINDOW. Between applying this and deploying the phase-3 Worker, the
-- OLD Worker still signs proposals. It never sees a portal stage again (the
-- claim function no longer returns one) and its emails use the old event types,
-- which finish_… still accepts. capucor-os's reconciliation workflow keeps
-- working for pdf/email stages but its end-of-run report selects portal_status,
-- so its runs fail until Zjak disables it; capucor.app's /internal/operations
-- fulfilment table shows a load error from now on. Neither touches data.
-- A later migration may drop the two old event types once the pre-flight
-- queries below show no open delivery of either.
--
-- Apply by hand in the Supabase SQL editor, as one run. An agent never applies a
-- production migration (docs/database.md). The statements are one transaction:
-- any failure rolls everything back.

-- ── PRE-FLIGHT (read-only; run each statement separately) ───────────────────
--
-- 1. Every fulfilment row that is not complete — i.e. in, or waiting on, a
--    stage. Rows with portal_status other than 'complete' are the ones this
--    migration releases into the pdf stage.
--
-- select f.proposal_id, p.ref_number, p.status as proposal_status,
--        f.portal_status, f.pdf_status, f.client_email_status,
--        f.owner_email_status, f.lease_token is not null as leased,
--        f.last_error_stage, f.last_error_code, f.next_attempt_at, f.created_at
--   from public.proposal_fulfilment f
--   join public.proposals p on p.id = f.proposal_id
--  where f.completed_at is null
--  order by f.created_at;
-- -- Expect 0 rows. Any row: note it; the migration releases it as described
-- -- above. A row with leased = true is mid-attempt: wait a minute and re-run.
--
-- 2. The whole table by portal stage.
--
-- select portal_status, completed_at is not null as completed, count(*)
--   from public.proposal_fulfilment
--  group by 1, 2 order by 1, 2;
-- -- Expect only ('complete', true). Anything else is counted in query 1.
--
-- 3. Email deliveries that are not accepted, by source and event.
--
-- select source_type, event_type, status, count(*),
--        min(created_at) as oldest, max(created_at) as newest
--   from public.email_deliveries
--  where status <> 'accepted'
--  group by 1, 2, 3 order by 1, 2, 3;
-- -- Expect no pending / processing / retry_scheduled row for
-- -- proposal.portal_ready_client, proposal.provisioned_owner or
-- -- proposal.provision_failed_owner. The web retry runner rebuilds the first
-- -- two (as the new "signed" emails) and permanently fails the third.
-- -- Rows with source_type request_email or approval belong to capucor-os: once
-- -- its workflow is disabled, NOTHING retries them.
-- -- permanently_failed rows are old failures; the web runner lists them as
-- -- warnings and does not touch them.
--
-- 4. The CHECK constraints this migration replaces, by their live names.
--
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--  where conrelid = 'public.proposal_fulfilment'::regclass and contype = 'c'
--  order by conname;
-- -- Expect, among others: proposal_fulfilment_processing_lease_check,
-- -- proposal_fulfilment_one_processing_stage_check,
-- -- proposal_fulfilment_portal_complete_check,
-- -- proposal_fulfilment_completed_check,
-- -- proposal_fulfilment_last_error_stage_check. If a name differs, stop: the
-- -- final guard below would abort the migration anyway.
--
-- 5. The four functions this migration replaces or drops.
--
-- select p.oid::regprocedure
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public'
--    and p.proname in ('provision_from_signed_proposal',
--                      'claim_proposal_fulfilment_stage',
--                      'finish_proposal_fulfilment_stage',
--                      'sync_proposal_fulfilment_email');
-- -- Expect exactly four rows, with the argument lists used below.

begin;

-- Run-once guard.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'proposal_fulfilment'
       and column_name = 'portal_status'
  ) then
    raise exception '001: proposal_fulfilment.portal_status is already gone; this migration has run.';
  end if;
end $$;

-- 1. Drop the CHECKs that name the portal stage. They are re-created without it
--    in step 4. (Dropping the columns would drop them too; explicit is clearer.)
alter table public.proposal_fulfilment
  drop constraint if exists proposal_fulfilment_processing_lease_check,
  drop constraint if exists proposal_fulfilment_one_processing_stage_check,
  drop constraint if exists proposal_fulfilment_portal_complete_check,
  drop constraint if exists proposal_fulfilment_completed_check,
  drop constraint if exists proposal_fulfilment_last_error_stage_check;

-- 2. Release rows in, or waiting on, the portal stage into the pdf stage.
update public.proposal_fulfilment
   set lease_token = null,
       lease_expires_at = null
 where completed_at is null
   and portal_status = 'processing';

update public.proposal_fulfilment
   set last_error_stage = null,
       last_error_code = null,
       last_error_message = null
 where last_error_stage = 'portal';

update public.proposal_fulfilment
   set next_attempt_at = least(next_attempt_at, now())
 where completed_at is null
   and portal_status <> 'complete';

-- 3. Drop the portal columns.
alter table public.proposal_fulfilment
  drop column portal_status,
  drop column portal_attempt_count,
  drop column portal_completed_at;

-- A row whose other three stages were already done is now complete. (Not
-- reachable under the old stage order, which needed the portal first; kept so
-- the completed CHECK below cannot fail on an unexpected row.)
update public.proposal_fulfilment
   set completed_at = now()
 where completed_at is null
   and lease_token is null
   and pdf_status = 'complete'
   and client_email_status = 'accepted'
   and owner_email_status in ('accepted', 'not_required');

-- 4. Re-create the CHECKs without the portal stage.
alter table public.proposal_fulfilment
  add constraint proposal_fulfilment_processing_lease_check check (
    lease_token is not null
    or (
      pdf_status <> 'processing'
      and client_email_status <> 'processing'
      and owner_email_status <> 'processing'
    )
  ),
  add constraint proposal_fulfilment_one_processing_stage_check check (
    (pdf_status = 'processing')::integer
    + (client_email_status = 'processing')::integer
    + (owner_email_status = 'processing')::integer <= 1
  ),
  add constraint proposal_fulfilment_completed_check check (
    (completed_at is not null) = (
      pdf_status = 'complete'
      and client_email_status = 'accepted'
      and owner_email_status in ('accepted', 'not_required')
    )
  ),
  add constraint proposal_fulfilment_last_error_stage_check check (
    last_error_stage in ('pdf', 'client_email', 'owner_email')
  );

-- 5. Stage functions without the portal stage. Signatures and return types are
--    unchanged, so `create or replace` keeps the existing service_role-only
--    grants; they are restated anyway.

create or replace function public.claim_proposal_fulfilment_stage(
  p_proposal_id uuid,
  p_lease_token uuid,
  p_lease_expires_at timestamptz
)
returns table (
  proposal_id uuid,
  stage text,
  attempt_count integer
)
language plpgsql
set search_path = ''
as $$
declare
  v_row public.proposal_fulfilment%rowtype;
  v_stage text;
  v_attempt integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_lease_token is null
     or p_lease_expires_at <= v_now
     or p_lease_expires_at > v_now + interval '10 minutes' then
    raise exception 'invalid_fulfilment_lease' using errcode = '22023';
  end if;

  select f.*
    into v_row
    from public.proposal_fulfilment f
   where f.proposal_id = p_proposal_id
     and f.completed_at is null
     and f.next_attempt_at <= v_now
     and (f.lease_token is null or f.lease_expires_at <= v_now)
   for update;

  if not found then
    return;
  end if;

  if v_row.lease_token is not null then
    if v_row.pdf_status = 'processing' then v_stage := 'pdf';
    elsif v_row.client_email_status = 'processing' then v_stage := 'client_email';
    elsif v_row.owner_email_status = 'processing' then v_stage := 'owner_email';
    end if;
  elsif v_row.pdf_status in ('pending', 'retry_scheduled') then
    v_stage := 'pdf';
  elsif v_row.pdf_status = 'complete'
    and v_row.client_email_status in ('pending', 'retry_scheduled') then
    v_stage := 'client_email';
  elsif v_row.pdf_status = 'complete'
    and v_row.client_email_status = 'accepted'
    and v_row.owner_email_status in ('pending', 'retry_scheduled') then
    v_stage := 'owner_email';
  end if;

  if v_stage is null then
    return;
  end if;

  if v_stage = 'pdf' then
    v_attempt := v_row.pdf_attempt_count + 1;
    update public.proposal_fulfilment
       set pdf_status = 'processing', pdf_attempt_count = v_attempt,
           lease_token = p_lease_token, lease_expires_at = p_lease_expires_at
     where proposal_fulfilment.proposal_id = p_proposal_id;
  elsif v_stage = 'client_email' then
    v_attempt := v_row.client_email_attempt_count + 1;
    update public.proposal_fulfilment
       set client_email_status = 'processing', client_email_attempt_count = v_attempt,
           lease_token = p_lease_token, lease_expires_at = p_lease_expires_at
     where proposal_fulfilment.proposal_id = p_proposal_id;
  else
    v_attempt := v_row.owner_email_attempt_count + 1;
    update public.proposal_fulfilment
       set owner_email_status = 'processing', owner_email_attempt_count = v_attempt,
           lease_token = p_lease_token, lease_expires_at = p_lease_expires_at
     where proposal_fulfilment.proposal_id = p_proposal_id;
  end if;

  return query select p_proposal_id, v_stage, v_attempt;
end;
$$;
revoke all on function public.claim_proposal_fulfilment_stage(uuid, uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_proposal_fulfilment_stage(uuid, uuid, timestamptz)
  to service_role;
comment on function public.claim_proposal_fulfilment_stage(uuid, uuid, timestamptz) is
  'Service-role-only CAS claim for the next dependency-ordered fulfilment stage (pdf, client_email, owner_email).';

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
    -- The old event types are accepted for the release window only: the
    -- pre-phase-3 Worker still sends them until the phase-3 deploy.
    if (p_stage = 'client_email'
        and v_delivery.event_type not in ('proposal.signed_client', 'proposal.portal_ready_client'))
       or (p_stage = 'owner_email'
        and v_delivery.event_type not in ('proposal.signed_owner', 'proposal.provisioned_owner')) then
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

create or replace function public.sync_proposal_fulfilment_email(
  p_delivery_id uuid
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_delivery public.email_deliveries%rowtype;
  v_row public.proposal_fulfilment%rowtype;
  v_client_status text;
  v_owner_status text;
  v_client_at timestamptz;
  v_owner_at timestamptz;
  v_completed_at timestamptz;
  v_stage text;
  v_clear_lease boolean := false;
begin
  select d.* into v_delivery
    from public.email_deliveries d
   where d.id = p_delivery_id;
  if not found or v_delivery.status not in ('accepted', 'permanently_failed') then
    return false;
  end if;

  select f.* into v_row
    from public.proposal_fulfilment f
   where f.proposal_id = v_delivery.source_id
     and (f.client_email_delivery_id = p_delivery_id or f.owner_email_delivery_id = p_delivery_id)
   for update;
  if not found then
    return false;
  end if;

  v_client_status := v_row.client_email_status;
  v_owner_status := v_row.owner_email_status;
  v_client_at := v_row.client_email_accepted_at;
  v_owner_at := v_row.owner_email_accepted_at;

  if v_row.client_email_delivery_id = p_delivery_id then
    v_stage := 'client_email';
    v_clear_lease := v_row.client_email_status = 'processing';
    v_client_status := case v_delivery.status when 'accepted' then 'accepted' else 'permanently_failed' end;
    v_client_at := case when v_delivery.status = 'accepted' then v_delivery.accepted_at else null end;
  elsif v_row.owner_email_delivery_id = p_delivery_id then
    v_stage := 'owner_email';
    v_clear_lease := v_row.owner_email_status = 'processing';
    v_owner_status := case v_delivery.status when 'accepted' then 'accepted' else 'permanently_failed' end;
    v_owner_at := case when v_delivery.status = 'accepted' then v_delivery.accepted_at else null end;
  else
    return false;
  end if;

  v_completed_at := case
    when v_row.pdf_status = 'complete'
      and v_client_status = 'accepted'
      and v_owner_status in ('accepted', 'not_required')
    then coalesce(v_row.completed_at, v_delivery.accepted_at, pg_catalog.clock_timestamp())
    else null
  end;

  update public.proposal_fulfilment
     set client_email_status = v_client_status,
         owner_email_status = v_owner_status,
         client_email_accepted_at = v_client_at,
         owner_email_accepted_at = v_owner_at,
         completed_at = v_completed_at,
         last_error_stage = case when v_delivery.status = 'permanently_failed' then v_stage else null end,
         last_error_code = case when v_delivery.status = 'permanently_failed'
           then coalesce(v_delivery.last_error_code, 'email_permanently_failed') else null end,
         last_error_message = case when v_delivery.status = 'permanently_failed'
           then coalesce(v_delivery.last_error_message, 'Email delivery permanently failed.') else null end,
         next_attempt_at = case when v_delivery.status = 'accepted'
           then pg_catalog.clock_timestamp() else v_row.next_attempt_at end,
         lease_token = case when v_clear_lease then null else v_row.lease_token end,
         lease_expires_at = case when v_clear_lease then null else v_row.lease_expires_at end
   where proposal_id = v_row.proposal_id;

  return true;
end;
$$;
revoke all on function public.sync_proposal_fulfilment_email(uuid)
  from public, anon, authenticated;
grant execute on function public.sync_proposal_fulfilment_email(uuid)
  to service_role;
comment on function public.sync_proposal_fulfilment_email(uuid) is
  'Service-role-only projection of terminal email-delivery state into proposal fulfilment.';

-- 6. Signing no longer provisions capucor.app.
drop function public.provision_from_signed_proposal(uuid, uuid, text);

comment on table public.proposal_fulfilment is
  'Service-role-only reconciliation state for signed proposals (pdf, client_email, owner_email); proposals.status remains the legal lifecycle.';

-- Final guard: nothing on the table may still name the portal stage.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'proposal_fulfilment'
       and column_name like 'portal%'
  ) or exists (
    select 1 from pg_constraint
     where conrelid = 'public.proposal_fulfilment'::regclass
       and pg_get_constraintdef(oid) like '%portal%'
  ) or to_regprocedure('public.provision_from_signed_proposal(uuid,uuid,text)') is not null then
    raise exception '001: a portal column, constraint or function survived; rolled back.';
  end if;
end $$;

commit;

-- ── VERIFY (read-only) ───────────────────────────────────────────────────────
--
-- select column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'proposal_fulfilment'
--  order by ordinal_position;
-- -- Expect no portal_* column.
--
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.proposal_fulfilment'::regclass and contype = 'c'
--  order by conname;
-- -- Expect no definition mentioning portal; last_error_stage_check lists
-- -- pdf, client_email, owner_email.
--
-- select to_regprocedure('public.provision_from_signed_proposal(uuid,uuid,text)') as gone,
--        has_function_privilege('anon', 'public.claim_proposal_fulfilment_stage(uuid,uuid,timestamptz)', 'execute') as anon_claim,
--        has_function_privilege('service_role', 'public.claim_proposal_fulfilment_stage(uuid,uuid,timestamptz)', 'execute') as svc_claim,
--        has_function_privilege('service_role', 'public.finish_proposal_fulfilment_stage(uuid,uuid,text,text,timestamptz,timestamptz,uuid,text,text)', 'execute') as svc_finish,
--        has_function_privilege('service_role', 'public.sync_proposal_fulfilment_email(uuid)', 'execute') as svc_sync;
-- -- Expect gone = null, anon_claim = false, the three svc_* = true.
--
-- select pdf_status, client_email_status, owner_email_status,
--        completed_at is not null as completed, count(*)
--   from public.proposal_fulfilment group by 1, 2, 3, 4 order by 1, 2, 3, 4;
-- -- Expect the pre-flight 2 totals; released rows show as not completed with
-- -- pdf pending/retry_scheduled until the next attempt.
--
-- ── ROLL BACK (only together with a code rollback) ─────────────────────────
-- Roll back ONLY if the Worker is also rolled back to its pre-phase-3 version
-- and capucor-os's reconciliation workflow is re-enabled; otherwise the new
-- code meets a portal stage it no longer knows. Every existing row is marked
-- portal-complete, so NOTHING is provisioned retroactively; only proposals
-- signed after the rollback are provisioned.
--
-- begin;
-- alter table public.proposal_fulfilment
--   drop constraint proposal_fulfilment_processing_lease_check,
--   drop constraint proposal_fulfilment_one_processing_stage_check,
--   drop constraint proposal_fulfilment_completed_check,
--   drop constraint proposal_fulfilment_last_error_stage_check;
-- alter table public.proposal_fulfilment
--   add column portal_status text not null default 'complete'
--     check (portal_status in ('pending', 'processing', 'retry_scheduled', 'complete', 'permanently_failed')),
--   add column portal_attempt_count integer not null default 0 check (portal_attempt_count >= 0),
--   add column portal_completed_at timestamptz;
-- update public.proposal_fulfilment set portal_completed_at = created_at;
-- alter table public.proposal_fulfilment alter column portal_status set default 'pending';
-- alter table public.proposal_fulfilment
--   add constraint proposal_fulfilment_processing_lease_check check (
--     lease_token is not null or (portal_status <> 'processing' and pdf_status <> 'processing'
--       and client_email_status <> 'processing' and owner_email_status <> 'processing')),
--   add constraint proposal_fulfilment_one_processing_stage_check check (
--     (portal_status = 'processing')::integer + (pdf_status = 'processing')::integer
--     + (client_email_status = 'processing')::integer + (owner_email_status = 'processing')::integer <= 1),
--   add constraint proposal_fulfilment_portal_complete_check check (
--     (portal_status = 'complete') = (portal_completed_at is not null)),
--   add constraint proposal_fulfilment_completed_check check (
--     (completed_at is not null) = (portal_status = 'complete' and pdf_status = 'complete'
--       and client_email_status = 'accepted' and owner_email_status in ('accepted', 'not_required'))),
--   add constraint proposal_fulfilment_last_error_stage_check check (
--     last_error_stage in ('portal', 'pdf', 'client_email', 'owner_email'));
-- -- Then paste, from 000_baseline_funnel.sql section 5, the pre-001 bodies of
-- -- claim_proposal_fulfilment_stage, finish_proposal_fulfilment_stage,
-- -- sync_proposal_fulfilment_email and provision_from_signed_proposal, each with
-- -- its revoke / grant / comment lines (from "-- claim_proposal_fulfilment_stage
-- -- — 021" down to the provision_from_signed_proposal comment). Do NOT paste
-- -- the file's first statement: it raises on purpose.
-- commit;
