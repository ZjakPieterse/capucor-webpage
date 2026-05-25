-- ─── Migration 005: POPIA data-subject requests (P1) ─────────────────────────
-- Records access / deletion requests submitted from /privacy. Each row holds:
--   * the requester's email + request type
--   * an opaque magic-link token (32 random bytes, base64url-encoded) that the
--     user clicks via email to prove control of the address
--   * lifecycle timestamps so we can prove SLA compliance later
--
-- RLS:
--   * Anonymous visitors can INSERT (mirrors public.leads policy in 001).
--   * No SELECT / UPDATE / DELETE policies — confirm + processing happens via
--     the service-role admin client in src/lib/supabase/admin.ts.

create table public.data_requests (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null,
  request_type        text not null check (request_type in ('access', 'delete')),
  status              text not null default 'pending_confirmation'
                        check (status in (
                          'pending_confirmation',
                          'confirmed',
                          'expired',
                          'processed'
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

create index on public.data_requests (email);
create index on public.data_requests (status);
create index on public.data_requests (created_at desc);

alter table public.data_requests enable row level security;

create policy "anon_insert_data_requests"
  on public.data_requests for insert to anon with check (true);
