'use client';

import { useState } from 'react';
import { Loader2, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignedMoment } from './SignedMoment';

// The confirm page renders read-only; the actual signature commit happens on
// this button's POST so an email link-scanner that prefetches the GET can't
// auto-sign. On success we say we will be in touch (no portal link).
export function ConfirmSignButton({ ctoken }: { ctoken: string }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<{
    deliveryStatus: 'accepted' | 'pending';
  } | null>(null);

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
      setCompletion({
        deliveryStatus: data.deliveryStatus === 'accepted' ? 'accepted' : 'pending',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (completion) {
    return (
      <SignedMoment
        title="That’s signed"
        deliveryPending={completion.deliveryStatus === 'pending'}
      />
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="button" size="lg" onClick={confirm} disabled={submitting} className="gradient-cta w-full gap-2">
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
