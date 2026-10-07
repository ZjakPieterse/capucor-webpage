import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';

// client_orgs.slug is unique (migration 004). Used here by provision-on-sign
// (PR9, provision.ts), which still runs on capucor.com when a client signs.
//
// Web-owned since 2026-10-07 (web-standalone phase 2) and deleted with
// provision.ts in phase 3. capucor-os keeps its own copy for its "Add client"
// flow. Both mint into the unique client_orgs.slug column; the collision suffix
// below handles a clash, so the two copies need not match.

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'client';
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

// Probe the base slug, then append a short random suffix on collision.
export async function findFreeSlug(admin: SupabaseClient<Database>, base: string): Promise<string> {
  let candidate = base;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await admin
      .from('client_orgs')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();
    if (!data) return candidate;
    candidate = `${base}-${randomSuffix()}`;
  }
  return `${base}-${randomSuffix()}${randomSuffix()}`;
}
