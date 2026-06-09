import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import kvIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache';

// KV-backed incremental cache so `export const revalidate = N` on the public
// pages (/ and /pricing) actually persists between requests, and
// /api/revalidate?secret=... invalidates it after pricing edits in Supabase.
// Requires the NEXT_INC_CACHE_KV binding in wrangler.jsonc.
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});
