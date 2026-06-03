// Opaque magic-link tokens.
//
// A cryptographically random 32-byte value, base64url-encoded, looked up
// directly in the owning row (no HMAC — expiry is enforced server-side from a
// column, not encoded in the token). Used for /proposal/<token> links; the
// POPIA data-request flow has its own copy in data-request-token.ts.

const TOKEN_BYTES = 32;

export function generateOpaqueToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // btoa exists in the Cloudflare Workers runtime and in modern Node.
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
