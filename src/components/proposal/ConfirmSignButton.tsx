'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Check, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';

// The confirm page renders read-only; the actual signature commit happens on
// this button's POST so an email link-scanner that prefetches the GET can't
// auto-sign. On success we show the portal sign-in path.
export function ConfirmSignButton({ ctoken }: { ctoken: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function confirm() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/proposals/sign/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ctoken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? 'We could not finalise your signature. Please try again.');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold">That&rsquo;s signed</p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your acceptance is recorded and your client portal is ready. Someone from the Capucor team
          will be in touch shortly to set up your onboarding.
        </p>
        <Button nativeButton={false} className="mt-5" render={<Link href="/login?next=/portal" />}>
          Sign in to your portal
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="button" onClick={confirm} disabled={submitting} className="gradient-cta w-full gap-2">
        <span className="relative z-[2] inline-flex items-center gap-2">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Finalising your signature...
            </>
          ) : (
            <>
              <PenLine className="h-4 w-4" />
              Confirm &amp; sign
            </>
          )}
        </span>
      </Button>
    </div>
  );
}
