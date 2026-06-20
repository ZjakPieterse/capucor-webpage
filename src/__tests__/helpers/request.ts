import { NextRequest } from 'next/server';

interface MakeRequestOptions {
  /** Sets `x-forwarded-for` (the default IP source for non-CF environments). */
  ip?: string;
  /** Sets `cf-connecting-ip` — Cloudflare's real client IP, which wins in prod. */
  cfIp?: string;
  /** Sets `x-real-ip` (the last fallback). */
  xRealIp?: string;
  /** Pass a raw string to simulate malformed JSON. */
  raw?: string;
}

export function makeJsonRequest(
  url: string,
  body: unknown,
  { ip = '203.0.113.1', cfIp, xRealIp, raw }: MakeRequestOptions = {},
): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (ip) headers['x-forwarded-for'] = ip;
  if (cfIp) headers['cf-connecting-ip'] = cfIp;
  if (xRealIp) headers['x-real-ip'] = xRealIp;

  return new NextRequest(url, {
    method: 'POST',
    headers,
    body: raw ?? JSON.stringify(body),
  });
}
