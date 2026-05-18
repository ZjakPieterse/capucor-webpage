-- ─── Migration 003: Consent version + language on leads ──────────────────────
-- POPIA P2: record which version of the consent text and which language the
-- user agreed to, per row. Defaults match the constants in
-- src/lib/consent.ts (CONSENT_VERSION='v1', CONSENT_LANGUAGE='en-ZA').

alter table public.leads
  add column consent_version  text not null default 'v1',
  add column consent_language text not null default 'en-ZA';
