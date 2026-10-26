import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/db';
import { createSupabaseAnonClient } from '@/lib/supabase/anon';
import { priceProposalSelection } from '@/lib/proposalPricing';
import { buildSignedProposalPdfPayload } from '@/lib/portal/proposalPdfPayload';
import { addonSlugsFromStored, bracketMapFromStored } from '@/lib/portal/proposalJson';
import { logError } from '@/lib/log';
import { driveFileUrl } from '@/lib/email/messages.mjs';
import type { Bracket, Service } from '@/types';

/**
 * PR10 — archive a SIGNED proposal as a PDF in the firm's Shared Drive.
 *
 * The signed proposal is the engagement letter (and debit-order authorisation), so we keep a durable PDF
 * of exactly what was signed. The Worker renders the document to self-contained
 * HTML (renderProposalDocumentHtml) and POSTs it to a Google Apps Script web app
 * (deployed by Zjak), which converts HTML→PDF and files it into the central
 * "Internal Drive" folder in a Shared Drive. No service account / JWT here.
 *
 * Called as the `pdf` fulfilment stage (lib/portal/fulfilment.ts) and, for
 * retries, through /api/internal/proposal-fulfilment/pdf by the retry runner. A
 * failure never blocks signing, and re-runs are idempotent (skip once proposal_pdf_drive_id is
 * set). With the env vars unset it silently no-ops, so the rest of the sign flow
 * works before the Apps Script is wired up.
 *
 * fetchSignedProposalPdf (below) reads the archived file back for the client's
 * "That's signed" email.
 */

type ProposalArchiveRaw = Omit<ProposalArchiveRow, 'brackets' | 'addons'> & {
  brackets: Json;
  addons: Json;
};

interface ProposalArchiveRow {
  id: string;
  ref_number: string | null;
  version: number;
  first_name: string;
  last_name: string;
  business_name: string;
  services: string[];
  brackets: Record<string, number>;
  tier_slug: string;
  addons: string[] | null;
  total_charge_zar: number | string;
  sent_at: string | null;
  expires_at: string | null;
  signed_at: string | null;
  signature_name: string | null;
  signature_method: string | null;
  signature_image: string | null;
  signature_ip: string | null;
  effective_from: string | null;
  client_legal_name: string | null;
  client_registration_number: string | null;
  client_registered_address: string | null;
  signer_authority_confirmed: boolean;
  terms_version: string | null;
  proposal_pdf_drive_id: string | null;
}

export interface ArchiveResult {
  ok: boolean;
  skipped?: boolean;
  fileId?: string;
  fileUrl?: string;
  error?: string;
}

// The Apps Script renders the HTML to PDF and files it in Drive. Successful
// first attempts took 6.1 s (2026-10-07) and 6.9 s (2026-10-13); one on
// 2026-10-13 (FT-2026-10-0004) passed the old 8 s bound and held both "signed"
// emails back until the retry runner. Waiting on fetch is not Worker CPU, so
// the cost is only the signer's spinner. No in-request retry: the script keeps
// running after an abort and holds its lock, so a second call would queue
// behind the first and reuse its file — a longer wait, not a better chance.
export const PDF_ARCHIVE_TIMEOUT_MS = 25_000;
// Reading an archived file back (`action: 'fetch'`) does no rendering.
export const PDF_FETCH_TIMEOUT_MS = 10_000;

// A signed proposal measured 79 to 137 KB (2026-10-13); Resend allows 40 MB a
// message after base64. Anything near this cap is not one of our PDFs.
export const MAX_PDF_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export type SignedPdfResult =
  | { ok: true; contentBase64: string }
  | { ok: false; code: string };

/**
 * Read the archived signed PDF back from Drive (Apps Script `action: 'fetch'`),
 * as base64, for the client's "That's signed" email. The same bytes the firm
 * holds, and the same source for the Worker's first attempt and the retry
 * runner (through /api/internal/proposal-fulfilment/pdf-file). Never throws: a
 * caller sends without the attachment on `ok: false`.
 */
export async function fetchSignedProposalPdf(
  fileId: string,
): Promise<SignedPdfResult> {
  const url = process.env.APPS_SCRIPT_PDF_URL;
  const secret = process.env.APPS_SCRIPT_PDF_SECRET;
  if (!url || !secret) return { ok: false, code: 'pdf_not_configured' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, action: 'fetch', fileId }),
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, code: `pdf_fetch_http_${res.status}` };
    const out = (await res.json()) as { ok?: boolean; contentBase64?: unknown };
    const content = out.contentBase64;
    if (!out.ok || typeof content !== 'string' || !content) {
      return { ok: false, code: 'pdf_fetch_rejected' };
    }
    if (content.length > Math.ceil(MAX_PDF_ATTACHMENT_BYTES / 3) * 4) {
      return { ok: false, code: 'pdf_too_large' };
    }
    if (!BASE64.test(content)) return { ok: false, code: 'pdf_fetch_invalid' };
    return { ok: true, contentBase64: content };
  } catch (err) {
    return {
      ok: false,
      code:
        err instanceof Error && err.name === 'TimeoutError'
          ? 'pdf_fetch_timeout'
          : 'pdf_fetch_failed',
    };
  }
}

