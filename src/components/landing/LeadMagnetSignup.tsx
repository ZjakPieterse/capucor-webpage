'use client';

import { useState } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConsentCheckbox } from '@/components/ui/ConsentCheckbox';

// Lead-magnet email capture. Built and wired (source='lead_magnet'), but kept
// dark behind the CONTACT_LEFT_TABS flag in src/config/homepage.ts until a real
// downloadable asset exists. When the asset is ready: drop the file under
// /public, point DOWNLOAD_HREF at it, finalise the copy, and flip the flag.
const DOWNLOAD_TITLE = 'The SME finance compliance calendar';
const DOWNLOAD_BLURB =
  'Every SARS, CIPC and payroll deadline that matters for a South African small business, on one page. We will email it to you.';

export function LeadMagnetSignup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!consent) {
      setError('Please tick the consent box so we can send it.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source: 'lead_magnet',
          name: name.trim(),
          email: email.trim(),
          message: `Requested: ${DOWNLOAD_TITLE}`,
          consent_given: true,
          website,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Could not send it. Please try again.');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send it. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground leading-relaxed">
        On its way. Check{' '}
        <span className="text-foreground font-medium">{email.trim()}</span> for the download.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="size-4" />
        </span>
        <div>
          <p className="font-medium">{DOWNLOAD_TITLE}</p>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{DOWNLOAD_BLURB}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="text"
            autoComplete="name"
            aria-label="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
          <Input
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.co.za"
          />
        </div>

        <ConsentCheckbox id="magnet-consent" checked={consent} onCheckedChange={setConsent} />

        {/* Honeypot */}
        <div className="hidden" aria-hidden="true">
          <label htmlFor="magnet-website">Website</label>
          <input
            id="magnet-website"
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
            'Send me the guide'
          )}
        </Button>
      </form>
    </div>
  );
}
