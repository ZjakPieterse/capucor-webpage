-- ════════════════════════════════════════════════════════════════════════════
-- 000_baseline_funnel.sql — RECORD OF THE LIVE FUNNEL SCHEMA. ⛔ NEVER APPLY.
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⛔ DO NOT RUN THIS FILE. NOT IN THE SQL EDITOR, NOT WITH `supabase db push`,
-- NOT WITH `supabase db reset`, NOT IN PART. Every object below ALREADY EXISTS
-- in the live Supabase project. Running it would fail on the first
-- `create table` at best, and at worst (in part, or against a fresh project
-- mistaken for production) create a schema with no data, no seed rows and
-- portal dependencies that do not exist. It is documentation that happens to be
-- valid-looking SQL, so that a reader can diff a future migration against it.
--
-- WHAT IT IS. A consolidated, commented record of the END STATE of the sales-
-- funnel objects as at 2026-10-07, when capucor-webpage took ownership of the
-- funnel schema (web-standalone, phase 1). Until then the schema was written in
-- capucor-os/supabase/migrations/ (001–065). Those files are history now; this
-- file is the starting line. Every funnel migration from here on is written in
-- THIS repo's supabase/migrations/, numbered 001 upwards, and applied BY HAND
-- by Zjak in the Supabase SQL editor (see docs/database.md).
--
-- HOW IT WAS BUILT. There is no Docker on the dev box, so no `supabase db dump`.
-- It was consolidated by hand from every capucor-os migration that touches a
-- funnel object (listed per object below), replaying later ALTERs into the
-- original CREATE. Function bodies are copied VERBATIM from the last migration
-- that defined them. Every table column (name, type, nullability) was then
-- cross-checked against src/types/db.ts, which is generated from the live
-- database: no mismatch. What db.ts cannot see — CHECK constraints, defaults,
-- indexes, triggers, RLS policies, grants and non-exposed functions — rests on
-- the migration text alone. If you need certainty on one of those, query the
-- live catalogue (read-only) rather than trusting this file.
--
-- Migrations scanned for funnel objects: 001, 002, 003, 004, 005, 006, 007,
-- 008, 009a, 009b, 010, 011, 012, 013, 018, 019, 020, 021, 022, 023, 037, 062,
-- 065 (plus a full-text sweep of 001–065). 062 changes no funnel object (its
-- three CHECK repairs are on work_items / work_blockers). 014, 017, 024, 026,
-- 041, 052 and 057 only MENTION funnel objects in comments or seed portal
-- capability rows; they change none.
--
-- ── OUT OF SCOPE (portal-owned, stays in capucor-os until os-sunset) ─────────
--   client_orgs, client_org_members, subscriptions, invoices, entities and every
--   other portal table; internal_users and the staff-permission tables; the RLS
--   helpers is_org_member(), is_internal(), has_client_access(),
--   has_capability(); ensure_default_entity() / set_org_from_entity().
--   tier_inclusions (001) — references tiers/services but nothing in this repo
--   reads it.
--
-- ── ⚠️ CROSS-OWNER LINKS THAT STILL EXIST ────────────────────────────────────
--   * proposals.client_org_id → client_orgs(id). Written by
--     provision_from_signed_proposal until 001 dropped it (phase 3). Left
--     UNUSED (nullable, not dropped) until os-sunset.
--   * outbound_request_emails.delivery_id → email_deliveries(id) (OS 037). The
--     PORTAL also writes email_deliveries (staff request emails). Treat any
--     change to email_deliveries as a change capucor-os must survive.
--   * internal_select_proposals (below) calls the portal helpers is_internal()
--     and has_client_access().
--   * provision_from_signed_proposal wrote client_orgs, client_org_members and
--     subscriptions (the client_orgs insert fires OS 017's
--     ensure_default_entity() trigger). Dropped by 001.
--   * create_proposal_amendment / start_proposal_resend are called only by
--     capucor.app's staff amend/resend routes (removed in phase 4).
--
-- ── GRANTS: THE POSTURE IN ONE PARAGRAPH ─────────────────────────────────────
-- Tables created in 001/005/006/010 got Supabase's default table privileges
-- (anon, authenticated and service_role) and rely on RLS as the gate: RLS on,
-- and the only anon policies are the ones written below. 018 explicitly revoked
-- everything from public/anon/authenticated on email_deliveries and
-- proposal_fulfilment and granted DML to service_role only. Every funnel
-- function is `revoke all … from public, anon, authenticated` + `grant execute
-- … to service_role` (018 did this retroactively for the 010 trigger helpers),
-- which is why next_proposal_ref / proposals_set_ref / set_updated_at do not
-- appear in db.ts.

-- Tripwire: if anything ever executes this file, stop at the first statement.
-- (`supabase db push` would pick it up by its numeric prefix; this aborts it.)
do $$ begin
  raise exception '000_baseline_funnel.sql is a RECORD of the live schema. Never apply it.';
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. PRICING CONFIG — services, brackets, tiers, testimonials   (public read via anon)
-- ════════════════════════════════════════════════════════════════════════════

-- services — 001 (created), 002 (dropped base_price, scale_per_bracket).
-- Rows are dashboard-owned: no migration seeds them.
create table public.services (
  id                  uuid primary key default gen_random_uuid(),
  slug                text unique not null,
  name                text not null,
  description         text,
  bracket_unit_label  text not null,
  display_order       int not null default 0,
  active              boolean not null default true,
  created_at          timestamptz not null default now()
);

