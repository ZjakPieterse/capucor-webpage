// The staff-only hostname (decision 2026-10-15, plan-review-tool). Served by
// this same Worker as a second Custom Domain, behind Cloudflare Access.
// next.config.ts rewrites it onto app/(internal)/internal-tools/.
export const INTERNAL_HOST = 'internal.capucor.com';

/** Internal pages live under this path; on any other host they 404. */
export const INTERNAL_PATH_PREFIX = '/internal-tools';

export function isInternalHost(host: string | null | undefined): boolean {
  return (host ?? '').trim().toLowerCase() === INTERNAL_HOST;
}
