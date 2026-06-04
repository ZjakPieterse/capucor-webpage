-- ─── Migration 008: Proposal e-signature columns (PR7) ───────────────────────
-- The /proposal/<token> page now lets a client accept their proposal by signing
-- electronically — typed, drawn, or by uploading an image of their signature.
-- All three are normalised client-side to a single PNG data URL.
--
-- 006 already added signed_at / signature_name / signature_ip. This adds:
--   * signature_method — how the signature was produced (typed | drawn | uploaded)
--   * signature_image  — the normalised PNG as a data URL. Stored inline rather
--                        than in Supabase Storage: the asset is small (a 600px
--                        line-art PNG, capped server-side) and inline storage
--                        avoids a bucket + RLS policies + multipart handling for
--                        what amounts to one image per proposal.
--
-- RLS unchanged — no anon policies. The sign endpoint (/api/proposals/sign) reads
-- and writes through the service-role admin client, like every other proposal write.

alter table public.proposals
  add column if not exists signature_method text
    check (signature_method in ('typed', 'drawn', 'uploaded')),
  add column if not exists signature_image text;
