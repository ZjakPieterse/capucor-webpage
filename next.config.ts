import type { NextConfig } from "next";

// Supabase URL is read at build time and added to connect-src so the
// browser client (login, future portal queries) is permitted to call out.
// Falls back to 'self' only if the env var is missing — safer than a wide
// wildcard, but the build should always have it set.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

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

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/client-portal",
        destination: "/portal",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
