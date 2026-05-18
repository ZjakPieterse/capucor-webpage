import { NextRequest } from 'next/server';

interface MakeRequestOptions {
  ip?: string;
  /** Pass a raw string to simulate malformed JSON. */
  raw?: string;
}

export function makeJsonRequest(
  url: string,
  body: unknown,
  { ip = '203.0.113.1', raw }: MakeRequestOptions = {},
): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: raw ?? JSON.stringify(body),
  });
}
