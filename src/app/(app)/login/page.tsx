import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Capucor client portal.',
  robots: { index: false },
};

interface LoginPageProps {
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
}

function safeNext(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return '/portal';
  if (!value.startsWith('/')) return '/portal';
  if (value.startsWith('//')) return '/portal';
  return value;
}

function errorMessage(raw: string | string[] | undefined): string | null {
  const code = Array.isArray(raw) ? raw[0] : raw;
  if (!code) return null;
  if (code === 'auth_failed') {
    return 'That sign-in link expired or was already used. Please request a new one below.';
  }
  if (code === 'missing_code') {
    return 'Sign-in link was incomplete. Please request a new one below.';
  }
  return 'Something went wrong signing in. Please try again.';
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next: nextParam, error: errorParam } = await searchParams;
  const next = safeNext(nextParam);
  const errorBanner = errorMessage(errorParam);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(next);
  }

  return (
    <div className="min-h-[calc(100vh-12rem)] flex items-center justify-center px-6 py-12 lg:py-16">
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Capucor client portal
          </p>
          <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Welcome back. Choose how you&rsquo;d like to continue.
          </p>
        </header>

        <div className="rounded-xl border border-border bg-card p-6 lg:p-8">
          {errorBanner && (
            <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorBanner}
            </div>
          )}
          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Not a client yet?{' '}
          <a
            href={`${siteConfig.marketingUrl}/pricing`}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Build your subscription
          </a>
          .
        </p>
      </div>
    </div>
  );
}
