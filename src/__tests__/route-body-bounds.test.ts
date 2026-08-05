import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { makeJsonRequest } from './helpers/request';

/**
 * Every route that reads a request body must bound it.
 *
 * WHY THIS EXISTS (PH-08b). `await req.json()` reads whatever it is sent, and
 * nothing in this stack bounded it. Measured against a local production build on
 * 2026-08-05: a **25 MB** body was fully read and JSON-parsed by /api/leads,
 * /api/data-request and /api/proposals/sign/confirm before Zod refused it —
 * 422/400, never 413. Next caps Server Actions at 1 MB by default but applies no
 * cap to Route Handlers, and this repo has no middleware at all.
 *
 * On Workers Free (10ms CPU per invocation) that is a cheap denial of service.
 * Parsing megabytes of JSON is CPU, not I/O — waiting on Supabase costs no CPU,
 * but `JSON.parse` of a 25 MB string spends the whole budget on its own.
 *
 * These tests pin the three things that stop it coming back: an oversized body
 * is refused with 413, it is refused BEFORE any database or email work, and a
 * normal body still reaches the schema.
 */

vi.mock('server-only', () => ({}));

vi.mock('@/lib/rate-limit', () => ({
  // Allowed, so the body read is what the request reaches next. A refusing
  // limiter would make every assertion below pass for the wrong reason.
  checkRateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}));

// Hoisted, because vi.mock factories are lifted above ordinary top-level consts.
// Each throws rather than returning a stub: reaching one of these AT ALL means a
// route did privileged work on a body it should already have refused, and a
// silent stub would let that pass as a green test.
const spies = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(() => {
    throw new Error('a bounded route must not build a Supabase client');
  }),
  createSupabaseServerClient: vi.fn(async () => {
    throw new Error('a bounded route must not build a Supabase client');
  }),
  sendEmail: vi.fn(async () => {
    throw new Error('a bounded route must not send email');
  }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: spies.createSupabaseAdminClient,
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: spies.createSupabaseServerClient,
}));
vi.mock('@/lib/email/sendEmail', () => ({ sendEmail: spies.sendEmail }));
vi.mock('@/lib/portal/reconciliationAuth', () => ({
  verifyReconciliationSignature: vi.fn(async () => true),
}));
vi.mock('@/lib/portal/proposalPdf', () => ({
  archiveSignedProposal: vi.fn(async () => ({ ok: true })),
}));

const { createSupabaseAdminClient, createSupabaseServerClient, sendEmail } = spies;

import { readJsonBody } from '@/lib/readJsonBody';
import { POST as leadsPost } from '@/app/api/leads/route';
import { POST as dataRequestPost } from '@/app/api/data-request/route';
import { POST as proposalsPost } from '@/app/api/proposals/route';
import { POST as signPost } from '@/app/api/proposals/sign/route';
import { POST as signConfirmPost } from '@/app/api/proposals/sign/confirm/route';
import { POST as pdfPost } from '@/app/api/internal/proposal-fulfilment/pdf/route';

/**
 * Bigger than every cap in this repo, including the signing route's 1 MB — the
 * one route with a genuinely large legitimate body.
 */
const OVERSIZED = `{"filler":"${'x'.repeat(2 * 1024 * 1024)}"}`;

/** A POST whose body arrives as a stream, so it carries NO content-length. */
function makeStreamedRequest(url: string, payload: string): NextRequest {
  const bytes = new TextEncoder().encode(payload);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Several chunks, so the running byte count is what has to catch this.
      const size = 64 * 1024;
      for (let at = 0; at < bytes.length; at += size) {
        controller.enqueue(bytes.subarray(at, at + size));
      }
      controller.close();
    },
  });
  const request = new NextRequest(
    new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.1' },
      body: stream,
      // Required by undici for a streaming request body.
      duplex: 'half',
    } as RequestInit & { duplex: 'half' }),
  );
  // The point of this helper is a body with NO declared size. If a runtime change
  // ever starts computing one, test 3 would quietly start proving the header
  // check instead of the counted read, and the counted read could be deleted
  // without a single test going red.
  if (request.headers.get('content-length') !== null) {
    throw new Error('streamed request unexpectedly carries a content-length');
  }
  return request;
}

const ROUTES: Array<{ name: string; run: (req: NextRequest) => Promise<Response>; url: string }> = [
  { name: '/api/leads', run: leadsPost, url: 'http://test/api/leads' },
  { name: '/api/data-request', run: dataRequestPost, url: 'http://test/api/data-request' },
  { name: '/api/proposals', run: proposalsPost, url: 'http://test/api/proposals' },
  { name: '/api/proposals/sign', run: signPost, url: 'http://test/api/proposals/sign' },
  {
    name: '/api/proposals/sign/confirm',
    run: signConfirmPost,
    url: 'http://test/api/proposals/sign/confirm',
  },
  {
    name: '/api/internal/proposal-fulfilment/pdf',
    run: pdfPost,
    url: 'http://test/api/internal/proposal-fulfilment/pdf',
  },
];

