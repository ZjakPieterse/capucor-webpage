import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { makeJsonRequest } from './helpers/request';

/**
 * Every public route must rate-limit into its OWN bucket.
 *
 * WHY THIS EXISTS. All six of these routes used to call `checkRateLimit(ip)`
 * with no key, so they shared a single `rl:<ip>` counter of 10 requests per 10
 * minutes. That put the contact form and the SIGNING of a legal proposal in the
 * same bucket: a visitor who resubmitted the contact form a few times, or
 * several people behind one office NAT, could exhaust the allowance that guards
 * the money path. Nothing failed loudly — the client just got a 429 while
 * trying to sign.
 *
 * These tests pin the two things that stop that coming back: every route passes
 * a key, and no two routes pass the SAME key. The rate limiter short-circuits
 * before any parsing or database work, so refusing the request is all the
 * mocking these need.
 */

vi.mock('server-only', () => ({}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: false, retryAfter: 42 })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('@/lib/email/sendEmail', () => ({ sendEmail: vi.fn() }));

import { checkRateLimit } from '@/lib/rate-limit';
import { POST as leadsPost } from '@/app/api/leads/route';
import { POST as dataRequestPost } from '@/app/api/data-request/route';
import { GET as dataRequestConfirmGet } from '@/app/api/data-request/confirm/route';
import { POST as proposalsPost } from '@/app/api/proposals/route';
import { POST as signPost } from '@/app/api/proposals/sign/route';
import { POST as signConfirmPost } from '@/app/api/proposals/sign/confirm/route';

/** Runs a route and returns the options object it handed the limiter. */
async function keyUsedBy(run: () => Promise<unknown>) {
  vi.mocked(checkRateLimit).mockClear();
  await run();
  expect(checkRateLimit).toHaveBeenCalledTimes(1);
  return vi.mocked(checkRateLimit).mock.calls[0][1];
}

const ROUTES: Array<{ name: string; run: () => Promise<unknown> }> = [
  {
    name: '/api/leads',
    run: () => leadsPost(makeJsonRequest('http://test/api/leads', {})),
  },
  {
    name: '/api/data-request',
    run: () => dataRequestPost(makeJsonRequest('http://test/api/data-request', {})),
  },
  {
    name: '/api/data-request/confirm',
    // A GET, so it cannot use makeJsonRequest (which always sends a POST body).
    run: () =>
      dataRequestConfirmGet(
        new NextRequest('http://test/api/data-request/confirm?token=x', {
          method: 'GET',
          headers: { 'x-forwarded-for': '203.0.113.1' },
        }),
      ),
  },
  {
    name: '/api/proposals',
    run: () => proposalsPost(makeJsonRequest('http://test/api/proposals', {})),
  },
  {
    name: '/api/proposals/sign',
    run: () => signPost(makeJsonRequest('http://test/api/proposals/sign', {})),
  },
  {
    name: '/api/proposals/sign/confirm',
    run: () =>
      signConfirmPost(makeJsonRequest('http://test/api/proposals/sign/confirm', {})),
  },
];

describe('rate-limit namespaces', () => {
  beforeEach(() => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfter: 42 });
  });

  it('1. every public route passes a rate-limit key', async () => {
    for (const route of ROUTES) {
      const opts = await keyUsedBy(route.run);
      expect(opts, `${route.name} called checkRateLimit with no options`).toBeDefined();
      expect(
        typeof opts?.key === 'string' && opts.key.length > 0,
        `${route.name} passed no key, so it shares the default bucket`,
      ).toBe(true);
    }
  });

  it('2. no two routes share a bucket', async () => {
    const keys: string[] = [];
    for (const route of ROUTES) {
      const opts = await keyUsedBy(route.run);
      keys.push(opts!.key as string);
    }
    expect(new Set(keys).size, `duplicate keys among ${keys.join(', ')}`).toBe(
      ROUTES.length,
    );
  });

  it('3. the signing path is the most generous, never the most contended', async () => {
    const limitFor = async (run: () => Promise<unknown>) =>
      ((await keyUsedBy(run))?.limit as number | undefined) ?? 10;

    const signLimit = await limitFor(ROUTES[4].run); // /api/proposals/sign
    const signConfirmLimit = await limitFor(ROUTES[5].run); // .../sign/confirm
    const leadsLimit = await limitFor(ROUTES[0].run);
    const proposalCreateLimit = await limitFor(ROUTES[3].run);

    // The whole point of the change: signing must not be the first thing to
    // run out. A regression that tightens it below a marketing form is exactly
    // the failure this suite exists to catch.
    expect(signLimit).toBeGreaterThan(leadsLimit);
    expect(signConfirmLimit).toBeGreaterThan(leadsLimit);
    expect(signLimit).toBeGreaterThanOrEqual(proposalCreateLimit);
    expect(signConfirmLimit).toBeGreaterThanOrEqual(proposalCreateLimit);
  });
});
