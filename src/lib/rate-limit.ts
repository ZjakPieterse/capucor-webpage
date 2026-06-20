// Per-IP token bucket. Backed by Cloudflare Workers KV in production (so the
// bucket survives worker cold starts), with an in-memory fallback for local
// dev and tests where no KV binding is available.
//
// To enable KV in production, add a binding named `RATE_LIMIT_KV` to
// wrangler.jsonc:
//
//   "kv_namespaces": [
//     { "binding": "RATE_LIMIT_KV", "id": "<created via: wrangler kv:namespace create RATE_LIMIT_KV>" }
//   ]
//
// Without the binding the limiter still works, but only within a single
// running Worker instance — fine for `next dev`, not for production load.

import { getCloudflareContext } from '@opennextjs/cloudflare';

const LIMIT = 10;
const WINDOW_MS = 10 * 60 * 1000;
const WINDOW_SECONDS = Math.floor(WINDOW_MS / 1000);

interface Bucket {
  count: number;
  resetAt: number;
}

// Minimal subset of KVNamespace we use — avoids depending on
// @cloudflare/workers-types globally.
interface RateLimitKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

const memoryStore = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

async function getKv(): Promise<RateLimitKV | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as unknown as { RATE_LIMIT_KV?: RateLimitKV }).RATE_LIMIT_KV ?? null;
  } catch {
    return null;
  }
}

function checkBucket(bucket: Bucket | null, now: number, limit: number): {
  next: Bucket;
  allowed: boolean;
  retryAfter: number;
} {
  if (!bucket || now > bucket.resetAt) {
    return {
      next: { count: 1, resetAt: now + WINDOW_MS },
      allowed: true,
      retryAfter: 0,
    };
  }
  if (bucket.count >= limit) {
    return {
      next: bucket,
      allowed: false,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return {
    next: { count: bucket.count + 1, resetAt: bucket.resetAt },
    allowed: true,
    retryAfter: 0,
  };
}

// `opts.key` namespaces the bucket so a different flow (e.g. proposal-page
// views) gets its own counter instead of sharing the default sign/leads bucket;
// `opts.limit` overrides the per-window cap for that bucket.
export async function checkRateLimit(
  ip: string,
  opts?: { key?: string; limit?: number },
): Promise<RateLimitResult> {
  const now = Date.now();
  const limit = opts?.limit ?? LIMIT;
  const ns = opts?.key ? `${opts.key}:` : '';
  const kv = await getKv();
  const key = `rl:${ns}${ip}`;

  if (kv) {
    const raw = await kv.get(key);
    let bucket: Bucket | null = null;
    if (raw) {
      try {
        bucket = JSON.parse(raw) as Bucket;
      } catch {
        // Corrupt KV value — treat as an empty bucket rather than crash
        // every request from this IP.
        bucket = null;
      }
    }
    const { next, allowed, retryAfter } = checkBucket(bucket, now, limit);

    if (allowed) {
      const remainingSeconds = Math.max(1, Math.ceil((next.resetAt - now) / 1000));
      // expirationTtl ≥ 60s minimum per Cloudflare KV; clamp accordingly.
      const ttl = Math.max(60, Math.min(remainingSeconds, WINDOW_SECONDS));
      await kv.put(key, JSON.stringify(next), { expirationTtl: ttl });
    }
    return { allowed, retryAfter };
  }

  // In-memory fallback. The KV binding exists in wrangler.jsonc, so landing
  // here in production means the binding is broken — buckets then only live
  // per isolate and the limit is effectively much looser.
  if (process.env.NODE_ENV === 'production') {
    console.warn('[RATE_LIMIT] RATE_LIMIT_KV unavailable; using per-isolate in-memory fallback');
  }
  const memKey = `${ns}${ip}`;
  const { next, allowed, retryAfter } = checkBucket(memoryStore.get(memKey) ?? null, now, limit);
  if (allowed) memoryStore.set(memKey, next);
  return { allowed, retryAfter };
}