describe('route body bounds', () => {
  beforeEach(() => {
    createSupabaseAdminClient.mockClear();
    createSupabaseServerClient.mockClear();
    sendEmail.mockClear();
  });

  it('1. every body-reading route refuses an oversized body with 413', async () => {
    for (const route of ROUTES) {
      const res = await route.run(makeJsonRequest(route.url, null, { raw: OVERSIZED }));
      expect(res.status, `${route.name} did not refuse a 2 MB body`).toBe(413);
    }
  });

  it('2. the refusal happens before any database or email work', async () => {
    for (const route of ROUTES) {
      createSupabaseAdminClient.mockClear();
      createSupabaseServerClient.mockClear();
      sendEmail.mockClear();

      await route.run(makeJsonRequest(route.url, null, { raw: OVERSIZED }));

      expect(createSupabaseAdminClient, `${route.name} built an admin client`).not.toHaveBeenCalled();
      expect(
        createSupabaseServerClient,
        `${route.name} built a server client`,
      ).not.toHaveBeenCalled();
      expect(sendEmail, `${route.name} sent email`).not.toHaveBeenCalled();
    }
  });

  it('3. a body with no content-length is still bounded', async () => {
    // The header check is the cheap half — it refuses before reading a byte. But
    // a chunked request sends no content-length at all, so if the running byte
    // count were dropped, this is the case that would go through unbounded.
    for (const route of ROUTES) {
      const res = await route.run(makeStreamedRequest(route.url, OVERSIZED));
      expect(res.status, `${route.name} accepted an unmeasured 2 MB body`).toBe(413);
    }
  });

  it('4. a normal body still reaches the schema, so the cap breaks nothing', async () => {
    // Each route refuses this for its OWN reason — a Zod failure or a missing
    // token — which is the point: the body got through the cap and was parsed.
    for (const route of ROUTES) {
      const res = await route.run(makeJsonRequest(route.url, { hello: 'world' }));
      expect([400, 422], `${route.name} answered ${res.status} for a small body`).toContain(
        res.status,
      );
    }
  });

  it('5. malformed JSON is still a 400, not a 413', async () => {
    for (const route of ROUTES) {
      const res = await route.run(makeJsonRequest(route.url, null, { raw: '{not json' }));
      expect(res.status, `${route.name} mis-classified malformed JSON`).toBe(400);
    }
  });
});

describe('readJsonBody', () => {
  const req = (payload: string, headers: Record<string, string> = {}) =>
    new NextRequest('http://test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: payload,
    });

  it('accepts a body at the cap and refuses one past it', async () => {
    // `{"a":"xx"}` is 10 bytes.
    await expect(readJsonBody(req('{"a":"xx"}'), 10)).resolves.toEqual({
      ok: true,
      body: { a: 'xx' },
    });
    expect((await readJsonBody(req('{"a":"xxx"}'), 10)).ok).toBe(false);
  });

  it('refuses on a credible content-length before reading the body at all', async () => {
    // The body here is SMALL and perfectly valid; only the declared size is over
    // the cap. So a 413 can only have come from the header check — delete that
    // check and this test fails with `{ ok: true, body: { a: 1 } }`, because the
    // counted read would sail through. That is what makes this an assertion about
    // the fast path rather than about the outcome.
    const bytes = new TextEncoder().encode('{"a":1}');
    const request = new NextRequest(
      new Request('http://test/x', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': '999999' },
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
        duplex: 'half',
      } as RequestInit & { duplex: 'half' }),
    );

    const result = await readJsonBody(request, 1024);
    expect(result).toEqual({ ok: false, status: 413, error: 'Request body is too large.' });
  });

  it('does not trust a content-length that under-declares the real body', async () => {
    // A lying header is why the running byte count exists. Declared 5 bytes,
    // sends far more.
    const payload = `{"a":"${'y'.repeat(4096)}"}`;
    const bytes = new TextEncoder().encode(payload);
    const request = new NextRequest(
      new Request('http://test/x', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': '5' },
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          },
        }),
        duplex: 'half',
      } as RequestInit & { duplex: 'half' }),
    );

    const result = await readJsonBody(request, 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(413);
  });

  it('treats a non-numeric content-length as unknown rather than too large', async () => {
    // A malformed header is not evidence of an oversized body, and answering 413
    // to a small one would be wrong. The counted read bounds it either way.
    const result = await readJsonBody(req('{"a":1}', { 'content-length': 'banana' }), 1024);
    expect(result).toEqual({ ok: true, body: { a: 1 } });
  });

  it('reports malformed JSON as 400 and never as 413', async () => {
    const result = await readJsonBody(req('{not json'), 1024);
    expect(result).toEqual({ ok: false, status: 400, error: 'Invalid request body.' });
  });

  it('splits a multi-byte character across chunks without corrupting it', async () => {
    // The decoder is fed chunk by chunk, so it must be a streaming decode — a
    // per-chunk `new TextDecoder().decode()` would turn a name like "Zoë" into
    // mojibake whenever the chunk boundary landed mid-character.
    const payload = JSON.stringify({ name: 'Zoë Ndlovu — Kanya' });
    const bytes = new TextEncoder().encode(payload);
    const request = new NextRequest(
      new Request('http://test/x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            // One byte at a time is the worst case and guarantees a split.
            for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
            controller.close();
          },
        }),
        duplex: 'half',
      } as RequestInit & { duplex: 'half' }),
    );

    const result = await readJsonBody(request, 1024);
    expect(result).toEqual({ ok: true, body: { name: 'Zoë Ndlovu — Kanya' } });
  });
});
