import type { NextConfig } from "next";

// Supabase URL is added to connect-src. Since Phase 3 of the OS split this repo
// has NO browser Supabase client — every query runs server-side (API routes,
// server components, lib/). The directive is kept because it costs nothing and
// keeps the header honest about the origin this app talks to; login moved to
// ../capucor-os along with the browser client.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Fail the build loudly in CI when the Supabase env never reached `next build`.
// The funnel (proposals, signing, leads, provision-on-sign) is entirely
// Supabase-backed, so a build without it deploys a site whose every form 500s.
// A red build is far better than a green deploy of a broken site. Gated on CI
// so local dev and `preview:cf` (which may run without the env) are unaffected
// — GitHub Actions sets CI=true automatically.
if (process.env.CI && !SUPABASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is empty during a CI build. Refusing to build a " +
      "production bundle without the Supabase env — the proposal funnel would " +
      "be broken on the deployed site. Check the CI env wiring / secrets.",
  );
}

const CSP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  // 'unsafe-inline' is needed for:
  //   - Next 16's inline hydration / RSC bootstrap scripts
  //   - The JSON-LD <script> on /
  // A nonce-based CSP would be tighter but requires middleware wiring;
  // park that as a future hardening pass.
  "script-src": ["'self'", "'unsafe-inline'"],
  // Tailwind v4 + Next inject inline style tags; unavoidable today.
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:", "blob:", "https:"],
  "font-src": ["'self'", "data:"],
  "connect-src": ["'self'", SUPABASE_URL].filter(Boolean),
  "frame-ancestors": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "object-src": ["'none'"],
};

const CONTENT_SECURITY_POLICY = [
  ...Object.entries(CSP_DIRECTIVES).map(([k, v]) => `${k} ${v.join(" ")}`),
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HSTS — only kicks in once served over HTTPS, harmless otherwise.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
];

// ---------------------------------------------------------------------------
// Domain seam — capucor.com (marketing) vs capucor.app (Capucor OS)
// ---------------------------------------------------------------------------
// SINCE PHASE 3 OF THE OS SPLIT, THIS WORKER SERVES capucor.com AND www ONLY.
// capucor.app is a separate repo (../capucor-os) on its own Worker, and it owns
// the mirror-image half of this table — the capucor.app→capucor.com rules that
// used to live here. Do not re-add them; they would be dead code on a hostname
// this Worker never sees, and editing them here would not affect capucor.app.
//
// What remains is one-directional: someone asks capucor.com for an OS path, we
// send them across. Host matching uses `has: [{ type: "host" }]`, which keeps
// this in the Next routing layer — deliberately avoiding a middleware.ts, since
// OpenNext bundling is the fragile part of this stack (see AGENTS.md).
const MARKETING_ORIGIN = "https://capucor.com";
const APP_ORIGIN = "https://capucor.app";

const MARKETING_HOST = "capucor.com";

// Paths Capucor OS owns. Reached on capucor.com → bounce to capucor.app.
// Auth is here because a session cookie set on one eTLD+1 can never be read
// from the other, so login has to live on the domain that needs the session.
// These paths no longer exist in this repo at all — the redirect is the only
// thing standing between an old bookmark and a 404.
const APP_PATHS = [
  "/portal",
  "/portal/:path*",
  "/internal",
  "/internal/:path*",
  "/login",
  "/login/:path*",
  "/onboarding",
];

// Note there is deliberately NO /api/* rule. A 301 on a POST downgrades it to
// GET and drops the body. This repo's API is now single-host (capucor.com), so
// there is nothing to route — but a blanket /api/* redirect would still be a
// trap for anyone who adds one later.
const hostRedirects = [
  // www → apex, ROOT ONLY.
  //
  // ⚠️ This rule must come before the catch-all below and must NOT be merged
  // into it. With `source: "/:path*"` and an ABSOLUTE destination, Next does
  // not substitute `:path*` when the path is empty — it emits the literal
  // string, so https://www.capucor.com/ 308'd to "https://capucor.com/:path*",
  // which is a 404. That shipped live and broke the bare www front door for
  // anyone who typed it without a path; every www URL WITH a path worked, which
  // is why it went unnoticed. Found 2026-08-03. See redirects.test.ts.
  {
    source: "/",
    has: [{ type: "host" as const, value: `www.${MARKETING_HOST}` }],
    destination: MARKETING_ORIGIN,
    permanent: true,
  },
  // www → apex, everything else.
  {
    source: "/:path*",
    has: [{ type: "host" as const, value: `www.${MARKETING_HOST}` }],
    destination: `${MARKETING_ORIGIN}/:path*`,
    permanent: true,
  },
  // Capucor OS paths asked for on the marketing domain.
  ...APP_PATHS.map((source) => ({
    source,
    has: [{ type: "host" as const, value: MARKETING_HOST }],
    destination: `${APP_ORIGIN}${source}`,
    permanent: true,
  })),
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      // The capucor.app noindex rule moved to ../capucor-os in Phase 3 — this
      // Worker no longer answers on that hostname, so a rule here could never
      // fire. capucor.com is the indexable domain by design.
    ];
  },
  async redirects() {
    return [
      ...hostRedirects,
      {
        // Legacy public path. Absolute, because the portal it points at is on
        // the other domain and in the other repo.
        source: "/client-portal",
        destination: `${APP_ORIGIN}/portal`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