-- brackets — 001 (created), 002 (explicit per-tier prices; all rows replaced),
-- 065 (data only: payroll ladder re-issued at ordinal 1000+n, flat Basic price,
-- original 0–100 rows kept but active = false so open proposals still price).
-- ⚠️ PRICE CHANGES ARE NEW ROWS, NOT EDITS. Proposals store bracket ORDINALS
-- and lib/proposalPricing.ts re-prices from this table without filtering on
-- `active`. Editing a live row re-prices every unsigned proposal. See 065.
create table public.brackets (
  id              uuid primary key default gen_random_uuid(),
  service_slug    text not null references public.services(slug) on delete cascade,
  ordinal         int not null,
  label           text not null,
  is_enterprise   boolean not null default false,
  display_order   int not null default 0,
  active          boolean not null default true,
  basic_price     numeric(10,2) not null,
  pro_price       numeric(10,2) not null,
  premium_price   numeric(10,2) not null,
  unique (service_slug, ordinal)
);
create index on public.brackets (service_slug, ordinal);                -- 001

-- tiers — 001. Rows are dashboard-owned.
create table public.tiers (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  tagline         text,
  multiplier      numeric(5,2) not null,
  display_order   int not null default 0,
  active          boolean not null default true
);

alter table public.services enable row level security;                   -- 001
alter table public.brackets enable row level security;
alter table public.tiers    enable row level security;

-- ⚠️ anon ONLY. There is no `to authenticated` policy, so a cookie-bound client
-- for a signed-in user reads ZERO rows with no error. Use the anon client.
create policy "anon_select_services"
  on public.services for select to anon using (active = true);           -- 001
create policy "anon_select_brackets"
  on public.brackets for select to anon using (active = true);           -- 001
create policy "anon_select_tiers"
  on public.tiers for select to anon using (active = true);              -- 001