const PDF_COLUMNS =
  'id, ref_number, version, first_name, last_name, business_name, services, brackets, tier_slug, addons, total_charge_zar, sent_at, expires_at, signed_at, signature_name, signature_method, signature_image, signature_ip, effective_from, client_legal_name, client_registration_number, client_registered_address, signer_authority_confirmed, terms_version, proposal_pdf_drive_id';

export async function archiveSignedProposal(
  admin: SupabaseClient<Database>,
  proposalId: string,
): Promise<ArchiveResult> {
  const url = process.env.APPS_SCRIPT_PDF_URL;
  const secret = process.env.APPS_SCRIPT_PDF_SECRET;
  if (!url || !secret) {
    console.log(
      '[PROPOSAL PDF] APPS_SCRIPT_PDF_* not set — skipping archival.',
    );
    return { ok: false, skipped: true };
  }

  try {
    // Re-fetch the signed row (it carries the signature the route just wrote).
    const { data, error } = await admin
      .from('proposals')
      .select(PDF_COLUMNS)
      .eq('id', proposalId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: 'Proposal not found.' };
    // The two `jsonb` columns arrive as `Json`; everything else is checked
    // against the schema by this assignment. See lib/portal/proposalJson.ts.
    const raw: ProposalArchiveRaw = data;
    const row: ProposalArchiveRow = {
      ...raw,
      brackets: bracketMapFromStored(raw.brackets, raw.id),
      addons: addonSlugsFromStored(raw.addons, raw.id),
    };

    // Idempotent: already archived, or not signed yet → nothing to do.
    if (row.proposal_pdf_drive_id) {
      return { ok: true, skipped: true, fileId: row.proposal_pdf_drive_id };
    }
    if (!row.signed_at) return { ok: false, error: 'Proposal is not signed.' };

    // ⚠️ SERVICE ROLE, NOT `anon`, for brackets and pricing. The stored
    // ordinals may point at retired (inactive) rows after a price-list change,
    // and the `anon` RLS policy returns active rows only — an anon read
    // silently dropped those lines and re-priced the signed mandate LOWER than
    // what the client signed. Services stay anon + active (labels only).
    const [servicesRes, bracketsRes] = await Promise.all([
      createSupabaseAnonClient()
        .from('services')
        .select('*')
        .eq('active', true)
        .order('display_order'),
      admin
        .from('brackets')
        .select('*')
        .order('display_order'),
    ]);
    const services = (servicesRes.data ?? []) as Service[];
    const brackets = (bracketsRes.data ?? []) as Bracket[];

    const priced = await priceProposalSelection(admin, {
      services: row.services,
      brackets: row.brackets,
      tierSlug: row.tier_slug,
      addons: row.addons ?? [],
    });
    if (!priced.ok) return { ok: false, error: priced.error };

    // The PDF is the engagement letter: it states the total the client SIGNED
    // (stored), never a re-priced one. A disagreement is logged, not hidden.
    const signedTotalZAR = Number(row.total_charge_zar);
    if (Math.abs(priced.data.totalChargeZAR - signedTotalZAR) > 0.005) {
      logError('proposal_pdf.total_mismatch', new Error('Re-priced total differs from signed total'), {
        proposalId: row.id,
        signedTotalZAR,
        repricedTotalZAR: priced.data.totalChargeZAR,
      });
    }

    const { html, filename } = buildSignedProposalPdfPayload(
      row,
      { services, brackets },
      {
        lineItems: priced.data.lineItems,
        totalChargeZAR: signedTotalZAR,
      },
    );

    // POST to the Apps Script web app. The shared secret travels in the body —
    // Apps Script doPost can't read request headers.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        proposalId: row.id,
        refNumber: row.ref_number,
        businessName: row.business_name,
        filename,
        html,
      }),
      signal: AbortSignal.timeout(PDF_ARCHIVE_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, error: `Apps Script responded ${res.status}` };
    }
    const out = (await res.json()) as {
      ok?: boolean;
      fileId?: string;
      fileUrl?: string;
      error?: string;
    };
    if (!out.ok || !out.fileId) {
      return {
        ok: false,
        error: out.error ?? 'Apps Script did not return a file id.',
      };
    }

    const { error: updErr } = await admin
      .from('proposals')
      .update({ proposal_pdf_drive_id: out.fileId })
      .eq('id', row.id);
    if (updErr) {
      // The PDF exists; we just couldn't record its id. Surface as a soft failure.
      console.error(
        '[PROPOSAL PDF] stored file but failed to save id:',
        updErr,
      );
      return { ok: false, error: 'Saved the PDF but could not record its id.' };
    }

    return {
      ok: true,
      fileId: out.fileId,
      fileUrl: out.fileUrl ?? driveFileUrl(out.fileId),
    };
  } catch (err) {
    console.error('[PROPOSAL PDF] archival error:', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'PDF archival failed.',
    };
  }
}
