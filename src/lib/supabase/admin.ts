import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';

// Service-role Supabase client for server-only writes (portal mutations,
// provision-on-sign, Karbon sync, Xero sync). Bypasses RLS — never import
// from any module that ships to the browser.

export function createSupabaseAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      'createSupabaseAdminClient: NEXT_PUBLIC_SUPABASE_URL is not set'
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      'createSupabaseAdminClient: SUPABASE_SERVICE_ROLE_KEY is not set. ' +
        'Refusing to fall back to the anon key — service-role writes would silently fail RLS.'
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
