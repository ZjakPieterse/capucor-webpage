import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';

// Cloudflare Web Analytics (technical review T07, Zjak 2026-10-08). The zone
// injects the beacon at the edge; without these sources the CSP blocked it on
// every page and the dashboard collected nothing.
async function csp(): Promise<Record<string, string[]>> {
  const rules = await nextConfig.headers!();
  const header = rules
    .flatMap((r) => r.headers)
    .find((h) => h.key === 'Content-Security-Policy');
  expect(header).toBeDefined();
  return Object.fromEntries(
    header!.value
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .map(([name, ...values]) => [name, values]),
  );
}

describe('Content-Security-Policy', () => {
  it('lets the Cloudflare Web Analytics beacon load and report', async () => {
    const d = await csp();
    expect(d['script-src']).toContain('https://static.cloudflareinsights.com');
    expect(d['connect-src']).toContain("'self'"); // automatic injection reports to /cdn-cgi/rum
    expect(d['connect-src']).toContain('https://cloudflareinsights.com');
  });

  it('adds nothing else to script-src: no eval, no wildcard', async () => {
    const d = await csp();
    expect(d['script-src']).toEqual(["'self'", "'unsafe-inline'", 'https://static.cloudflareinsights.com']);
  });
});
