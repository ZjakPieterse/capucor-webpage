// Typed application boundary for the dependency-free renderer used by the
// signing route. The signed-proposal emails are built whole in messages.mjs
// (buildSignedClientMessage / buildSignedOwnerMessage) and used directly.
import { renderSignConfirmEmail as renderSignConfirm } from '@/lib/email/messages.mjs';

export function renderSignConfirmEmail(d: {
  firstName: string;
  businessName: string;
  refNumber: string | null;
  confirmUrl: string;
}): string {
  return renderSignConfirm(d);
}
