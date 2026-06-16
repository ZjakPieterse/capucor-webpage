import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { InternalRole, InternalUser } from '@/lib/auth/requireInternal';

export type InternalApiResult =
  | { ok: true; user: InternalUser }
  | { ok: false; response: NextResponse };

// API-route counterpart to requireInternal(). Route handlers can't redirect, so
// instead of sending a signed-out user to /login this returns a ready-made JSON
// error response the caller returns as-is:
//
//   * Not signed in / no email   → 401 (the session is missing or unusable).
//   * Signed in, not allowlisted → 403.
//   * opts.admin && role!=='admin'→ 403 (basic staff can read but not mutate).
//   * Signed in + allowed         → { ok: true, user }.
//
// Same allowlist source as requireInternal: public.internal_users (migration
// 011), read via the service-role admin client because that table has RLS on
// with no session-readable policies. Pass { admin: true } for mutation routes
// (amend/resend); the any-internal form (no opts) is here for PR13d's view-only
// internal reads.
export async function requireInternalApi(opts?: {
  admin?: boolean;
}): Promise<InternalApiResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Not signed in.' }, { status: 401 }),
    };
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('internal_users')
    .select('role')
    .eq('email', user.email.toLowerCase())
    .eq('active', true)
    .maybeSingle();

  if (!data) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Not authorised.' }, { status: 403 }),
    };
  }

  const role = data.role as InternalRole;
  if (opts?.admin && role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Admin access required.' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user: { id: user.id, email: user.email, role } };
}
