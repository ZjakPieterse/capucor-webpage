export const EMAIL_SENDER: string;
export const WEBSITE_SENDER: string;
export const PRIVACY_SENDER: string;
export const EMAIL_REPLY_TO: string;
export function formatZAR(amount: number): string;
export function stableStringify(value: unknown): string;
export function renderLeadOwnerText(data: object): string;
export function renderDataRequestConfirmationText(data: object): string;
export function renderDataRequestPendingOwnerText(data: object): string;
export function renderDataRequestConfirmedOwnerText(data: object): string;
export function renderCreatedProposalClientEmail(data: object): string;
export function renderCreatedProposalOwnerText(data: object): string;
export function renderSignConfirmEmail(data: object): string;
export function renderSignedClientEmail(data: object): string;
export function renderSignedOwnerEmail(data: object): string;
export const SIGNED_CLIENT_EVENT: 'proposal.signed_client';
export const SIGNED_OWNER_EVENT: 'proposal.signed_owner';
export function signedClientIdempotencyKey(proposalId: string): string;
export function signedOwnerIdempotencyKey(proposalId: string): string;
export function driveFileUrl(fileId: string): string;
export interface SignedProposalSource {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  business_name: string;
  ref_number: string | null;
  signed_at: string;
  proposal_pdf_drive_id: string | null;
}
export interface BuiltEmail {
  from: string;
  replyTo?: string;
  to: string;
  subject: string;
  html: string;
}
export function buildSignedClientMessage(p: SignedProposalSource): BuiltEmail;
export function buildSignedOwnerMessage(p: SignedProposalSource, ownerEmail: string): BuiltEmail;
export function renderAmendEmail(data: object): string;
export function renderResendEmail(data: object): string;
