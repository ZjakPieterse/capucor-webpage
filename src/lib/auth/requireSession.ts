import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Use from any server component or route handler that requires an
// authenticated portal user. getUser() revalidates the JWT against Supabase
// — getSession() only reads cookies and can be spoofed in middleware land.
export async function requireSession(): Promise<User> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect('/login');
  }

  return data.user;
}
