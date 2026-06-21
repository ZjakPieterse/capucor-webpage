import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { InternalRole } from '@/lib/auth/requireInternal';

// Non-redirecting counterpart to requireInternal(). Resolves whether the current
// session belongs to a Capucor staff member, returning the internal_users row
// ({ role }) or null when there is no session, no email, or the user is not on
// the active allowlist. Unlike requireInternal() it never redirect()s — so it is
// safe to call from chrome shared by signed-in and signed-out states (e.g. the
// portal layout, which decides whether to surface an optional "Staff area" link).
//
// Same allowlist source as requireInternal: public.internal_users (migration
// 011), read via the service-role admin client because that table has RLS on with
// no session-readable policies. Use requireInternal() to *gate* an internal page;
// use this only to decide whether to *offer* an internal link.
export async function getInternalUser(): Promise<{ role: InternalRole } | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('internal_users')
    .select('role')
    .eq('email', user.email.toLowerCase())
    .eq('active', true)
    .maybeSingle();

  if (!data) return null;

  return { role: data.role as InternalRole };
}
