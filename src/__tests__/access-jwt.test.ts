import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  accessConfigFromEnv,
  resetAccessJwksCache,
  verifyAccessJwt,
  type AccessConfig,
} from '@/lib/internal/accessJwt';
import { makeAccessSigner, type AccessSigner } from './helpers/accessJwt';

const TEAM = 'capucor-test.cloudflareaccess.com';
const AUD = 'aud-tag-123';
const CONFIG: AccessConfig = { teamDomain: TEAM, aud: AUD };
const NOW = Date.UTC(2026, 9, 15, 10, 0, 0);
const nowS = NOW / 1000;

let signer: AccessSigner;

beforeEach(async () => {
  resetAccessJwksCache();
  signer = await makeAccessSigner('kid-1');
});

const claims = (over: Record<string, unknown> = {}) => ({
  iss: `https://${TEAM}`,
  aud: [AUD],
  email: 'zjak@capucor.com',
  iat: nowS - 10,
  nbf: nowS - 10,
  exp: nowS + 600,
  ...over,
});

describe('verifyAccessJwt', () => {
  it('accepts a valid Access token and returns the email', async () => {
    const token = await signer.sign(claims());
    expect(await verifyAccessJwt(token, CONFIG, { now: NOW, fetchImpl: signer.fetch })).toEqual({
      ok: true,
      email: 'zjak@capucor.com',
    });
  });

  it('fetches the team JWKS from the team domain', async () => {
    const token = await signer.sign(claims());
    await verifyAccessJwt(token, CONFIG, { now: NOW, fetchImpl: signer.fetch });
    expect(signer.fetch).toHaveBeenCalledWith(
      `https://${TEAM}/cdn-cgi/access/certs`,
      expect.anything(),
    );
  });

  const refusals: Array<[string, () => Promise<string | null>, string, AccessConfig | null]> = [
    ['missing token', async () => null, 'missing_token', CONFIG],
    ['empty token', async () => '', 'missing_token', CONFIG],
    ['not configured', async () => signer.sign(claims()), 'not_configured', null],
    ['garbage', async () => 'not.a.jwt', 'malformed', CONFIG],
    ['wrong audience', async () => signer.sign(claims({ aud: ['other-app'] })), 'bad_audience', CONFIG],
    ['wrong issuer', async () => signer.sign(claims({ iss: 'https://evil.cloudflareaccess.com' })), 'bad_issuer', CONFIG],
    ['expired', async () => signer.sign(claims({ exp: nowS - 120 })), 'expired', CONFIG],
    ['no exp', async () => signer.sign(claims({ exp: undefined })), 'expired', CONFIG],
    ['not yet valid', async () => signer.sign(claims({ nbf: nowS + 600 })), 'not_yet_valid', CONFIG],
    ['unknown key id', async () => signer.sign(claims(), { kid: 'kid-unknown' }), 'unknown_key', CONFIG],
    ['alg none', async () => signer.sign(claims(), { alg: 'none' }), 'bad_alg', CONFIG],
    ['HS256', async () => signer.sign(claims(), { alg: 'HS256' }), 'bad_alg', CONFIG],
  ];
  for (const [name, make, reason, config] of refusals) {
    it(`refuses: ${name}`, async () => {
      expect(await verifyAccessJwt(await make(), config, { now: NOW, fetchImpl: signer.fetch })).toEqual({
        ok: false,
        reason,
      });
    });
  }

  it('refuses a token signed by a different key under the same kid', async () => {
    const forger = await makeAccessSigner('kid-1');
    const token = await forger.sign(claims());
    expect(await verifyAccessJwt(token, CONFIG, { now: NOW, fetchImpl: signer.fetch })).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('refuses a tampered payload', async () => {
    const [h, , s] = (await signer.sign(claims())).split('.');
    const forged = Buffer.from(JSON.stringify(claims({ email: 'attacker@example.com' }))).toString('base64url');
    expect(
      await verifyAccessJwt(`${h}.${forged}.${s}`, CONFIG, { now: NOW, fetchImpl: signer.fetch }),
    ).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('fails closed when the JWKS cannot be fetched', async () => {
    const token = await signer.sign(claims());
    const down = vi.fn(async () => new Response('nope', { status: 503 })) as unknown as typeof fetch;
    expect(await verifyAccessJwt(token, CONFIG, { now: NOW, fetchImpl: down })).toEqual({
      ok: false,
      reason: 'jwks_unavailable',
    });
  });

  it('refetches for an unseen kid (key rotation), then caches', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(NOW);
      const t1 = await signer.sign(claims());
      await verifyAccessJwt(t1, CONFIG, { now: NOW, fetchImpl: signer.fetch });
      await signer.rotate('kid-2');
      vi.setSystemTime(NOW + 61_000);
      const t2 = await signer.sign(claims());
      expect((await verifyAccessJwt(t2, CONFIG, { now: NOW, fetchImpl: signer.fetch })).ok).toBe(true);
      expect((await verifyAccessJwt(t2, CONFIG, { now: NOW, fetchImpl: signer.fetch })).ok).toBe(true);
      expect(signer.fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('throttles forced refreshes: junk kids within a minute cause no extra fetches', async () => {
    const good = await signer.sign(claims());
    await verifyAccessJwt(good, CONFIG, { now: NOW, fetchImpl: signer.fetch });
    for (let i = 0; i < 5; i++) {
      const junk = await signer.sign(claims(), { kid: `junk-${i}` });
      expect(await verifyAccessJwt(junk, CONFIG, { now: NOW, fetchImpl: signer.fetch })).toEqual({
        ok: false,
        reason: 'unknown_key',
      });
    }
    expect(signer.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('accessConfigFromEnv', () => {
  it('reads the two env vars and normalises the team domain', () => {
    expect(
      accessConfigFromEnv({
        NODE_ENV: 'production',
        CF_ACCESS_TEAM_DOMAIN: 'https://capucor.cloudflareaccess.com/',
        CF_ACCESS_AUD: ' abc ',
      } as NodeJS.ProcessEnv),
    ).toEqual({ teamDomain: 'capucor.cloudflareaccess.com', aud: 'abc', certsUrl: undefined });
  });

  it('is null when either is missing (fail closed)', () => {
    expect(accessConfigFromEnv({ NODE_ENV: 'production', CF_ACCESS_AUD: 'x' } as NodeJS.ProcessEnv)).toBeNull();
    expect(accessConfigFromEnv({ NODE_ENV: 'production', CF_ACCESS_TEAM_DOMAIN: 'x' } as NodeJS.ProcessEnv)).toBeNull();
  });

  it('honours CF_ACCESS_CERTS_URL only when the override is allowed (next dev)', () => {
    const env = {
      CF_ACCESS_TEAM_DOMAIN: 't.cloudflareaccess.com',
      CF_ACCESS_AUD: 'a',
      CF_ACCESS_CERTS_URL: 'http://localhost:9999/certs',
    } as unknown as NodeJS.ProcessEnv;
    expect(accessConfigFromEnv(env, false)?.certsUrl).toBeUndefined();
    expect(accessConfigFromEnv(env, true)?.certsUrl).toBe('http://localhost:9999/certs');
  });

  it('defaults to no override outside next dev (the test runner is not development)', () => {
    const env = {
      CF_ACCESS_TEAM_DOMAIN: 't.cloudflareaccess.com',
      CF_ACCESS_AUD: 'a',
      CF_ACCESS_CERTS_URL: 'http://localhost:9999/certs',
    } as unknown as NodeJS.ProcessEnv;
    expect(process.env.NODE_ENV).not.toBe('development');
    expect(accessConfigFromEnv(env)?.certsUrl).toBeUndefined();
  });

});
