-- ─── Migration 006: Proposals (Ignition-style activation) ────────────────────
-- When a visitor finishes the pricing calculator and clicks "Activate", we no
-- longer send them to a payment page. Instead we capture light contact details
-- (first name, surname, business, email) and generate a PROPOSAL from the
-- selected package. The proposal is emailed to the client (to review + sign)
-- and copied to a central Capucor inbox for reference.
--
-- Each row holds:
--   * the contact + the priced calculator selection (services / brackets / tier)
--   * totals recomputed server-side (anti-tamper) — never trust the client price
--   * an opaque magic-link token (32 random bytes, base64url) that the client
--     clicks from the email to open /proposal/<token>
--   * lifecycle timestamps (sent → viewed → signed → paid → active)
--   * Phase-2 columns (signature + payment) left nullable until the e-sign +
--     payment provider is wired
--
-- RLS:
--   * No anon policies at all. The token-gated read on /proposal/<token> and all
--     writes go through the service-role admin client (src/lib/supabase/admin.ts),
--     mirroring public.data_requests in 005.

create table public.proposals (
  id                    uuid primary key default gen_random_uuid(),
  token                 text unique not null,
  lead_id               uuid references public.leads(id) on delete set null,

  -- Contact captured in the Activate modal
  first_name            text not null,
  last_name             text not null,
  business_name         text not null,
  email                 text not null,

  -- Priced calculator selection (config only; prices come from the DB)
  services              text[] not null,
  brackets              jsonb not null,
  tier_slug             text not null,

  -- Server-recomputed totals (ZAR)
  monthly_total_zar     numeric(12,2) not null,
  vat_zar               numeric(12,2) not null,
  total_charge_zar      numeric(12,2) not null,

  status                text not null default 'sent'
                          check (status in (
                            'sent',
                            'viewed',
                            'signed',
                            'paid',
                            'active',
                            'expired',
                            'declined'
                          )),

  consent_version       text not null default 'v1',
  consent_language      text not null default 'en-ZA',
  ip_address            text,
  user_agent            text,

  -- Phase 2 — e-signature (nullable until the sign step ships)
  signed_at             timestamptz,
  signature_name        text,
  signature_ip          text,

  -- Phase 2 — payment-for-discount (nullable until the provider is chosen)
  payment_provider      text,
  payment_ref           text,
  discount_pct          numeric(5,2),

  -- Phase 2 — archived PDF in the client's Google Drive folder
  proposal_pdf_drive_id text,

  sent_at               timestamptz not null default now(),
  viewed_at             timestamptz,
  signed_email_sent_at  timestamptz,
  expires_at            timestamptz,
  created_at            timestamptz not null default now()
);

create index on public.proposals (email);
create index on public.proposals (status);
create index on public.proposals (created_at desc);

alter table public.proposals enable row level security;
-- No anon policies. Reads (token-gated) and writes go through the admin client.
