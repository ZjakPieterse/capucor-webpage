// Real client IP for rate-limiting and the signed-mandate audit trail.
//
// On Cloudflare/OpenNext the genuine visitor IP lives in `cf-connecting-ip`.
// The older `x-forwarded-for ?? x-real-ip` derivation that used to be inlined
// at every call site resolved to the worker loopback (`::1`) in production —
// poisoning `signature_ip` evidence AND collapsing per-IP rate-limit buckets to
// one shared `::1` key. Read CF's header first, then fall back for local dev /
// other hosts.
//
// `||` (not `??`) so a present-but-empty header falls through to the next
// source. Header `.get()` is case-insensitive on both `Headers` (NextRequest)
// and `ReadonlyHeaders` (the server `headers()` helper).

type HeaderGetter = { get(name: string): string | null };

export function getClientIp(headers: HeaderGetter): string {
  return (
    headers.get('cf-connecting-ip')?.trim() ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}
