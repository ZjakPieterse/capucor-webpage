-- ─── Migration 004: Portal foundation schema (F5) ─────────────────────────────
-- Adds the 8 tables the client portal will be built on top of:
--   client_orgs            — one row per onboarded business (master record)
--   client_org_members     — auth.users ↔ client_orgs (multi-user ready, v1 single)
--   subscriptions          — pricing-calculator subscriptions + Paystack refs
--   invoices               — recurring billing history (driven by Paystack webhook)
--   karbon_tasks_cache     — synced open work items per client (Phase C/K2)
--   xero_snapshot_cache    — daily Xero metric snapshot per client (Phase D/X4)
--   shop_products          — once-off SKU catalogue (Phase B/B2)
--   shop_orders            — once-off shop purchases (Phase B/B4)
--
-- RLS model:
--   * All tables RLS-enabled.
--   * Authenticated users can SELECT rows belonging to a client_org they are a
--     member of (via the public.is_org_member() SECURITY DEFINER helper).
--   * Writes are service-role-only — no INSERT/UPDATE/DELETE policies for
--     anon/authenticated. All mutations go through src/lib/supabase/admin.ts (F6).
--   * shop_products is the one exception: any authenticated user can read the
--     active catalogue.

-- ─── Helper: updated_at touch trigger ─────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- The is_org_member() RLS helper is defined further down, AFTER the tables it
-- references — language-sql function bodies are validated at CREATE time, so
-- it cannot be declared up here before client_org_members exists.

-- ─── 1. client_orgs ───────────────────────────────────────────────────────────

