import 'server-only';

/**
 * Gate for the DETAILED /api/health view.
 *
 * WHY. The health route has to answer two different audiences. Uptime
 * monitoring and CI need to know whether this Worker is configured; anyone on
 * the internet does not need the NAMES of our secrets. Values were never
 * exposed, but the unauthenticated response enumerated every secret this Worker
 * reads, which hands a scanner our topology for free.
 *
 * The public response is now `{ ok, app }` — still truthful, still 503 when a
 * required secret is missing, so neither uptime monitoring nor CI's status-code
 * check changes. The per-variable detail requires this signature.
 *
 * NO NEW SECRET ON PURPOSE. This reuses SUPABASE_SERVICE_ROLE_KEY as an HMAC
 * key, exactly like lib/portal/reconciliationAuth.ts does for the PDF bridge.
 * The key is never transmitted — only a signature over a timestamp — so adding
 * this needs no Cloudflare secret, no dashboard change, and no new entry in
 * lib/env.ts. CI already has the key and signs with it.
 *
 * Sign with:
 *   ts=$(date +%s000)
 *   sig=$(printf '%s.health' "$ts" |
 *     openssl dgst -sha256 -hmac "$SUPABASE_SERVICE_ROLE_KEY" -hex | awk '{print $2}')
 *   curl -H "x-capucor-timestamp: $ts" -H "x-capucor-signature: $sig" .../api/health
 */

const MAX_CLOCK_SKEW_MS = 5 * 60_000;
const HEX_SIGNATURE = /^[0-9a-f]{64}$/i;

function hexBytes(value: string): ArrayBuffer {
  const buffer = new ArrayBuffer(value.length / 2);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return buffer;
}

export async function verifyHealthSignature(
  timestamp: string | null,
  signature: string | null,
  now = Date.now(),
): Promise<boolean> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const timestampMs = Number(timestamp);
  if (
    !secret ||
    !timestamp ||
    !Number.isFinite(timestampMs) ||
    Math.abs(now - timestampMs) > MAX_CLOCK_SKEW_MS ||
    !signature ||
    !HEX_SIGNATURE.test(signature)
  ) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'HMAC',
    key,
    hexBytes(signature),
    new TextEncoder().encode(`${timestamp}.health`),
  );
}
