import { describe, it, expect } from 'vitest';
import nextConfig from '../../next.config';

// This repo's half of the domain seam (capucor.com → capucor.app) had NO test
// at all until 2026-08-03, while ../capucor-os has guarded its half since
// Phase 1c. The table has no type-level guard and no runtime consumer that
// fails loudly, so these assertions are the only thing between an edit and a
// silently broken production route. The gap was not theoretical: the www→apex
// rule shipped a live 404 on https://www.capucor.com/ (see below).
//
// Every case is a real failure mode, not a restatement of the config.

const MARKETING_HOST = 'capucor.com';
const APP_ORIGIN = 'https://capucor.app';

type Redirect = Awaited<ReturnType<NonNullable<typeof nextConfig.redirects>>>[number];

async function getRedirects(): Promise<Redirect[]> {
  return nextConfig.redirects!();
}

function hostOf(rule: Redirect): string | undefined {
  return rule.has?.find((h) => h.type === 'host')?.value;
}

describe('capucor.com redirect table', () => {
  it('redirects www.capucor.com to the apex, including the bare root', async () => {
    const wwwRules = (await getRedirects()).filter(
      (r) => hostOf(r) === `www.${MARKETING_HOST}`
    );

    // TWO rules, not one. `source: '/:path*'` with an ABSOLUTE destination does
    // not substitute the param when the path is empty — Next emits the literal
    // "https://capucor.com/:path*", which 404s. That was live: typing
    // www.capucor.com (the front door) landed on a 404, while every www URL
    // WITH a path worked, which is why nobody caught it. Do not collapse these
    // back into a single catch-all.
    const root = wwwRules.find((r) => r.source === '/');
    expect(root, 'www root rule is missing — https://www.capucor.com/ will 404').toBeDefined();
    expect(root!.destination).toBe(`https://${MARKETING_HOST}`);
    expect(root!.destination).not.toContain(':path');

    const rest = wwwRules.find((r) => r.source === '/:path*');
    expect(rest, 'www catch-all rule is missing').toBeDefined();
    expect(rest!.destination).toBe(`https://${MARKETING_HOST}/:path*`);

    // Order matters: the root rule must be evaluated first.
    expect(wwwRules.indexOf(root!)).toBeLessThan(wwwRules.indexOf(rest!));
  });

  it('sends every OS path to capucor.app', async () => {
    // These routes no longer exist in this repo at all (Phase 3 deleted them),
    // so the redirect is the only thing between an old bookmark and a 404.
    const rules = await getRedirects();
    for (const path of ['/portal', '/internal', '/login', '/onboarding']) {
      const rule = rules.find((r) => r.source === path && hostOf(r) === MARKETING_HOST);
      expect(rule, `${path} is missing from APP_PATHS`).toBeDefined();
      expect(rule!.destination).toBe(`${APP_ORIGIN}${path}`);
    }
  });

  it('carries sub-paths across too', async () => {
    // /portal alone is not enough — /portal/billing must cross as well.
    const rules = await getRedirects();
    for (const path of ['/portal/:path*', '/internal/:path*', '/login/:path*']) {
      const rule = rules.find((r) => r.source === path && hostOf(r) === MARKETING_HOST);
      expect(rule, `${path} is missing from APP_PATHS`).toBeDefined();
    }
  });

  it('keeps the legacy /client-portal path pointing at the real portal', async () => {
    const rule = (await getRedirects()).find((r) => r.source === '/client-portal');
    expect(rule).toBeDefined();
    expect(rule!.destination).toBe(`${APP_ORIGIN}/portal`);
  });

  it('never redirects /api', async () => {
    // A 301 on a POST downgrades it to GET and drops the body. This repo owns
    // the whole signing funnel (/api/proposals/sign*), so an /api rule here
    // would silently break provision-on-sign.
    for (const rule of await getRedirects()) {
      expect(rule.source.startsWith('/api'), `${rule.source} redirects /api`).toBe(false);
    }
  });

  it('has no catch-all on the apex host', async () => {
    // The www rule is the only legitimate catch-all. A catch-all on capucor.com
    // itself would swallow /_next/static and /brand and strip the CSS and logo
    // off every marketing page.
    const apexCatchAll = (await getRedirects()).find(
      (r) => r.source === '/:path*' && hostOf(r) === MARKETING_HOST
    );
    expect(
      apexCatchAll,
      'a catch-all on the apex would swallow /api, /_next and /brand'
    ).toBeUndefined();
  });

  it('does not re-add the capucor.app half of the seam', async () => {
    // capucor-os owns capucor.app→capucor.com. Duplicating it here would be
    // dead code on a hostname this Worker never answers on, and would read as
    // authoritative to the next person editing the table.
    for (const rule of await getRedirects()) {
      expect(hostOf(rule)).not.toBe('capucor.app');
      expect(hostOf(rule)).not.toBe('www.capucor.app');
    }
  });

  it('keeps /proposal on this domain', async () => {
    // The signing document lives here. A rule sending it to capucor.app would
    // break every outstanding proposal link, and capucor-os bounces it back —
    // an infinite redirect across the seam.
    for (const rule of await getRedirects()) {
      expect(rule.source.startsWith('/proposal'), `${rule.source} moves the signing document`).toBe(
        false
      );
    }
  });
});
