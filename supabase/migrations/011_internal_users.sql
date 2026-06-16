-- ─── Migration 011: Internal-user platform foundation (PR13a) ────────────────
-- Grows the secret-gated /internal/proposals tracker into the foundation of an
-- internal (staff) tier on the existing client portal. Internal users sign in
-- via the SAME Supabase Auth as clients (Google / magic-link) — there is no
-- separate auth system. They become "internal" purely by being on the email
-- allowlist below.
--
-- Two roles:
--   * admin — full access (amend / resend / future writes)
--   * basic — view-only
--
-- Two RLS helpers (mirroring public.is_org_member() from 004):
--   * is_internal(uid)        — true for any allowlisted user → gates the
--                               view-only SELECT policies + the /internal hub.
--   * is_internal_admin(uid)  — true only for role='admin' → gates every
--                               mutation (writes stay service-role + an app-side
--                               is_internal_admin check; no write RLS policies).
--
-- ── Why the table is keyed by EMAIL, not a user_id FK ────────────────────────
-- An email allowlist must support PRE-registration: you add a colleague's email
-- before they have ever signed in, so no auth.users row exists yet to FK to. We
-- therefore key on the lowercased email and connect to auth.users INSIDE the
-- SECURITY DEFINER helpers (join auth.users on the uid, match its email against
-- this allowlist). Registration = inserting a row here; the row "activates" the
-- moment that person signs in with the matching email.
--
-- RLS posture: internal_users itself has RLS on with NO policies — it is only
-- ever read by the SECURITY DEFINER helpers (which bypass RLS) and by the
-- service-role admin client. The view-only policies added to the client-facing
-- tables are ADDITIVE: they OR with the existing is_org_member() member policies,
-- so a normal client is unaffected and an internal user can read everything.

-- ── 1. internal_users allowlist ──────────────────────────────────────────────

create table public.internal_users (
  email       text primary key check (email = lower(email)),
  role        text not null default 'basic' check (role in ('admin', 'basic')),
  full_name   text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger internal_users_updated_at
  before update on public.internal_users
  for each row execute function public.set_updated_at();

alter table public.internal_users enable row level security;
-- No policies: only the SECURITY DEFINER helpers + the service-role admin client
-- ever touch this table.

-- ── 2. Helpers ───────────────────────────────────────────────────────────────
-- SECURITY DEFINER (owner = postgres) so they can read auth.users and so the
-- policies on client-facing tables don't recurse. STABLE + an auth.uid() arg
-- means Postgres evaluates them once per statement, not once per row.

create or replace function public.is_internal(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.internal_users iu
      on lower(u.email) = iu.email
    where u.id = uid
      and iu.active
  );
$$;

create or replace function public.is_internal_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.internal_users iu
      on lower(u.email) = iu.email
    where u.id = uid
      and iu.active
      and iu.role = 'admin'
  );
$$;

revoke all on function public.is_internal(uuid) from public;
revoke all on function public.is_internal_admin(uuid) from public;
grant execute on function public.is_internal(uuid) to anon, authenticated;
grant execute on function public.is_internal_admin(uuid) to anon, authenticated;

-- ── 3. Additive view-only SELECT policies for internal users ─────────────────
-- One per client-facing table, gated on is_internal(auth.uid()). Additive to the
-- existing member policies (004). No INSERT/UPDATE/DELETE — internal writes stay
-- service-role + an is_internal_admin app check (later phases).

create policy "internal_select_client_orgs"
  on public.client_orgs for select to authenticated
  using (public.is_internal(auth.uid()));

create policy "internal_select_client_org_members"
  on public.client_org_members for select to authenticated
  using (public.is_internal(auth.uid()));

create policy "internal_select_subscriptions"
  on public.subscriptions for select to authenticated
  using (public.is_internal(auth.uid()));

create policy "internal_select_invoices"
  on public.invoices for select to authenticated
  using (public.is_internal(auth.uid()));

create policy "internal_select_karbon_tasks"
  on public.karbon_tasks_cache for select to authenticated
  using (public.is_internal(auth.uid()));

create policy "internal_select_xero_snapshot"
  on public.xero_snapshot_cache for select to authenticated
  using (public.is_internal(auth.uid()));

create policy "internal_select_shop_orders"
  on public.shop_orders for select to authenticated
  using (public.is_internal(auth.uid()));

-- proposals (006) has no anon/authenticated policies — it is token-gated via the
-- admin client. Add an internal-only SELECT so the proposals hub can move to a
-- session-bound read later; clients still cannot read proposals.
create policy "internal_select_proposals"
  on public.proposals for select to authenticated
  using (public.is_internal(auth.uid()));

-- ── 4. Seed the first internal admin ─────────────────────────────────────────

insert into public.internal_users (email, role, full_name)
  values ('zjak@capucor.com', 'admin', 'Zjak')
on conflict (email) do nothing;
