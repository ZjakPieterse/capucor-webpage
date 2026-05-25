// Opaque magic-link tokens for the POPIA data-request flow (P1).
//
// We don't use HMAC here — the token is a 32-byte cryptographically random
// value, base64url-encoded, and looked up directly in the data_requests row.
// Expiry is enforced server-side from token_expires_at, not encoded in the
// token itself. This keeps the token short and avoids any token-rotation /
// secret-leak failure mode.

const TOKEN_BYTES = 32;

export function generateDataRequestToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // btoa exists in the Edge / Cloudflare Workers runtime and in modern Node.
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
