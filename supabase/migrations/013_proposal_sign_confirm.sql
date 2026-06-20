-- ─── Migration 013: Email-bound sign confirmation ────────────────────────────
-- Signing a proposal is the debit-order mandate, so it must be tied to the
-- person who controls the address the proposal was sent to — not just to anyone
-- the /proposal/<token> link was forwarded to. We make signing two steps:
--
--   Step A (POST /api/proposals/sign): the form posts the signature, which we
--     stash in the `pending_signature_*` columns and mint a one-time
--     `sign_confirm_token`. The status stays `viewed` — nothing is committed yet.
--     A "Confirm & sign" link (…/proposal/confirm/<token>) is emailed to the
--     proposal's own address.
--   Step B (POST /api/proposals/sign/confirm): clicking that link from the inbox
--     and confirming promotes the pending signature into the real signature
--     columns, flips status to `signed`, and provisions the portal. The confirm
--     token is single-use (cleared on commit) with a 30-minute expiry.
--
-- RLS unchanged — no anon policies. All reads/writes still go through the
-- service-role admin client, like every other proposal column.

alter table public.proposals
  add column if not exists sign_confirm_token       text unique,
  add column if not exists sign_confirm_expires_at  timestamptz,
  add column if not exists pending_signature_name   text,
  add column if not exists pending_signature_method text
    check (pending_signature_method in ('typed', 'drawn', 'uploaded')),
  add column if not exists pending_signature_image  text,
  add column if not exists pending_signature_ip     text;

create index if not exists proposals_sign_confirm_token_idx
  on public.proposals (sign_confirm_token);