-- testimonials — 001, never altered since. Adopted 2026-10-07 (Zjak's decision,
-- after phase 1): capucor.com is its only reader (getPricingData.ts, anon
-- client); capucor.app stopped reading it, but capucor-os's nightly backup
-- still copies it until os-sunset. Rows are dashboard-owned; rows whose name or
-- quote starts with "[" are seed placeholders and are filtered out in code.
create table public.testimonials (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  role            text,
  business        text,
  quote           text not null,
  avatar_url      text,
  display_order   int not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index on public.testimonials (display_order) where active = true; -- 001
alter table public.testimonials enable row level security;               -- 001
create policy "anon_select_testimonials"
  on public.testimonials for select to anon using (active = true);       -- 001

-- ════════════════════════════════════════════════════════════════════════════
-- 2. LEADS AND POPIA REQUESTS   (anon insert only)
-- ════════════════════════════════════════════════════════════════════════════

-- leads — 001 (created), 003 (consent_version, consent_language),
-- 007 + 009a (leads_source_check widened twice; dropped and re-added by name).
create table public.leads (
  id                  uuid primary key default gen_random_uuid(),
  source              text not null,
  name                text not null,
  business            text,
  email               text not null,
  phone               text,
  message             text,
  config              jsonb,
  status              text not null default 'new',
  consent_given       boolean not null default false,
  consent_timestamp   timestamptz,
  created_at          timestamptz not null default now(),
  consent_version     text not null default 'v1',
  consent_language    text not null default 'en-ZA',
  constraint leads_source_check check (source in (
    'signup', 'quote', 'enterprise', 'contact', 'call', 'proposal', 'roi', 'lead_magnet'
  ))
);
create index on public.leads (created_at desc);                           -- 001
alter table public.leads enable row level security;
create policy "anon_insert_leads"
  on public.leads for insert to anon with check (true);                   -- 001

-- data_requests — 005. Unchanged since.
create table public.data_requests (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null,
  request_type        text not null check (request_type in ('access', 'delete')),
  status              text not null default 'pending_confirmation'
                        check (status in (
                          'pending_confirmation', 'confirmed', 'expired', 'processed'
                        )),
  token               text unique not null,
  token_expires_at    timestamptz not null,
  consent_version     text not null default 'v1',
  consent_language    text not null default 'en-ZA',
  ip_address          text,
  user_agent          text,
  confirmed_at        timestamptz,
  processed_at        timestamptz,
  notes               text,
  created_at          timestamptz not null default now()
);
create index on public.data_requests (email);                             -- 005
create index on public.data_requests (status);
create index on public.data_requests (created_at desc);
alter table public.data_requests enable row level security;
create policy "anon_insert_data_requests"
  on public.data_requests for insert to anon with check (true);           -- 005

-- ════════════════════════════════════════════════════════════════════════════
-- 3. PROPOSALS   (no anon access; service role only, plus a staff read policy)
-- ════════════════════════════════════════════════════════════════════════════

-- proposals — 006 (created), 008 (signature_method, signature_image),
-- 009b (addons), 010 (ref_number, version, supersedes_id, superseded_by_id;
-- status check re-created with 'superseded'), 012 (client_org_id),
-- 013 (sign_confirm_* and pending_signature_*), 011 + 023 (staff policy).
-- Columns are listed in the order they were added (live ordinal order).
create table public.proposals (
  id                    uuid primary key default gen_random_uuid(),
  token                 text unique not null,
  lead_id               uuid references public.leads(id) on delete set null,
  first_name            text not null,
  last_name             text not null,
  business_name         text not null,
  email                 text not null,
  services              text[] not null,
  brackets              jsonb not null,          -- { service_slug: ordinal }
  tier_slug             text not null,           -- plain text, no FK to tiers
  monthly_total_zar     numeric(12,2) not null,  -- server-recomputed, excl. VAT
  vat_zar               numeric(12,2) not null,
  total_charge_zar      numeric(12,2) not null,
  status                text not null default 'sent',
  consent_version       text not null default 'v1',
  consent_language      text not null default 'en-ZA',
  ip_address            text,
  user_agent            text,
  signed_at             timestamptz,
  signature_name        text,
  signature_ip          text,
  payment_provider      text,                    -- unused since 2026-06-17 billing model
  payment_ref           text,                    -- unused
  discount_pct          numeric(5,2),            -- unused
  proposal_pdf_drive_id text,
  sent_at               timestamptz not null default now(),
  viewed_at             timestamptz,
  signed_email_sent_at  timestamptz,
  expires_at            timestamptz,
  created_at            timestamptz not null default now(),
  -- 008
  signature_method      text check (signature_method in ('typed', 'drawn', 'uploaded')),
  signature_image       text,                    -- PNG data URL, inline
  -- 009b
  addons                jsonb not null default '[]'::jsonb,
  -- 010
  ref_number            text unique,             -- FT-YYYY-MM-NNNN; nullable (older rows)
  version               int not null default 1,
  supersedes_id         uuid references public.proposals(id) on delete set null,
  superseded_by_id      uuid references public.proposals(id) on delete set null,
  -- 012 ⚠️ points at the PORTAL-owned client_orgs table; see header.
  client_org_id         uuid references public.client_orgs(id) on delete set null,
  -- 013
  sign_confirm_token        text unique,
  sign_confirm_expires_at   timestamptz,
  pending_signature_name    text,
  pending_signature_method  text check (pending_signature_method in ('typed', 'drawn', 'uploaded')),
  pending_signature_image   text,
  pending_signature_ip      text,
  -- 010 (replaces 006's inline check of the same name)
  constraint proposals_status_check check (status in (
    'sent', 'viewed', 'signed', 'paid', 'active', 'expired', 'declined', 'superseded'
  ))
);
comment on column public.proposals.addons is
  'Optional add-on slugs (PRICING_ADDONS in src/config/tiers.ts), e.g. ["dext"]. Flat monthly fees excl. VAT, included in monthly_total_zar.';  -- 009b

create index on public.proposals (email);                                -- 006
create index on public.proposals (status);                               -- 006
create index on public.proposals (created_at desc);                      -- 006
create index if not exists proposals_ref_number_idx on public.proposals (ref_number);              -- 010
create index if not exists proposals_client_org_id_idx on public.proposals (client_org_id);        -- 012
create index if not exists proposals_sign_confirm_token_idx on public.proposals (sign_confirm_token); -- 013

alter table public.proposals enable row level security;                  -- 006: no anon policy
-- 011 created it as `using (public.is_internal(auth.uid()))`; 023 narrowed it.
-- Staff read on capucor.app. Null-tolerant on purpose: unsigned proposals have
-- no org. Becomes dead with the portal; drop it at os-sunset, not before.
create policy "internal_select_proposals"
  on public.proposals for select to authenticated
  using (
    public.is_internal(auth.uid())
    and (client_org_id is null or public.has_client_access(auth.uid(), client_org_id))
  );

-- ── Reference numbers — 010 (created), 018 (search_path pinned, grants) ────
create table public.proposal_ref_counters (
  period    text primary key,            -- 'YYYY-MM'
  last_seq  int not null default 0
);
alter table public.proposal_ref_counters enable row level security;      -- no policies

create or replace function public.next_proposal_ref()
returns text
language plpgsql
as $$
declare
  v_period text := to_char(now(), 'YYYY-MM');
  v_seq    int;
begin
  insert into public.proposal_ref_counters (period, last_seq)
    values (v_period, 1)
  on conflict (period)
    do update set last_seq = public.proposal_ref_counters.last_seq + 1
  returning last_seq into v_seq;

  return 'FT-' || v_period || '-' || lpad(v_seq::text, 4, '0');
end;
$$;
create or replace function public.proposals_set_ref()
returns trigger
language plpgsql
as $$
begin
  if new.ref_number is null then
    new.ref_number := public.next_proposal_ref();
  end if;
  return new;
end;
$$;
-- 018:
alter function public.next_proposal_ref() set search_path = '';
alter function public.proposals_set_ref() set search_path = '';
revoke all on function public.next_proposal_ref() from public, anon, authenticated;
revoke all on function public.proposals_set_ref() from public, anon, authenticated;
grant execute on function public.next_proposal_ref() to service_role;
grant execute on function public.proposals_set_ref() to service_role;

create trigger trg_proposals_set_ref
  before insert on public.proposals
  for each row execute function public.proposals_set_ref();              -- 010

-- ════════════════════════════════════════════════════════════════════════════
-- 4. DURABLE DELIVERY — email_deliveries, proposal_fulfilment   (018)
-- ════════════════════════════════════════════════════════════════════════════

-- set_updated_at() — 004 (portal migration), 018 (search_path, grants).
-- ⚠️ SHARED HELPER: portal tables use it too. Never drop or rename it from here.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
-- 018:
alter function public.set_updated_at() set search_path = '';
revoke all on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.set_updated_at() to service_role;

-- email_deliveries — 018. Unchanged since. ⚠️ Also written by capucor-os
-- (outbound_request_emails.delivery_id, OS 037). No subjects/bodies/tokens.
create table public.email_deliveries (
  id                    uuid primary key default gen_random_uuid(),
  source_type           text not null
                          check (source_type ~ '^[a-z][a-z0-9_]{0,49}$'),
  source_id             uuid not null,
  event_type            text not null
                          check (event_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  recipient             text not null
                          check (recipient = btrim(recipient)
                                 and char_length(recipient) between 3 and 320),
  idempotency_key       text not null unique
                          check (idempotency_key = btrim(idempotency_key)
                                 and char_length(idempotency_key) between 1 and 256),
  status                text not null default 'pending'
                          check (status in (
                            'pending',
                            'processing',
                            'retry_scheduled',
                            'accepted',
                            'permanently_failed'
                          )),
  attempt_count         integer not null default 0 check (attempt_count >= 0),
  next_attempt_at       timestamptz not null default now(),
  last_attempt_at       timestamptz,
  provider_id           text check (provider_id is null or provider_id = btrim(provider_id)),
  last_error_code       text,
  last_error_message    text,
  accepted_at           timestamptz,
  failed_at             timestamptz,
  lease_token           uuid,
  lease_expires_at      timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint email_deliveries_processing_lease_check check (
    (status = 'processing' and lease_token is not null and lease_expires_at is not null)
    or (status <> 'processing' and lease_token is null and lease_expires_at is null)
  ),
  constraint email_deliveries_accepted_check check (
    (status = 'accepted' and provider_id is not null and accepted_at is not null)
    or (status <> 'accepted' and provider_id is null and accepted_at is null)
  ),
  constraint email_deliveries_failed_check check (
    (status = 'permanently_failed') = (failed_at is not null)
  )
);

create unique index email_deliveries_provider_id_key
  on public.email_deliveries (provider_id)
  where provider_id is not null;

create index email_deliveries_source_event_idx
  on public.email_deliveries (source_type, source_id, event_type, created_at desc);

create index email_deliveries_due_idx
  on public.email_deliveries (next_attempt_at, created_at)
  where status in ('pending', 'retry_scheduled');

create index email_deliveries_expired_lease_idx
  on public.email_deliveries (lease_expires_at)
  where status = 'processing';

create trigger email_deliveries_updated_at
  before update on public.email_deliveries
  for each row execute function public.set_updated_at();

alter table public.email_deliveries enable row level security;
revoke all on table public.email_deliveries from public, anon, authenticated;
grant select, insert, update, delete on table public.email_deliveries to service_role;

comment on table public.email_deliveries is
  'Service-role-only email delivery metadata. Never store subjects, bodies, snippets or link tokens.';
comment on column public.email_deliveries.last_error_message is
  'Provider/transport diagnostic metadata only; never an email body, snippet or secret token.';

-- proposal_fulfilment — 018. ⚠️ 001 dropped the portal_* stage (portal_status,
-- portal_attempt_count, portal_completed_at and the checks that name them) and
-- re-created those checks without it; see 001 for the current definitions.
create table public.proposal_fulfilment (
  proposal_id                  uuid primary key references public.proposals(id),

  portal_status                text not null default 'pending'
                                 check (portal_status in (
                                   'pending', 'processing', 'retry_scheduled',
                                   'complete', 'permanently_failed'
                                 )),
  pdf_status                   text not null default 'pending'
                                 check (pdf_status in (
                                   'pending', 'processing', 'retry_scheduled',
                                   'complete', 'permanently_failed'
                                 )),
  client_email_status          text not null default 'pending'
                                 check (client_email_status in (
                                   'pending', 'processing', 'retry_scheduled',
                                   'accepted', 'permanently_failed'
                                 )),
  owner_email_status           text not null default 'pending'
                                 check (owner_email_status in (
                                   'pending', 'processing', 'retry_scheduled',
                                   'accepted', 'not_required', 'permanently_failed'
                                 )),

  portal_attempt_count         integer not null default 0 check (portal_attempt_count >= 0),
  pdf_attempt_count            integer not null default 0 check (pdf_attempt_count >= 0),
  client_email_attempt_count   integer not null default 0 check (client_email_attempt_count >= 0),
  owner_email_attempt_count    integer not null default 0 check (owner_email_attempt_count >= 0),

  client_email_delivery_id     uuid references public.email_deliveries(id),
  owner_email_delivery_id      uuid references public.email_deliveries(id),

  portal_completed_at          timestamptz,
  pdf_completed_at             timestamptz,
  client_email_accepted_at     timestamptz,
  owner_email_accepted_at      timestamptz,
  completed_at                 timestamptz,

  last_error_stage             text
                                 check (last_error_stage in (
                                   'portal', 'pdf', 'client_email', 'owner_email'
                                 )),
  last_error_code              text,
  last_error_message           text,
  next_attempt_at              timestamptz not null default now(),
  lease_token                  uuid,
  lease_expires_at             timestamptz,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),

  constraint proposal_fulfilment_lease_pair_check check (
    (lease_token is null) = (lease_expires_at is null)
  ),
  constraint proposal_fulfilment_processing_lease_check check (
    lease_token is not null
    or (
      portal_status <> 'processing'
      and pdf_status <> 'processing'
      and client_email_status <> 'processing'
      and owner_email_status <> 'processing'
    )
  ),
  constraint proposal_fulfilment_one_processing_stage_check check (
    (portal_status = 'processing')::integer
    + (pdf_status = 'processing')::integer
    + (client_email_status = 'processing')::integer
    + (owner_email_status = 'processing')::integer <= 1
  ),
  constraint proposal_fulfilment_portal_complete_check check (
    (portal_status = 'complete') = (portal_completed_at is not null)
  ),
  constraint proposal_fulfilment_pdf_complete_check check (
    (pdf_status = 'complete') = (pdf_completed_at is not null)
  ),
  constraint proposal_fulfilment_client_email_accepted_check check (
    (client_email_status = 'accepted'
      and client_email_delivery_id is not null
      and client_email_accepted_at is not null)
    or (client_email_status <> 'accepted' and client_email_accepted_at is null)
  ),
  constraint proposal_fulfilment_owner_email_accepted_check check (
    (owner_email_status = 'accepted'
      and owner_email_delivery_id is not null
      and owner_email_accepted_at is not null)
    or (owner_email_status <> 'accepted' and owner_email_accepted_at is null)
  ),
  constraint proposal_fulfilment_owner_email_not_required_check check (
    owner_email_status <> 'not_required' or owner_email_delivery_id is null
  ),
  constraint proposal_fulfilment_error_check check (
    (last_error_stage is null and last_error_code is null and last_error_message is null)
    or (last_error_stage is not null and last_error_code is not null and last_error_message is not null)
  ),
  constraint proposal_fulfilment_completed_check check (
    (completed_at is not null) = (
      portal_status = 'complete'
      and pdf_status = 'complete'
      and client_email_status = 'accepted'
      and owner_email_status in ('accepted', 'not_required')
    )
  ),
  constraint proposal_fulfilment_completed_lease_check check (
    completed_at is null or lease_token is null
  )
);

create index proposal_fulfilment_reconcile_idx
  on public.proposal_fulfilment (next_attempt_at, created_at)
  where completed_at is null;

create index proposal_fulfilment_expired_lease_idx
  on public.proposal_fulfilment (lease_expires_at)
  where lease_token is not null;

create trigger proposal_fulfilment_updated_at
  before update on public.proposal_fulfilment
  for each row execute function public.set_updated_at();

alter table public.proposal_fulfilment enable row level security;
revoke all on table public.proposal_fulfilment from public, anon, authenticated;
grant select, insert, update, delete on table public.proposal_fulfilment to service_role;

comment on table public.proposal_fulfilment is
  'Service-role-only reconciliation state for signed proposals; proposals.status remains the legal lifecycle.';
comment on column public.proposal_fulfilment.last_error_message is
  'Operational diagnostic metadata only; never an email/document body, snippet or secret token.';

-- ════════════════════════════════════════════════════════════════════════════
-- 5. SIGNING AND FULFILMENT RPCs   (service_role only)
-- ════════════════════════════════════════════════════════════════════════════

-- commit_proposal_signature — 021, re-created by 022 (ON CONFLICT names the
-- constraint; inference collided with the OUT column). Called by
-- /api/proposals/sign/confirm.
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

  update public.proposals
     set status = 'signed',
         signed_at = p_signed_at,
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
  'Service-role-only atomic signature commit and fulfilment-row creation. The confirmation token is consumed in the same transaction.';

-- claim_proposal_fulfilment_stage — 021. ⚠️ Re-created without the portal
-- stage by 001; this is the pre-001 body (001's rollback pastes it back).
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
    if v_row.portal_status = 'processing' then v_stage := 'portal';
    elsif v_row.pdf_status = 'processing' then v_stage := 'pdf';
    elsif v_row.client_email_status = 'processing' then v_stage := 'client_email';
    elsif v_row.owner_email_status = 'processing' then v_stage := 'owner_email';
    end if;
  elsif v_row.portal_status in ('pending', 'retry_scheduled') then
    v_stage := 'portal';
  elsif v_row.portal_status = 'complete'
    and v_row.pdf_status in ('pending', 'retry_scheduled') then
    v_stage := 'pdf';
  elsif v_row.portal_status = 'complete'
    and v_row.pdf_status = 'complete'
    and v_row.client_email_status in ('pending', 'retry_scheduled') then
    v_stage := 'client_email';
  elsif v_row.portal_status = 'complete'
    and v_row.pdf_status = 'complete'
    and v_row.client_email_status = 'accepted'
    and v_row.owner_email_status in ('pending', 'retry_scheduled') then
    v_stage := 'owner_email';
  end if;

  if v_stage is null then
    return;
  end if;

  if v_stage = 'portal' then
    v_attempt := v_row.portal_attempt_count + 1;
    update public.proposal_fulfilment
       set portal_status = 'processing', portal_attempt_count = v_attempt,
           lease_token = p_lease_token, lease_expires_at = p_lease_expires_at
     where proposal_fulfilment.proposal_id = p_proposal_id;
  elsif v_stage = 'pdf' then
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
  'Service-role-only CAS claim for the next dependency-ordered fulfilment stage.';

-- finish_proposal_fulfilment_stage — 021. ⚠️ Re-created by 001 without the
-- portal stage and with the 'proposal.signed_client' / 'proposal.signed_owner'
-- event types; this is the pre-001 body.
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
  v_portal_status text;
  v_pdf_status text;
  v_client_status text;
  v_owner_status text;
  v_portal_at timestamptz;
  v_pdf_at timestamptz;
  v_client_at timestamptz;
  v_owner_at timestamptz;
  v_client_delivery_id uuid;
  v_owner_delivery_id uuid;
  v_completed_at timestamptz;
begin
  if p_stage not in ('portal', 'pdf', 'client_email', 'owner_email')
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
  if (p_stage = 'portal' and v_row.portal_status <> 'processing')
     or (p_stage = 'pdf' and v_row.pdf_status <> 'processing')
     or (p_stage = 'client_email' and v_row.client_email_status <> 'processing')
     or (p_stage = 'owner_email' and v_row.owner_email_status <> 'processing') then
    return false;
  end if;

  v_portal_status := v_row.portal_status;
  v_pdf_status := v_row.pdf_status;
  v_client_status := v_row.client_email_status;
  v_owner_status := v_row.owner_email_status;
  v_portal_at := v_row.portal_completed_at;
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
    if (p_stage = 'client_email' and v_delivery.event_type <> 'proposal.portal_ready_client')
       or (p_stage = 'owner_email' and v_delivery.event_type <> 'proposal.provisioned_owner') then
      raise exception 'fulfilment_delivery_event_mismatch' using errcode = 'P0001';
    end if;
  end if;

  if p_stage = 'portal' then
    v_portal_status := case p_outcome
      when 'success' then 'complete'
      when 'retry_scheduled' then 'retry_scheduled'
      else 'permanently_failed' end;
    v_portal_at := case when p_outcome = 'success' then p_finished_at else null end;
  elsif p_stage = 'pdf' then
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
    when v_portal_status = 'complete'
      and v_pdf_status = 'complete'
      and v_client_status = 'accepted'
      and v_owner_status in ('accepted', 'not_required')
    then coalesce(v_row.completed_at, p_finished_at)
    else null
  end;

  update public.proposal_fulfilment
     set portal_status = v_portal_status,
         pdf_status = v_pdf_status,
         client_email_status = v_client_status,
         owner_email_status = v_owner_status,
         client_email_delivery_id = v_client_delivery_id,
         owner_email_delivery_id = v_owner_delivery_id,
         portal_completed_at = v_portal_at,
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
) is 'Service-role-only completion of one leased fulfilment stage.';

-- sync_proposal_fulfilment_email — 021. ⚠️ Re-created by 001 without the portal
-- stage; this is the pre-001 body. Called by the retry runner
-- (scripts/reconcile-deliveries.mjs since phase 3).
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
    when v_row.portal_status = 'complete'
      and v_row.pdf_status = 'complete'
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

-- provision_from_signed_proposal — 021, re-created by 022. ⚠️ DROPPED BY 001.
-- Wrote the portal-owned client_orgs, client_org_members and subscriptions, and
-- promoted the proposal to 'active'. Kept here as 001's rollback source.
create or replace function public.provision_from_signed_proposal(
  p_proposal_id uuid,
  p_user_id uuid,
  p_org_slug text
)
returns table (
  proposal_id uuid,
  org_id uuid,
  user_id uuid,
  membership_id uuid,
  subscription_id uuid,
  org_created boolean,
  membership_created boolean,
  subscription_created boolean,
  already_provisioned boolean
)
language plpgsql
set search_path = ''
as $$
declare
  v_proposal public.proposals%rowtype;
  v_org public.client_orgs%rowtype;
  v_membership public.client_org_members%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_slug_base text;
  v_slug text;
  v_suffix integer := 1;
  v_org_created boolean := false;
  v_membership_created boolean := false;
  v_subscription_created boolean := false;
  v_already_provisioned boolean := false;
begin
  select p.*
    into v_proposal
    from public.proposals p
   where p.id = p_proposal_id
   for update;

  if not found then
    raise exception 'proposal_not_found' using errcode = 'P0002';
  end if;
  if v_proposal.status not in ('signed', 'active') or v_proposal.signed_at is null then
    raise exception 'proposal_not_signed:%', v_proposal.status using errcode = 'P0001';
  end if;

  v_already_provisioned := v_proposal.status = 'active' and v_proposal.client_org_id is not null;

  -- Different proposals for the same organisation name must not create two
  -- organisations concurrently. The transaction-scoped advisory lock is
  -- independent of the proposal row lock and is released automatically.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(pg_catalog.lower(pg_catalog.btrim(v_proposal.business_name)), 0)
  );

  if v_proposal.client_org_id is not null then
    select o.*
      into v_org
      from public.client_orgs o
     where o.id = v_proposal.client_org_id
     for update;
  end if;

  if v_org.id is null then
    select o.*
      into v_org
      from public.client_orgs o
     where pg_catalog.lower(pg_catalog.btrim(o.display_name)) =
           pg_catalog.lower(pg_catalog.btrim(v_proposal.business_name))
     order by o.created_at asc, o.id asc
     limit 1
     for update;
  end if;

  if v_org.id is null then
    v_slug_base := pg_catalog.left(
      pg_catalog.btrim(
        pg_catalog.regexp_replace(
          pg_catalog.lower(pg_catalog.btrim(p_org_slug)), '[^a-z0-9]+', '-', 'g'
        ),
        '-'
      ),
      48
    );
    if v_slug_base is null or v_slug_base = '' then
      v_slug_base := 'client';
    end if;
    v_slug := v_slug_base;

    loop
      begin
        insert into public.client_orgs (
          display_name,
          slug,
          primary_contact_email,
          status
        ) values (
          pg_catalog.btrim(v_proposal.business_name),
          v_slug,
          pg_catalog.lower(pg_catalog.btrim(v_proposal.email)),
          'active'
        )
        returning * into v_org;
        v_org_created := true;
        exit;
      exception when unique_violation then
        v_suffix := v_suffix + 1;
        v_slug := pg_catalog.left(v_slug_base, 48 - pg_catalog.length(v_suffix::text) - 1)
          || '-' || v_suffix::text;
      end;
    end loop;
  end if;

  insert into public.client_org_members (client_org_id, user_id, role)
  values (v_org.id, p_user_id, 'owner')
  on conflict on constraint client_org_members_client_org_id_user_id_key do nothing
  returning * into v_membership;

  if v_membership.id is null then
    select m.*
      into v_membership
      from public.client_org_members m
     where m.client_org_id = v_org.id
       and m.user_id = p_user_id;
  else
    v_membership_created := true;
  end if;

  select s.*
    into v_subscription
    from public.subscriptions s
   where s.client_org_id = v_org.id
   order by s.created_at desc, s.id desc
   limit 1
   for update;

  if v_subscription.id is null then
    insert into public.subscriptions (
      client_org_id,
      email,
      full_name,
      business,
      services,
      brackets,
      tier_slug,
      monthly_total_zar,
      vat_zar,
      total_charge_zar,
      status,
      current_period_start,
      current_period_end
    ) values (
      v_org.id,
      pg_catalog.lower(pg_catalog.btrim(v_proposal.email)),
      pg_catalog.btrim(v_proposal.first_name || ' ' || v_proposal.last_name),
      pg_catalog.btrim(v_proposal.business_name),
      v_proposal.services,
      v_proposal.brackets,
      v_proposal.tier_slug,
      v_proposal.monthly_total_zar,
      v_proposal.vat_zar,
      v_proposal.total_charge_zar,
      'active',
      pg_catalog.date_trunc('month', v_proposal.signed_at) + interval '1 month',
      pg_catalog.date_trunc('month', v_proposal.signed_at) + interval '2 months'
    )
    returning * into v_subscription;
    v_subscription_created := true;
  else
    update public.subscriptions
       set email = pg_catalog.lower(pg_catalog.btrim(v_proposal.email)),
           full_name = pg_catalog.btrim(v_proposal.first_name || ' ' || v_proposal.last_name),
           business = pg_catalog.btrim(v_proposal.business_name),
           services = v_proposal.services,
           brackets = v_proposal.brackets,
           tier_slug = v_proposal.tier_slug,
           monthly_total_zar = v_proposal.monthly_total_zar,
           vat_zar = v_proposal.vat_zar,
           total_charge_zar = v_proposal.total_charge_zar,
           status = 'active'
     where id = v_subscription.id
     returning * into v_subscription;
  end if;

  -- Promotion is last and shares the transaction with every database invariant.
  update public.proposals
     set status = 'active',
         client_org_id = v_org.id
   where id = v_proposal.id;

  return query
    select v_proposal.id,
           v_org.id,
           p_user_id,
           v_membership.id,
           v_subscription.id,
           v_org_created,
           v_membership_created,
           v_subscription_created,
           v_already_provisioned;
end;
$$;
revoke all on function public.provision_from_signed_proposal(
  uuid, uuid, text
) from public, anon, authenticated;
grant execute on function public.provision_from_signed_proposal(
  uuid, uuid, text
) to service_role;
comment on function public.provision_from_signed_proposal(
  uuid, uuid, text
) is 'Service-role-only, re-entrant portal provisioning transaction. Supabase Auth user creation remains outside this transaction.';

-- ════════════════════════════════════════════════════════════════════════════
-- 6. STAFF-ONLY PROPOSAL RPCs ON FUNNEL TABLES   (capucor.app callers only)
-- ════════════════════════════════════════════════════════════════════════════
-- Not called by this repo. Recorded because they read and write `proposals`
-- and `email_deliveries` with `%rowtype`, so a column change here can break
-- them. Phase 4 removes their callers; drop them in a web migration after that.

-- create_proposal_amendment — 019. Unchanged since.
create or replace function public.create_proposal_amendment(
  p_original_id uuid,
  p_token text,
  p_first_name text,
  p_last_name text,
  p_business_name text,
  p_email text,
  p_services text[],
  p_brackets jsonb,
  p_tier_slug text,
  p_addons jsonb,
  p_monthly_total_zar numeric,
  p_vat_zar numeric,
  p_total_charge_zar numeric,
  p_sent_at timestamptz,
  p_expires_at timestamptz
)
returns table (
  proposal_id uuid,
  proposal_token text,
  proposal_ref_number text,
  proposal_version integer,
  proposal_first_name text,
  proposal_business_name text,
  proposal_email text,
  proposal_monthly_total_zar numeric,
  reused boolean
)
language plpgsql
set search_path = ''
as $$
declare
  v_original public.proposals%rowtype;
  v_revision public.proposals%rowtype;
  v_reused boolean := false;
begin
  select p.*
    into v_original
    from public.proposals p
   where p.id = p_original_id
   for update;

  if not found then
    raise exception 'proposal_not_found' using errcode = 'P0002';
  end if;

  if v_original.status = 'superseded' then
    select p.*
      into v_revision
      from public.proposals p
     where p.id = v_original.superseded_by_id;

    if not found then
      raise exception 'superseded_revision_missing' using errcode = 'P0001';
    end if;
    v_reused := true;
  else
    insert into public.proposals (
      token,
      lead_id,
      first_name,
      last_name,
      business_name,
      email,
      services,
      brackets,
      tier_slug,
      addons,
      monthly_total_zar,
      vat_zar,
      total_charge_zar,
      status,
      version,
      supersedes_id,
      consent_version,
      consent_language,
      sent_at,
      expires_at
    ) values (
      p_token,
      v_original.lead_id,
      coalesce(p_first_name, v_original.first_name),
      coalesce(p_last_name, v_original.last_name),
      coalesce(p_business_name, v_original.business_name),
      coalesce(p_email, v_original.email),
      p_services,
      p_brackets,
      p_tier_slug,
      p_addons,
      p_monthly_total_zar,
      p_vat_zar,
      p_total_charge_zar,
      'sent',
      v_original.version + 1,
      v_original.id,
      v_original.consent_version,
      v_original.consent_language,
      p_sent_at,
      p_expires_at
    )
    returning * into v_revision;

    update public.proposals
       set status = 'superseded',
           superseded_by_id = v_revision.id
     where id = v_original.id;
  end if;

  return query
    select v_revision.id,
           v_revision.token,
           v_revision.ref_number,
           v_revision.version,
           v_revision.first_name,
           v_revision.business_name,
           v_revision.email,
           v_revision.monthly_total_zar,
           v_reused;
end;
$$;
-- (019: revoke all from public/anon/authenticated; grant execute to service_role.)

-- start_proposal_resend — 020. Unchanged since.
create or replace function public.start_proposal_resend(
  p_proposal_id uuid,
  p_token text,
  p_sent_at timestamptz,
  p_expires_at timestamptz
)
returns table (
  proposal_id uuid,
  proposal_token text,
  proposal_ref_number text,
  proposal_first_name text,
  proposal_business_name text,
  proposal_email text,
  proposal_monthly_total_zar numeric,
  delivery_id uuid,
  delivery_idempotency_key text,
  reused boolean
)
language plpgsql
set search_path = ''
as $$
declare
  v_proposal public.proposals%rowtype;
  v_delivery public.email_deliveries%rowtype;
  v_delivery_id uuid;
  v_idempotency_key text;
  v_reused boolean := false;
begin
  select p.*
    into v_proposal
    from public.proposals p
   where p.id = p_proposal_id
   for update;

  if not found then
    raise exception 'proposal_not_found' using errcode = 'P0002';
  end if;

  if v_proposal.status not in ('sent', 'viewed', 'expired') then
    raise exception 'proposal_not_resendable:%', v_proposal.status using errcode = 'P0001';
  end if;

  select d.*
    into v_delivery
    from public.email_deliveries d
   where d.source_type = 'proposal'
     and d.source_id = v_proposal.id
     and d.event_type = 'proposal.resent_client'
     and d.recipient = lower(btrim(v_proposal.email))
     and d.status in ('pending', 'processing', 'retry_scheduled')
   order by d.created_at desc
   limit 1;

  if found then
    v_reused := true;
  else
    update public.proposals
       set token = p_token,
           status = 'sent',
           sent_at = p_sent_at,
           viewed_at = null,
           expires_at = p_expires_at
     where id = v_proposal.id
     returning * into v_proposal;

    v_delivery_id := gen_random_uuid();
    v_idempotency_key := 'capucor_os_proposal_resent_client_'
      || v_proposal.id::text || '_'
      || floor(extract(epoch from p_sent_at) * 1000)::bigint::text;

    insert into public.email_deliveries (
      id,
      source_type,
      source_id,
      event_type,
      recipient,
      idempotency_key,
      status,
      attempt_count,
      next_attempt_at
    ) values (
      v_delivery_id,
      'proposal',
      v_proposal.id,
      'proposal.resent_client',
      lower(btrim(v_proposal.email)),
      v_idempotency_key,
      'pending',
      0,
      p_sent_at
    )
    returning * into v_delivery;
  end if;

  return query
    select v_proposal.id,
           v_proposal.token,
           v_proposal.ref_number,
           v_proposal.first_name,
           v_proposal.business_name,
           v_proposal.email,
           v_proposal.monthly_total_zar,
           v_delivery.id,
           v_delivery.idempotency_key,
           v_reused;
end;
$$;
-- (020: revoke all from public/anon/authenticated; grant execute to service_role.)

-- ════════════════════════════════════════════════════════════════════════════
-- END OF RECORD. ⛔ NEVER APPLY THIS FILE. New funnel migrations start at 001.
-- ════════════════════════════════════════════════════════════════════════════