create table public.client_orgs (
  id                            uuid primary key default gen_random_uuid(),
  name                          text not null,
  slug                          text unique not null,
  primary_contact_email         text not null,
  business_reg_no               text,
  status                        text not null default 'active'
                                  check (status in ('active', 'paused', 'cancelled')),
  -- Phase E (Drive integration)
  drive_folder_id               text,
  drive_folder_url              text,
  -- Phase C (Karbon integration)
  karbon_client_id              text,
  -- Phase D (Xero integration) — refresh token stored encrypted via app layer
  xero_tenant_id                text,
  xero_refresh_token_encrypted  text,
  xero_connected_at             timestamptz,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create trigger client_orgs_updated_at
  before update on public.client_orgs
  for each row execute function public.set_updated_at();

-- ─── 2. client_org_members ────────────────────────────────────────────────────

create table public.client_org_members (
  id              uuid primary key default gen_random_uuid(),
  client_org_id   uuid not null references public.client_orgs(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null default 'owner'
                    check (role in ('owner', 'member')),
  created_at      timestamptz not null default now(),
  unique (client_org_id, user_id)
);

create index on public.client_org_members (user_id);
create index on public.client_org_members (client_org_id);

-- ─── 3. subscriptions ─────────────────────────────────────────────────────────
-- Column shape matches the TODO in src/app/api/subscriptions/route.ts lines 117-122.
-- client_org_id is nullable so a pending subscription can exist before the
-- onboarding flow has provisioned the org (B6).

create table public.subscriptions (
  id                          uuid primary key default gen_random_uuid(),
  client_org_id               uuid references public.client_orgs(id) on delete set null,
  email                       text not null,
  full_name                   text not null,
  business                    text,
  services                    text[] not null,
  brackets                    jsonb not null,
  tier_slug                   text not null,
  monthly_total_zar           numeric(10,2) not null,
  vat_zar                     numeric(10,2) not null,
  total_charge_zar            numeric(10,2) not null,
  status                      text not null default 'pending_payment'
                                check (status in ('pending_payment', 'active', 'past_due', 'cancelled')),
  paystack_customer_code      text,
  paystack_subscription_code  text,
  paystack_authorization_url  text,
  paystack_reference          text,
  current_period_start        timestamptz,
  current_period_end          timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index on public.subscriptions (client_org_id);
create index on public.subscriptions (status);
create index on public.subscriptions (paystack_reference);

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ─── 4. invoices ──────────────────────────────────────────────────────────────

create table public.invoices (
  id                  uuid primary key default gen_random_uuid(),
  subscription_id     uuid not null references public.subscriptions(id) on delete cascade,
  client_org_id       uuid references public.client_orgs(id) on delete set null,
  paystack_reference  text unique,
  amount_zar          numeric(10,2) not null,
  period_start        date,
  period_end          date,
  status              text not null default 'pending'
                        check (status in ('pending', 'paid', 'failed', 'refunded')),
  paid_at             timestamptz,
  created_at          timestamptz not null default now()
);

create index on public.invoices (subscription_id);
create index on public.invoices (client_org_id);
create index on public.invoices (status);

-- ─── 5. karbon_tasks_cache ────────────────────────────────────────────────────

create table public.karbon_tasks_cache (
  id                    uuid primary key default gen_random_uuid(),
  client_org_id         uuid not null references public.client_orgs(id) on delete cascade,
  karbon_work_item_id   text not null,
  title                 text not null,
  status                text,
  due_date              date,
  assignee              text,
  deep_link_url         text,
  raw_payload           jsonb,
  synced_at             timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  unique (client_org_id, karbon_work_item_id)
);

create index on public.karbon_tasks_cache (client_org_id, due_date);

-- ─── 6. xero_snapshot_cache ───────────────────────────────────────────────────
-- One row per client_org (latest snapshot). Daily cron upserts.

create table public.xero_snapshot_cache (
  client_org_id   uuid primary key references public.client_orgs(id) on delete cascade,
  snapshot        jsonb not null,
  as_of_date      date not null,
  synced_at       timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger xero_snapshot_cache_updated_at
  before update on public.xero_snapshot_cache
  for each row execute function public.set_updated_at();

-- ─── 7. shop_products ─────────────────────────────────────────────────────────

create table public.shop_products (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  name            text not null,
  description     text,
  price_zar       numeric(10,2) not null,
  active          boolean not null default true,
  display_order   int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index on public.shop_products (display_order) where active = true;

create trigger shop_products_updated_at
  before update on public.shop_products
  for each row execute function public.set_updated_at();

-- ─── 8. shop_orders ───────────────────────────────────────────────────────────

create table public.shop_orders (
  id                  uuid primary key default gen_random_uuid(),
  client_org_id       uuid not null references public.client_orgs(id) on delete cascade,
  product_id          uuid not null references public.shop_products(id),
  paystack_reference  text unique,
  amount_zar          numeric(10,2) not null,
  status              text not null default 'pending'
                        check (status in ('pending', 'paid', 'failed', 'refunded')),
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index on public.shop_orders (client_org_id);
create index on public.shop_orders (status);

create trigger shop_orders_updated_at
  before update on public.shop_orders
  for each row execute function public.set_updated_at();

-- ─── Helper: org-membership predicate (used in RLS) ──────────────────────────
-- SECURITY DEFINER so policies on client_org_members don't recurse into
-- themselves when evaluating membership for sibling tables.

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.client_org_members m
    where m.client_org_id = org_id
      and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
grant execute on function public.is_org_member(uuid) to anon, authenticated;

-- ─── Row-Level Security ───────────────────────────────────────────────────────

alter table public.client_orgs           enable row level security;
alter table public.client_org_members    enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.invoices              enable row level security;
alter table public.karbon_tasks_cache    enable row level security;
alter table public.xero_snapshot_cache   enable row level security;
alter table public.shop_products         enable row level security;
alter table public.shop_orders           enable row level security;

-- client_orgs: members can read their own org row.
create policy "members_select_own_org"
  on public.client_orgs for select to authenticated
  using (public.is_org_member(id));

-- client_org_members: a user can see membership rows for orgs they belong to
-- (so the UI can list teammates in v2). Their own row is included.
create policy "members_select_own_memberships"
  on public.client_org_members for select to authenticated
  using (public.is_org_member(client_org_id));

-- subscriptions: members can read subscriptions linked to their org.
create policy "members_select_org_subscriptions"
  on public.subscriptions for select to authenticated
  using (
    client_org_id is not null
    and public.is_org_member(client_org_id)
  );

-- invoices: members can read invoices linked to their org.
create policy "members_select_org_invoices"
  on public.invoices for select to authenticated
  using (
    client_org_id is not null
    and public.is_org_member(client_org_id)
  );

-- karbon_tasks_cache: members can read tasks for their org.
create policy "members_select_org_karbon_tasks"
  on public.karbon_tasks_cache for select to authenticated
  using (public.is_org_member(client_org_id));

-- xero_snapshot_cache: members can read the snapshot for their org.
create policy "members_select_org_xero_snapshot"
  on public.xero_snapshot_cache for select to authenticated
  using (public.is_org_member(client_org_id));

-- shop_products: any authenticated user can read the active catalogue.
create policy "authenticated_select_active_products"
  on public.shop_products for select to authenticated
  using (active = true);

-- shop_orders: members can read orders placed by their org.
create policy "members_select_org_shop_orders"
  on public.shop_orders for select to authenticated
  using (public.is_org_member(client_org_id));

-- NOTE: no INSERT / UPDATE / DELETE policies are defined for any of these
-- tables. All writes happen via the service-role client in
-- src/lib/supabase/admin.ts (F6), which bypasses RLS.
