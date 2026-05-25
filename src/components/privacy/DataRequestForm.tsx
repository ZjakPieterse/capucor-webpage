'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DATA_REQUEST_SLA_DAYS } from '@/lib/consent';

type RequestType = 'access' | 'delete';

export function DataRequestForm() {
  const [email, setEmail] = useState('');
  const [requestType, setRequestType] = useState<RequestType>('access');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!consent) {
      setError('You must confirm before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/data-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          request_type: requestType,
          consent_given: true,
          website,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Could not submit your request.');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground leading-relaxed">
        Thanks. If that email is on file we have sent a confirmation link to{' '}
        <span className="text-foreground font-medium">{email}</span>. Click it within 24 hours to verify your request. We will respond within {DATA_REQUEST_SLA_DAYS} days of confirmation.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="dr-email">Your email</Label>
        <Input
          id="dr-email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Request type</legend>
        <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="radio"
              name="request_type"
              value="access"
              checked={requestType === 'access'}
              onChange={() => setRequestType('access')}
              className="accent-primary"
            />
            Access — send me a copy of my data
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="radio"
              name="request_type"
              value="delete"
              checked={requestType === 'delete'}
              onChange={() => setRequestType('delete')}
              className="accent-primary"
            />
            Delete — erase my data
          </label>
        </div>
      </fieldset>

      <div className="flex items-start gap-3">
        <Checkbox
          id="dr-consent"
          checked={consent}
          onCheckedChange={(val) => setConsent(val === true)}
          className="mt-0.5"
        />
        <Label htmlFor="dr-consent" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
          I confirm this email address is mine and I am the data subject making this request.
        </Label>
      </div>

      {/* Honeypot — hidden from humans, visible to bots */}
      <div className="hidden" aria-hidden="true">
        <Label htmlFor="dr-website">Website</Label>
        <Input
          id="dr-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" /> Sending…
          </>
        ) : (
          'Submit request'
        )}
      </Button>
    </form>
  );
}
