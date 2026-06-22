// CRM category for a client org (migration 016). Single source of truth shared by
// the zod schema (validations.ts), the create form, the internal Organisation
// card, and the clients list. 'subscription' is the default — every client born
// from provision-on-sign (PR9) is one; the others describe manually-added clients.

export const CLIENT_TYPES = ['subscription', 'legacy', 'ad_hoc', 'prospect'] as const;

export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  subscription: 'Subscription',
  legacy: 'Legacy',
  ad_hoc: 'Ad-hoc',
  prospect: 'Prospect',
};

// Tolerant label lookup for an arbitrary stored value (defends against a row that
// predates the CHECK or was set out-of-band).
export function clientTypeLabel(value: string): string {
  return CLIENT_TYPE_LABELS[value as ClientType] ?? value;
}
