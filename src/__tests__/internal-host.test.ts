import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const headerStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => headerStore.get(k.toLowerCase()) ?? null }),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  },
  forbidden: () => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;403');
  },
}));

import nextConfig from '../../next.config';
import { SITEMAP_PATHS } from '@/config/sitemap';
import { resetAccessJwksCache } from '@/lib/internal/accessJwt';
import { INTERNAL_HOST, INTERNAL_PATH_PREFIX } from '@/lib/internal/host';
import { guardInternalApi, requireInternalPage } from '@/lib/internal/guard';
import { makeAccessSigner, type AccessSigner } from './helpers/accessJwt';

const TEAM = 'capucor-test.cloudflareaccess.com';
const AUD = 'aud-tag-123';

let signer: AccessSigner;
let goodToken: string;

beforeEach(async () => {
  resetAccessJwksCache();
  headerStore.clear();
  signer = await makeAccessSigner('kid-1');
  vi.stubGlobal('fetch', signer.fetch);
  vi.stubEnv('CF_ACCESS_TEAM_DOMAIN', TEAM);
  vi.stubEnv('CF_ACCESS_AUD', AUD);
  const now = Math.floor(Date.now() / 1000);
  goodToken = await signer.sign({
    iss: `https://${TEAM}`,
    aud: [AUD],
    email: 'zjak@capucor.com',
    iat: now,
    exp: now + 600,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const apiReq = (host: string, token?: string) =>
  new Request(`https://${host}/api/internal-tools/anything`, {
    headers: { host, ...(token ? { 'cf-access-jwt-assertion': token } : {}) },
  });

describe('internal routes on any other host → 404', () => {
  for (const host of ['capucor.com', 'www.capucor.com', 'capucor.app', 'evil.example', '']) {
    it(`page on "${host}" 404s, even with a valid Access token`, async () => {
      headerStore.set('host', host);
      headerStore.set('cf-access-jwt-assertion', goodToken);
      await expect(requireInternalPage()).rejects.toThrow(/;404/);
    });
    it(`API on "${host}" 404s, even with a valid Access token`, async () => {
      const res = await guardInternalApi(apiReq(host || 'x', goodToken));
      expect(res?.status).toBe(404);
    });
  }
});

describe('internal host without a valid Access JWT → 403', () => {
  it('missing token → page 403, API 403', async () => {
    headerStore.set('host', INTERNAL_HOST);
    await expect(requireInternalPage()).rejects.toThrow(/;403/);
    expect((await guardInternalApi(apiReq(INTERNAL_HOST)))?.status).toBe(403);
  });

  it('forged token → page 403, API 403', async () => {
    const forger = await makeAccessSigner('kid-1');
    const bad = await forger.sign({ iss: `https://${TEAM}`, aud: [AUD], exp: 9999999999 });
    headerStore.set('host', INTERNAL_HOST);
    headerStore.set('cf-access-jwt-assertion', bad);
    await expect(requireInternalPage()).rejects.toThrow(/;403/);
    expect((await guardInternalApi(apiReq(INTERNAL_HOST, bad)))?.status).toBe(403);
  });

  it('Access env not set → 403 (fails closed)', async () => {
    vi.stubEnv('CF_ACCESS_AUD', '');
    headerStore.set('host', INTERNAL_HOST);
    headerStore.set('cf-access-jwt-assertion', goodToken);
    await expect(requireInternalPage()).rejects.toThrow(/;403/);
  });
});

describe('internal host with a valid Access JWT', () => {
  it('lets the page and the API through', async () => {
    headerStore.set('host', INTERNAL_HOST);
    headerStore.set('cf-access-jwt-assertion', goodToken);
    await expect(requireInternalPage()).resolves.toEqual({ email: 'zjak@capucor.com' });
    expect(await guardInternalApi(apiReq(INTERNAL_HOST, goodToken))).toBeNull();
  });
});

describe('next.config.ts routing for the internal host', () => {
  it('rewrites only on the internal host, onto the internal path', async () => {
    const rw = await nextConfig.rewrites!();
    const before = (Array.isArray(rw) ? rw : rw.beforeFiles) ?? [];
    expect(before.length).toBeGreaterThan(0);
    for (const r of before) {
      expect(r.has).toEqual([{ type: 'host', value: INTERNAL_HOST }]);
      expect(r.destination.startsWith(INTERNAL_PATH_PREFIX)).toBe(true);
    }
  });

  it('marks every internal-host response noindex', async () => {
    const hs = await nextConfig.headers!();
    const rule = hs.find((h) => h.has?.some((c) => c.type === 'host' && c.value === INTERNAL_HOST));
    expect(rule?.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' });
  });

  it('enables forbidden() (authInterrupts)', () => {
    expect(nextConfig.experimental?.authInterrupts).toBe(true);
  });

  it('keeps internal pages out of the sitemap', () => {
    expect(SITEMAP_PATHS.some((p) => p.path.startsWith(INTERNAL_PATH_PREFIX))).toBe(false);
  });

  it('adds no redirect that touches the internal host or path', async () => {
    const rs = await nextConfig.redirects!();
    for (const r of rs) {
      expect(r.source.startsWith(INTERNAL_PATH_PREFIX)).toBe(false);
      expect(r.has?.some((c) => c.type === 'host' && c.value === INTERNAL_HOST) ?? false).toBe(false);
    }
  });
});
