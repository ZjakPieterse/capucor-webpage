import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';
import {
  DataRequestSchema,
  LeadSchema,
  ProposalRequestSchema,
  SignProposalSchema,
} from '@/lib/validations';
import { CONSENT_VERSION, PRIVACY_POLICY_UPDATED } from '@/lib/consent';

// PRIVACY DRIFT GUARD (privacy notice v2, Zjak 2026-11-06).
//
// /privacy must describe what the site actually collects and who receives it
// (POPIA s18). These snapshots fail when a form starts collecting a new field,
// or the site starts loading or calling a new third-party host. If one fails:
//   1. update src/app/(site)/privacy/page.tsx to cover the change (and add a
//      cookie banner first if the new host sets cookies or tracks visitors);
//   2. bump CONSENT_VERSION and PRIVACY_POLICY_UPDATED in src/lib/consent.ts;
//   3. update the snapshot below, and the two values in the last test.
// Never update the snapshot alone.

function keys(schema: { shape: Record<string, unknown> }): string[] {
  return Object.keys(schema.shape).sort();
}

describe('privacy drift guard', () => {
  it('forms collect only the fields /privacy describes', () => {
    expect({
      lead: keys(LeadSchema),
      proposalRequest: keys(ProposalRequestSchema),
      signProposal: keys(SignProposalSchema),
      dataRequest: keys(DataRequestSchema),
    }).toMatchInlineSnapshot(`
      {
        "dataRequest": [
          "consent_given",
          "email",
          "request_type",
          "website",
        ],
        "lead": [
          "answers",
          "business",
          "config",
          "email",
          "message",
          "name",
          "phone",
          "source",
          "website",
        ],
        "proposalRequest": [
          "addons",
          "answers",
          "brackets",
          "businessName",
          "email",
          "firstName",
          "intent",
          "lastName",
          "services",
          "tierSlug",
          "website",
        ],
        "signProposal": [
          "authorityConfirmed",
          "clientLegalName",
          "clientRegistrationNumber",
          "consentGiven",
          "imageDataUrl",
          "method",
          "signatureName",
          "token",
          "website",
        ],
      }
    `);
  });

  it('the site loads and calls only the third-party hosts /privacy names', async () => {
    const rules = await nextConfig.headers!();
    const csp = rules
      .flatMap((r) => r.headers)
      .find((h) => h.key === 'Content-Security-Policy')!.value;
    const hosts = new Set<string>();
    for (const directive of csp.split(';')) {
      const [name, ...values] = directive.trim().split(/\s+/);
      if (!['script-src', 'connect-src', 'frame-src', 'child-src'].includes(name)) continue;
      for (const v of values) {
        // Supabase is called server-side only; its URL comes from the env.
        if (/^https:\/\/[^*]/.test(v) && !v.includes('supabase.co')) hosts.add(v);
      }
    }
    expect([...hosts].sort()).toEqual([
      'https://cloudflareinsights.com',
      'https://static.cloudflareinsights.com',
    ]);
  });

  it('the policy date is fixed, and the version matches this review', () => {
    const page = readFileSync(join(process.cwd(), 'src/app/(site)/privacy/page.tsx'), 'utf8');
    expect(page).not.toMatch(/new Date\(/);
    expect(page).toContain('PRIVACY_POLICY_UPDATED');
    expect({ CONSENT_VERSION, PRIVACY_POLICY_UPDATED }).toEqual({
      CONSENT_VERSION: 'v3',
      PRIVACY_POLICY_UPDATED: '6 November 2026',
    });
  });
});
