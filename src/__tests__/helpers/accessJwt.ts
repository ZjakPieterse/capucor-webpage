// Test-only Cloudflare Access look-alike: an RS256 key pair, a JWKS "endpoint"
// (a mock fetch) and a token signer. Never imported by app code.
import { vi } from 'vitest';

export interface AccessSigner {
  sign(claims: Record<string, unknown>, header?: { kid?: string; alg?: string }): Promise<string>;
  rotate(kid: string): Promise<void>;
  fetch: typeof fetch & ReturnType<typeof vi.fn>;
}

const b64url = (b: ArrayBuffer | Uint8Array | string) =>
  Buffer.from(typeof b === 'string' ? b : new Uint8Array(b)).toString('base64url');

async function keyPair() {
  return crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
}

export async function makeAccessSigner(kid: string): Promise<AccessSigner> {
  let current = { kid, pair: await keyPair() };
  const published: Array<{ kid: string; pair: CryptoKeyPair }> = [current];

  const fetchMock = vi.fn(async () => {
    const keys = await Promise.all(
      published.map(async ({ kid: k, pair }) => ({
        ...(await crypto.subtle.exportKey('jwk', pair.publicKey)),
        kid: k,
        alg: 'RS256',
        use: 'sig',
      })),
    );
    return Response.json({ keys });
  });

  return {
    fetch: fetchMock as unknown as AccessSigner['fetch'],
    async rotate(newKid) {
      current = { kid: newKid, pair: await keyPair() };
      published.push(current);
    },
    async sign(claims, header = {}) {
      const h = b64url(JSON.stringify({ alg: header.alg ?? 'RS256', kid: header.kid ?? current.kid, typ: 'JWT' }));
      const p = b64url(JSON.stringify(claims));
      const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', current.pair.privateKey, new TextEncoder().encode(`${h}.${p}`));
      return `${h}.${p}.${b64url(sig)}`;
    },
  };
}
