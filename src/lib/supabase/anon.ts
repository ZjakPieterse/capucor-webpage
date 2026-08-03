import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/db';

// Cookieless anon Supabase client for reading PUBLIC data (pricing config —
// services, brackets, tiers — and testimonials) from the
// server. Unlike createSupabaseServerClient it does NOT attach the visitor's
// session, so reads always run as the `anon` role. This matters because the
// public pricing tables only grant `select to anon`: a signed-in visitor's
// session would run as the `authenticated` role, match no policy, and silently
// get zero rows. Public content must not depend on whether the visitor is
// signed in. Never use this for per-user/authenticated data — use the cookie-
// bound server client (server.ts) or the service-role client (admin.ts) there.

export function createSupabaseAnonClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'createSupabaseAnonClient: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY is not set'
    );
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
