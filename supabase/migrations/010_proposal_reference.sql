-- ─── Migration 010: Proposal reference numbers + living-document tracking ────
-- Adds the human-readable reference number the owner quotes over the phone and
-- the columns that let a proposal be amended/re-sent while keeping an audit
-- trail. The opaque `token` (006) stays the secret URL key; `ref_number` is the
-- display/tracking handle.
--
-- Reference format: FT-YYYY-MM-NNNN  (FT = "Financial Team")
--   e.g. FT-2026-06-0042 — sequence runs per calendar month, zero-padded to 4.
--
-- The sequence is kept in a small counter table keyed by 'YYYY-MM'. The upsert
-- in next_proposal_ref() takes a row lock on that period, so two proposals
-- created in the same instant still get distinct numbers (no race).
--
-- RLS: same posture as proposals (006) — no anon policies; the counter table is
-- only ever touched by the before-insert trigger, which runs under the
-- service-role admin client used for all proposal writes.

-- ── Columns on proposals ─────────────────────────────────────────────────────
alter table public.proposals
  add column if not exists ref_number      text unique,
  add column if not exists version         int not null default 1,
  add column if not exists supersedes_id   uuid references public.proposals(id) on delete set null,
  add column if not exists superseded_by_id uuid references public.proposals(id) on delete set null;

-- Allow the 'superseded' lifecycle state (an amended proposal replaces an older
-- one, which is marked superseded). Drop + recreate the inline CHECK from 006.
alter table public.proposals drop constraint if exists proposals_status_check;
alter table public.proposals
  add constraint proposals_status_check check (status in (
    'sent',
    'viewed',
    'signed',
    'paid',
    'active',
    'expired',
    'declined',
    'superseded'
  ));

-- ── Per-month reference counter ──────────────────────────────────────────────
create table if not exists public.proposal_ref_counters (
  period    text primary key,            -- 'YYYY-MM'
  last_seq  int not null default 0
);

alter table public.proposal_ref_counters enable row level security;
-- No policies: only the service-role trigger writes here.

-- Atomically claim the next sequence for the current month and format the ref.
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

-- Assign a ref on insert when one wasn't supplied.
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

drop trigger if exists trg_proposals_set_ref on public.proposals;
create trigger trg_proposals_set_ref
  before insert on public.proposals
  for each row execute function public.proposals_set_ref();

create index if not exists proposals_ref_number_idx on public.proposals (ref_number);
