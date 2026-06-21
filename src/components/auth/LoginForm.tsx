'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const EmailSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type EmailValues = z.infer<typeof EmailSchema>;

interface LoginFormProps {
  next: string;
}

export function LoginForm({ next }: LoginFormProps) {
  const [oauthLoading, setOauthLoading] = useState(false);
  const [otpSubmitted, setOtpSubmitted] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailValues>({
    resolver: zodResolver(EmailSchema),
    defaultValues: { email: '' },
  });

  function buildCallback() {
    const url = new URL('/login/callback', window.location.origin);
    if (next && next !== '/portal') {
      url.searchParams.set('next', next);
    }
    return url.toString();
  }

  async function handleGoogle() {
    setServerError(null);
    setOauthLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: buildCallback() },
    });
    if (error) {
      setServerError(error.message);
      setOauthLoading(false);
    }
    // On success the browser navigates away to Google — keep the spinner up.
  }

  async function handleOtp(values: EmailValues) {
    setServerError(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: { emailRedirectTo: buildCallback() },
    });
    if (error) {
      setServerError(error.message);
      return;
    }
    setOtpSubmitted(values.email);
  }

  if (otpSubmitted) {
    return (
      <div className="text-center space-y-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-success/15 mx-auto">
          <CheckCircle className="h-5 w-5 text-success" />
        </div>
        <h2 className="text-base font-semibold">Check your email</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We sent a sign-in link to{' '}
          <span className="font-medium text-foreground">{otpSubmitted}</span>. Click it on this device to open the portal. No password needed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2.5"
        onClick={handleGoogle}
        disabled={oauthLoading || isSubmitting}
      >
        {oauthLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        Continue with Google
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          or
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit(handleOtp)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email address</Label>
          <Input
            id="login-email"
            type="email"
            placeholder="you@company.co.za"
            autoComplete="email"
            inputMode="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>

        {serverError && <p className="text-sm text-destructive">{serverError}</p>}

        <Button
          type="submit"
          className="w-full gap-2"
          disabled={isSubmitting || oauthLoading}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending link…
            </>
          ) : (
            <>
              <Mail className="h-4 w-4" />
              Email me a sign-in link
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 5c1.6 0 3 .55 4.12 1.62l3.08-3.08C17.46 1.66 14.97.5 12 .5 7.32.5 3.27 3.17 1.3 7.06l3.6 2.79C5.86 7.07 8.71 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.66-.21-2.45H12v4.63h6.46c-.28 1.5-1.13 2.78-2.41 3.63l3.71 2.86c2.17-2 3.74-4.93 3.74-8.67z"
      />
      <path
        fill="#FBBC05"
        d="M4.9 14.85a7 7 0 010-5.7l-3.6-2.79A12.42 12.42 0 00.5 12c0 1.99.48 3.88 1.3 5.54l3.1-2.69z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c3.24 0 5.95-1.07 7.93-2.91l-3.7-2.86c-1.03.69-2.36 1.1-4.23 1.1-3.28 0-6.06-2.21-7.05-5.18l-3.6 2.79C3.27 20.32 7.32 23.5 12 23.5z"
      />
    </svg>
  );
}
