import type { SupabaseClient } from '@supabase/supabase-js';

// client_orgs.slug is unique (migration 004). Shared by provision-on-sign (PR9,
// provision.ts) and the admin "Add client" create flow (internal/clients/actions.ts)
// so both mint slugs identically.

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
export async function findFreeSlug(admin: SupabaseClient, base: string): Promise<string> {
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
