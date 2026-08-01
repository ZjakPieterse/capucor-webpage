import type { NextConfig } from "next";

// Supabase URL is read at build time and added to connect-src so the
// browser client (login, future portal queries) is permitted to call out.
// Falls back to 'self' only if the env var is missing — safer than a wide
// wildcard, but the build should always have it set.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

// Fail the build loudly in CI when the public Supabase env never reached
// `next build`. A missing URL silently breaks login on the deployed site:
// the CSP connect-src drops to bare 'self' and the browser Supabase client
// throws "Your project's URL and API key are required". A red build is far
// better than a green deploy of a broken site. Gated on CI so local dev and
// `preview:cf` (which may run without the env) are unaffected — GitHub
// Actions sets CI=true automatically.
if (process.env.CI && !SUPABASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is empty during a CI build. Refusing to build a " +
      "production bundle without the Supabase env — login would be broken on " +
      "the deployed site. Check the CI env wiring / repository secrets.",
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
// One Worker serves both hostnames; these redirects are what actually separate
// them. Host matching uses `has: [{ type: "host" }]`, which keeps this in the
// Next routing layer — deliberately avoiding a middleware.ts, since OpenNext
// bundling is the fragile part of this stack (see AGENTS.md deploy rules).
const MARKETING_ORIGIN = "https://capucor.com";
const APP_ORIGIN = "https://capucor.app";

const MARKETING_HOST = "capucor.com";
const APP_HOST = "capucor.app";

// Paths Capucor OS owns. Reached on capucor.com → bounce to capucor.app.
// Auth is here because a session cookie set on one eTLD+1 can never be read
// from the other, so login has to live on the domain that needs the session.
const APP_PATHS = [
  "/portal",
  "/portal/:path*",
  "/internal",
  "/internal/:path*",
  "/login",
  "/login/:path*",
  "/onboarding",
];

// Paths the marketing site owns. Reached on capucor.app → bounce to capucor.com.
//
// This list is explicit ON PURPOSE — do not "simplify" it into a catch-all with
// a negative lookahead like /:path((?!portal|internal|api|_next).*). That
// pattern fails catastrophically the moment the exclusion list misses something:
// redirecting /_next/static/* or /brand/logo-dark.png off capucor.app strips the
// CSS and logo from every portal page. This list fails gracefully instead — a
// new public page nobody adds here just stays reachable on both hosts, and the
// X-Robots-Tag below stops it being indexed there.
//
// ⚠️ Adding a new public/marketing page? Add its path here too.
const MARKETING_PATHS = [
  "/",
  "/pricing",
  "/accounting",
  "/bookkeeping",
  "/payroll",
  "/privacy",
  "/terms/engagement",
  "/resources/:path*",
  "/proposal/:path*",
];

// Note there is deliberately NO /api/* rule in either direction. A 301 on a
// POST downgrades it to GET and drops the body, and the API is genuinely
// dual-host today: /pricing on capucor.com posts to /api/proposals, while
// /internal/proposals/[id]/amend on capucor.app posts to /api/proposals/amend.
const hostRedirects = [
  // www → apex, both zones. First, so the apex rules below see a clean host.
  {
    source: "/:path*",
    has: [{ type: "host" as const, value: `www.${MARKETING_HOST}` }],
    destination: `${MARKETING_ORIGIN}/:path*`,
    permanent: true,
  },
  {
    source: "/:path*",
    has: [{ type: "host" as const, value: `www.${APP_HOST}` }],
    destination: `${APP_ORIGIN}/:path*`,
    permanent: true,
  },
  // Capucor OS paths asked for on the marketing domain.
  ...APP_PATHS.map((source) => ({
    source,
    has: [{ type: "host" as const, value: MARKETING_HOST }],
    destination: `${APP_ORIGIN}${source}`,
    permanent: true,
  })),
  // Marketing paths asked for on the app domain. Keeps every proposal link in
  // an already-sent email working — they were minted against capucor.app.
  ...MARKETING_PATHS.map((source) => ({
    source,
    has: [{ type: "host" as const, value: APP_HOST }],
    destination: `${MARKETING_ORIGIN}${source === "/" ? "" : source}`,
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
      // Capucor OS is an application, not a publication. Header rules are
      // additive, so this layers on top of SECURITY_HEADERS rather than
      // replacing it. Belt-and-braces with the redirects above: anything on
      // capucor.app that ISN'T redirected to the marketing domain (a page
      // missing from MARKETING_PATHS, the workers.dev URL) still can't be
      // indexed as duplicate content.
      {
        source: "/:path*",
        has: [{ type: "host", value: APP_HOST }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  async redirects() {
    return [
      ...hostRedirects,
      {
        // Absolute, so the legacy path resolves to the portal from either host.
        source: "/client-portal",
        destination: `${APP_ORIGIN}/portal`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
