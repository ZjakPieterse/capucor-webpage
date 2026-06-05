'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, FileText, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConsentCheckbox } from '@/components/ui/ConsentCheckbox';

// Lead-magnet email capture (source='lead_magnet'). On success we record the
// lead and reveal the resource directly — DOWNLOAD_HREF points at the printable
// /resources/compliance-calendar page (which carries its own "save as PDF").
const DOWNLOAD_TITLE = 'The South African SME compliance calendar';
const DOWNLOAD_BLURB =
  'Every SARS, CIPC and payroll deadline that matters for a South African small business, on one page.';
const DOWNLOAD_HREF = '/resources/compliance-calendar';

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
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Thanks{name.trim() ? `, ${name.trim().split(' ')[0]}` : ''}. Here&apos;s your calendar —
          open it below, then use &ldquo;Print or save as PDF&rdquo; to keep a copy.
        </p>
        <Link
          href={DOWNLOAD_HREF}
          className="premium-button mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open your compliance calendar <ArrowRight className="size-4" />
        </Link>
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
            placeholder="Name and Surname"
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
              <Loader2 className="size-4 mr-2 animate-spin" /> Getting it…
            </>
          ) : (
            'Get the calendar'
          )}
        </Button>
      </form>
    </div>
  );
}
