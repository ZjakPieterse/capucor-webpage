// The 005 CHECK wants a trimmed name of 2–160 characters. A proposal's business
// name is 2–120 at creation; if it is somehow unusable, the signer's own name
// stands in (a sole proprietor contracts in their own name; the schema trims it
// and requires 2–120 characters).
export function boundPartyName(businessName: string | null, signatureName: string): string {
  const name = (businessName ?? '').trim().slice(0, 160).trim();
  return name.length >= 2 ? name : signatureName.trim();
}
