import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/db';
import { createSupabaseAnonClient } from '@/lib/supabase/anon';
import { priceProposalSelection } from '@/lib/proposalPricing';
import { buildSignedProposalPdfPayload } from '@/lib/portal/proposalPdfPayload';
import { addonSlugsFromStored, bracketMapFromStored } from '@/lib/portal/proposalJson';
import type { Bracket, Service } from '@/types';

/**
 * PR10 — archive a SIGNED proposal as a PDF in the firm's Shared Drive.
 *
 * The signed proposal is the legal debit-order mandate, so we keep a durable PDF
 * of exactly what was signed. The Worker renders the document to self-contained
 * HTML (renderProposalDocumentHtml) and POSTs it to a Google Apps Script web app
 * (deployed by Zjak), which converts HTML→PDF and files it into the central
 * "Internal Drive" folder in a Shared Drive. No service account / JWT here.
 *
 * Called non-fatally from the sign route: a failure never blocks signing or
 * provisioning, and re-runs are idempotent (skip once proposal_pdf_drive_id is
 * set). With the env vars unset it silently no-ops, so the rest of the sign flow
 * works before the Apps Script is wired up.
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
  proposal_pdf_drive_id: string | null;
}

export interface ArchiveResult {
  ok: boolean;
  skipped?: boolean;
  fileId?: string;
  fileUrl?: string;
  error?: string;
}

export const PDF_ARCHIVE_TIMEOUT_MS = 8_000;

const PDF_COLUMNS =
  'id, ref_number, version, first_name, last_name, business_name, services, brackets, tier_slug, addons, total_charge_zar, sent_at, expires_at, signed_at, signature_name, signature_method, signature_image, signature_ip, proposal_pdf_drive_id';

// Drive's standard single-file view URL, derived from the file id.
export function driveFileUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

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

    // Public pricing config via the anon client (RLS rule for public tables).
    const anon = createSupabaseAnonClient();
    const [servicesRes, bracketsRes] = await Promise.all([
      anon
        .from('services')
        .select('*')
        .eq('active', true)
        .order('display_order'),
      anon
        .from('brackets')
        .select('*')
        .eq('active', true)
        .order('display_order'),
    ]);
    const services = (servicesRes.data ?? []) as Service[];
    const brackets = (bracketsRes.data ?? []) as Bracket[];

    const priced = await priceProposalSelection(anon, {
      services: row.services,
      brackets: row.brackets,
      tierSlug: row.tier_slug,
      addons: row.addons ?? [],
    });
    if (!priced.ok) return { ok: false, error: priced.error };

    const { html, filename } = buildSignedProposalPdfPayload(
      row,
      { services, brackets },
      {
        lineItems: priced.data.lineItems,
        totalChargeZAR: priced.data.totalChargeZAR,
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
