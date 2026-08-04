import 'server-only';

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

export async function verifyReconciliationSignature(
  proposalId: string,
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
    new TextEncoder().encode(`${timestamp}.${proposalId}`),
  );
}
