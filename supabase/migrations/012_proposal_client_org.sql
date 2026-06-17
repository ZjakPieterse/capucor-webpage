-- ─── Migration 012: Link a proposal to the org it provisioned (PR9) ──────────
-- When a proposal is signed, /api/proposals/sign now auto-provisions the portal
-- records (client_orgs + client_org_members + a subscriptions row) and flips the
-- proposal to 'active' (the signed proposal is the debit-order mandate — billing
-- itself is collected manually via Paysoft Flow off Xero, so no payment API is
-- called here; see the project_billing_model_xero note).
--
-- This adds the FK back from the proposal to the org it created/located, so:
--   * provisioning is idempotent — a re-run reuses the linked org instead of
--     creating a duplicate;
--   * later work (e.g. the /internal client view's proposals tab, currently
--     matched by contact email) can move to a real FK join.
--
-- Nullable on purpose: every existing proposal predates provisioning, and a
-- proposal only gains an org once it is signed + provisioned. on delete set null
-- mirrors subscriptions/invoices in 004 — deleting an org never cascades into the
-- proposal audit trail.
--
-- RLS unchanged — no anon policies. The sign route reads/writes proposals through
-- the service-role admin client, as established in 006.

alter table public.proposals
  add column if not exists client_org_id uuid references public.client_orgs(id) on delete set null;

create index if not exists proposals_client_org_id_idx on public.proposals (client_org_id);
