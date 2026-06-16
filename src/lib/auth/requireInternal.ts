import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type InternalRole = 'admin' | 'basic';

export interface InternalUser {
  /** auth.users id of the signed-in user. */
  id: string;
  email: string;
  role: InternalRole;
}

// Gate for the internal (staff) surfaces. Mirrors requireSession() but adds the
// email-allowlist check against public.internal_users (migration 011):
//
//   * Not signed in            → redirect to /login (carrying `next` so they land
//                                back here after auth).
//   * Signed in, not on the    → returns null (the caller renders a friendly
//     allowlist                   "not authorised" state — no redirect loop).
//   * Signed in + allowlisted  → returns { id, email, role }.
//
// The role lookup goes through the service-role admin client because
// internal_users has RLS on with no session-readable policies (the is_internal()
// RLS helpers gate the client-facing tables, not this allowlist itself).
export async function requireInternal(
  nextPath: string,
): Promise<InternalUser | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (!user.email) return null;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('internal_users')
    .select('role')
    .eq('email', user.email.toLowerCase())
    .eq('active', true)
    .maybeSingle();

  if (!data) return null;

  return { id: user.id, email: user.email, role: data.role as InternalRole };
}
