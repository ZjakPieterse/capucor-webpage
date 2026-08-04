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
 * Pure legal-document rendering boundary shared with the dependency-free OS
 * reconciliation bundle. All database/provider work stays in the callers.
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
    firstDebitFrom: row.sent_at ?? row.signed_at,
    signedAt: row.signed_at,
    signatureName: row.signature_name,
    signatureMethod: row.signature_method,
    signatureImage: row.signature_image,
    signatureIp: row.signature_ip,
    inclusions: cumulativeInclusions(row.services, row.tier_slug),
    fairUsage: buildFairUsage(
      row.services,
      selectedBrackets,
      catalogue.brackets,
    ),
    outOfScope: outOfScopeItems(row.services, catalogue.services),
    lineItems: priced.lineItems,
    totalChargeZAR: priced.totalChargeZAR,
  });

  return {
    filename: `${row.ref_number ?? 'proposal'} - ${row.business_name} - signed proposal.pdf`,
    html,
  };
}
