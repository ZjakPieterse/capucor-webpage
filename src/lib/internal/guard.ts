// The gate every internal page and API calls first (decision 2026-10-15: no
// proxy.ts — OpenNext marks Node proxy on Cloudflare experimental — so the check
// lives in each route; internal-routes-guarded.test.ts fails if one skips it).
//
//   wrong host (capucor.com, www, anything else) → 404, as if it did not exist
//   internal host, Access JWT missing or invalid → 403
//   internal host, valid Access JWT              → allowed
//
// ⚠️ THE ACCESS JWT IS THE SECURITY BOUNDARY; the host check only keeps the
// routes invisible elsewhere. OpenNext copies a client-sent X-Forwarded-Host
// over `host` before routing (@opennextjs/aws core/requestHandler.js), so
// `host` alone can be spoofed from capucor.com: such a request reaches this
// check and gets 403, never the page, because it still needs a JWT signed by
// our Access team for our AUD. Do not weaken the JWT check on the strength of
// the host check.
import 'server-only';
import { headers } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import { logWarn } from '@/lib/log';
import { accessConfigFromEnv, verifyAccessJwt } from './accessJwt';
import { isInternalHost } from './host';

export const ACCESS_JWT_HEADER = 'cf-access-jwt-assertion';

export type InternalCheck =
  | { outcome: 'ok'; email: string | null }
  | { outcome: 'not_found' }
  | { outcome: 'forbidden'; reason: string };

export async function checkInternalRequest(
  host: string | null,
  token: string | null,
  opts?: Parameters<typeof verifyAccessJwt>[2],
): Promise<InternalCheck> {
  if (!isInternalHost(host)) return { outcome: 'not_found' };
  const res = await verifyAccessJwt(token, accessConfigFromEnv(), opts);
  if (!res.ok) {
    logWarn('internal.access_denied', { reason: res.reason });
    return { outcome: 'forbidden', reason: res.reason };
  }
  return { outcome: 'ok', email: res.email };
}

/** For internal pages and layouts (server components). Throws 404 / 403. */
export async function requireInternalPage(): Promise<{ email: string | null }> {
  const h = await headers();
  const check = await checkInternalRequest(
    h.get('host'),
    h.get(ACCESS_JWT_HEADER),
  );
  if (check.outcome === 'not_found') notFound();
  if (check.outcome === 'forbidden') forbidden();
  return { email: check.email };
}

/** For /api/internal-tools/* route handlers. A Response means stop and return it. */
export async function guardInternalApi(req: Request): Promise<Response | null> {
  const check = await checkInternalRequest(
    req.headers.get('host'),
    req.headers.get(ACCESS_JWT_HEADER),
  );
  if (check.outcome === 'not_found') {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }
  if (check.outcome === 'forbidden') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}
