// Cloudflare Access JWT verification for internal.capucor.com.
//
// Access (email PIN, Zjak only) is the lock at the edge. This is the second
// check, in the Worker: every internal page and API verifies the
// `Cf-Access-Jwt-Assertion` header Access adds, so a request that reached the
// Worker without passing Access (a misconfigured application, a new hostname
// added before its Access app) is refused. It fails CLOSED: no config, no
// token, an unreachable key set or any failed claim → not verified.
//
// Plain WebCrypto (RS256), no dependency. Keys come from the team's JWKS at
// https://<team>.cloudflareaccess.com/cdn-cgi/access/certs.

export interface AccessConfig {
  /** e.g. `capucor.cloudflareaccess.com` (no scheme). */
  teamDomain: string;
  /** The Access application's Application Audience (AUD) tag. */
  aud: string;
  /** Overrides the JWKS URL. Honoured outside production only (local preview). */
  certsUrl?: string;
}

export type AccessResult =
  | { ok: true; email: string | null }
  | { ok: false; reason: string };

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

const JWKS_TTL_MS = 10 * 60 * 1000;
const CLOCK_SKEW_S = 60;
const JWKS_TIMEOUT_MS = 5000;
const FORCED_REFRESH_MIN_MS = 60 * 1000;

const jwksCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>();

/** Test hook: forget cached key sets. */
export function resetAccessJwksCache(): void {
  jwksCache.clear();
}

// The local JWKS override is OPT-IN: honoured only under `next dev`. The
// literal `process.env.NODE_ENV` is inlined by the build, and on the Worker it
// is never 'development' (OpenNext does not set NODE_ENV at runtime, so a
// `!== 'production'` test would have let the override through there).
const IS_NEXT_DEV = process.env.NODE_ENV === 'development';

/** Reads CF_ACCESS_TEAM_DOMAIN / CF_ACCESS_AUD. Null when either is missing. */
export function accessConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  allowCertsOverride: boolean = IS_NEXT_DEV,
): AccessConfig | null {
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const aud = env.CF_ACCESS_AUD?.trim();
  if (!teamDomain || !aud) return null;
  const certsUrl =
    allowCertsOverride && env.CF_ACCESS_CERTS_URL?.trim() ? env.CF_ACCESS_CERTS_URL.trim() : undefined;
  return { teamDomain, aud, certsUrl };
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlJson(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

async function loadKeys(url: string, fetchImpl: typeof fetch, force: boolean): Promise<Jwk[]> {
  const hit = jwksCache.get(url);
  if (!force && hit && Date.now() - hit.fetchedAt < JWKS_TTL_MS) return hit.keys;
  const res = await fetchImpl(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(JWKS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`jwks http ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = Array.isArray(body.keys) ? body.keys : [];
  jwksCache.set(url, { keys, fetchedAt: Date.now() });
  return keys;
}

export async function verifyAccessJwt(
  token: string | null | undefined,
  config: AccessConfig | null,
  opts: { now?: number; fetchImpl?: typeof fetch } = {},
): Promise<AccessResult> {
  if (!config) return { ok: false, reason: 'not_configured' };
  if (!token) return { ok: false, reason: 'missing_token' };

  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [h, p, s] = parts;
  const header = b64urlJson(h);
  const payload = b64urlJson(p);
  if (!header || !payload) return { ok: false, reason: 'malformed' };
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    return { ok: false, reason: 'bad_alg' };
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = config.certsUrl ?? `https://${config.teamDomain}/cdn-cgi/access/certs`;
  let jwk: Jwk | undefined;
  try {
    jwk = (await loadKeys(url, fetchImpl, false)).find((k) => k.kid === header.kid);
    // Access rotates keys; an unknown kid forces a refresh, at most once a
    // minute, so junk kids cannot turn every request into a certs fetch.
    const fetchedAt = jwksCache.get(url)?.fetchedAt ?? 0;
    if (!jwk && Date.now() - fetchedAt >= FORCED_REFRESH_MIN_MS) {
      jwk = (await loadKeys(url, fetchImpl, true)).find((k) => k.kid === header.kid);
    }
  } catch {
    return { ok: false, reason: 'jwks_unavailable' };
  }
  if (!jwk || jwk.kty !== 'RSA') return { ok: false, reason: 'unknown_key' };

  let valid = false;
  try {
    const key = await crypto.subtle.importKey(
      'jwk',
      { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlToBytes(s),
      new TextEncoder().encode(`${h}.${p}`),
    );
  } catch {
    return { ok: false, reason: 'bad_signature' };
  }
  if (!valid) return { ok: false, reason: 'bad_signature' };

  const nowS = Math.floor((opts.now ?? Date.now()) / 1000);
  if (payload.iss !== `https://${config.teamDomain}`) return { ok: false, reason: 'bad_issuer' };
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(config.aud)) return { ok: false, reason: 'bad_audience' };
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_SKEW_S < nowS) {
    return { ok: false, reason: 'expired' };
  }
  if (typeof payload.nbf === 'number' && payload.nbf - CLOCK_SKEW_S > nowS) {
    return { ok: false, reason: 'not_yet_valid' };
  }

  return { ok: true, email: typeof payload.email === 'string' ? payload.email : null };
}
