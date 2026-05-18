import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Same-origin relative paths only — blocks `//evil.com` open-redirects.
function safeNext(raw: string | null): string {
  if (!raw) return '/portal';
  if (!raw.startsWith('/')) return '/portal';
  if (raw.startsWith('//')) return '/portal';
  return raw;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(
      new URL('/login?error=missing_code', url.origin)
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL('/login?error=auth_failed', url.origin)
    );
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
