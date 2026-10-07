import { tierDisplayName } from '@/config/tiers';
import {
  buildFairUsage,
  cumulativeInclusions,
  outOfScopeItems,
} from '@/lib/schedule';
import { renderProposalDocumentHtml } from '@/lib/proposal/renderProposalDocumentHtml';
import type { Bracket, BracketValue, Service } from '@/types';

export interface SignedProposalPdfSource {
  id: string;
  ref_number: string | null;
  version: number;
  first_name: string;
  last_name: string;
  business_name: string;
  services: string[];
  brackets: Record<string, number>;
  tier_slug: string;
  /** Add-on tokens; a not-VAT-registered scope flag hides VAT201. Older callers omit it. */
  addons?: string[] | null;
  sent_at: string | null;
  expires_at: string | null;
  signed_at: string | null;
  signature_name: string | null;
  signature_method: string | null;
  signature_image: string | null;
  signature_ip: string | null;
}

export interface SignedProposalPdfPayload {
  filename: string;
  html: string;
}

/**
 * The Drive file name: `YYYY-MM-DD - <business name> - <ref> - signed proposal.pdf`,
 * dated by the SIGNING day in SAST (decision 2026-10-07). South Africa has no
 * daylight saving, so SAST is a fixed UTC+2 and needs no time-zone database.
 * The ref segment is left out for the older rows that have none.
 */
export function signedProposalFilename(row: {
  signed_at: string | null;
  business_name: string;
  ref_number: string | null;
}): string {
  const signed = row.signed_at ? new Date(row.signed_at) : new Date();
  const sastDate = new Date(signed.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return [sastDate, row.business_name.trim(), row.ref_number, 'signed proposal.pdf']
    .filter(Boolean)
    .join(' - ');
}

/**
 * Pure legal-document rendering boundary. All database/provider work stays in
 * the callers.
 */
export function buildSignedProposalPdfPayload(
  row: SignedProposalPdfSource,
  catalogue: { services: Service[]; brackets: Bracket[] },
  priced: {
    lineItems: { name: string; label: string | null; price: number }[];
    totalChargeZAR: number;
  },
): SignedProposalPdfPayload {
  const selectedBrackets = row.brackets as Record<string, BracketValue>;
  const html = renderProposalDocumentHtml({
    businessName: row.business_name,
    firstName: row.first_name,
    lastName: row.last_name,
    tierName: tierDisplayName(row.tier_slug),
    refNumber: row.ref_number,
    version: row.version,
    sentAt: row.sent_at,
    expiresAt: row.expires_at,
    // Dated from the signature, as the signing page showed it that day (F23).
    firstDebitFrom: row.signed_at ?? row.sent_at,
    signedAt: row.signed_at,
    signatureName: row.signature_name,
    signatureMethod: row.signature_method,
    signatureImage: row.signature_image,
    signatureIp: row.signature_ip,
    inclusions: cumulativeInclusions(row.services, row.tier_slug, row.addons ?? []),
    fairUsage: buildFairUsage(
      row.services,
      selectedBrackets,
      catalogue.brackets,
      row.tier_slug,
    ),
    outOfScope: outOfScopeItems(row.services, catalogue.services),
    lineItems: priced.lineItems,
    totalChargeZAR: priced.totalChargeZAR,
  });

  return {
    filename: signedProposalFilename(row),
    html,
  };
}
