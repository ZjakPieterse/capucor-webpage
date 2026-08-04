// Typed application boundary for the dependency-free renderers used by both
// immediate sends and the GitHub delivery reconciler.
import {
  renderSignConfirmEmail as renderSignConfirm,
  renderProvisionedClientEmail as renderProvisionedClient,
  renderSignedClientEmail as renderSignedClient,
  renderProvisionedOwnerEmail as renderProvisionedOwner,
  renderProvisionFailedOwnerEmail as renderProvisionFailedOwner,
} from '@/lib/email/messages.mjs';

export function renderSignConfirmEmail(d: {
  firstName: string;
  businessName: string;
  refNumber: string | null;
  confirmUrl: string;
}): string {
  return renderSignConfirm(d);
}

export function renderProvisionedClientEmail(d: {
  firstName: string;
  businessName: string;
  loginUrl: string;
  signedAt: string;
}): string {
  return renderProvisionedClient(d);
}

export function renderSignedClientEmail(d: { firstName: string; businessName: string; signedAt: string }): string {
  return renderSignedClient(d);
}

export function renderProvisionedOwnerEmail(d: {
  fullName: string;
  businessName: string;
  email: string;
  refNumber: string | null;
  signedAt: string;
  proposalUrl: string;
  pdfUrl: string | null;
}): string {
  return renderProvisionedOwner(d);
}

export function renderProvisionFailedOwnerEmail(d: {
  fullName: string;
  businessName: string;
  email: string;
  refNumber: string | null;
  signedAt: string;
  proposalUrl: string;
}): string {
  return renderProvisionFailedOwner(d);
}
