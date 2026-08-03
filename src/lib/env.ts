/**
 * Runtime environment contract.
 *
 * WHY. Cloudflare Worker secrets are set by hand in the dashboard and were
 * named nowhere in code. This Worker owns the entire revenue funnel — proposal
 * creation, signing, provision-on-sign, PDF archival — and several of its
 * failure modes are SILENT: the secret is absent, the guard skips the work, the
 * user sees a success state, and nothing is logged.
 *
 * The sibling repo learned this the hard way: capucor-os ran for two whole
 * phases with no Cloudflare secrets at all and every check stayed green,
 * because anonymous traffic returns early and never reaches the code that needs
 * them. See "Outstanding infrastructure" in ../capucor-os/AGENTS.md.
 *
 * BUILD-TIME vs RUNTIME. `NEXT_PUBLIC_*` are NOT listed here — they are inlined
 * into the bundle by `next build` and guarded by their own CI step. Everything
 * below is read from the Worker's secrets at request time, so a GitHub Actions
 * secret alone does NOT satisfy it.
 */

export interface RuntimeVar {
  name: string;
  /** What breaks when it is missing — surfaced in errors and in /api/health. */
  impact: string;
  /** false when absence degrades gracefully rather than breaking a surface. */
  required: boolean;
}

export const RUNTIME_VARS: RuntimeVar[] = [
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    impact:
      'createSupabaseAdminClient() throws. Breaks proposal creation, the signing flow and provision-on-sign — a client can sign and never get portal access.',
    required: true,
  },
  {
    name: 'RESEND_API_KEY',
    impact:
      'Every transactional email falls back to console logging. The proposal email, the signing confirmation and the owner billing cue all silently vanish while the site keeps reporting success.',
    required: true,
  },
  {
    name: 'REVALIDATE_SECRET',
    impact:
      'Guards /api/revalidate and both GitHub Actions crons (prune-leads, expire-proposals). Missing means pricing edits never refresh the ISR cache and stale proposals are never expired.',
    required: true,
  },
  {
    name: 'OWNER_NOTIFICATION_EMAIL',
    impact:
      'The internal reference copy of each new proposal and the billing-setup cue after provisioning have nowhere to go.',
    required: true,
  },
  {
    name: 'APPS_SCRIPT_PDF_URL',
    impact:
      'Signed-proposal PDF archival to the Drive "Engagements" folder SILENTLY NO-OPS (PR10). Signing and provisioning still work, so nothing looks wrong — but the executed engagement document, which is the debit-order mandate, is never filed.',
    required: true,
  },
  {
    name: 'APPS_SCRIPT_PDF_SECRET',
    impact: 'Same as APPS_SCRIPT_PDF_URL — archival silently no-ops without it.',
    required: true,
  },
];

/**
 * Read a required runtime variable, or throw naming it and where to set it.
 * Prefer this over a bare `process.env.X!` so the failure says what to do.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value) return value;

  const known = RUNTIME_VARS.find((v) => v.name === name);
  throw new Error(
    `Missing runtime environment variable ${name}. ` +
      `Set it as a Cloudflare Worker secret (Workers & Pages → capucor-web → Settings → ` +
      `Variables and Secrets, or \`wrangler secret put ${name}\`). ` +
      `GitHub Actions secrets are BUILD-time only and do not set this. ` +
      (known ? `Impact: ${known.impact}` : '')
  );
}

/** Presence-only report for /api/health. Never returns or logs a value. */
export function checkRuntimeEnv(): {
  ok: boolean;
  missing: string[];
  checks: Record<string, boolean>;
} {
  const checks: Record<string, boolean> = {};
  const missing: string[] = [];

  for (const v of RUNTIME_VARS) {
    const present = Boolean(process.env[v.name]);
    checks[v.name] = present;
    if (!present && v.required) missing.push(v.name);
  }

  return { ok: missing.length === 0, missing, checks };
}
