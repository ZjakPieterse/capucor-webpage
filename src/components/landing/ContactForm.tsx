'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConsentCheckbox } from '@/components/ui/ConsentCheckbox';

export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
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
      setError('Please tick the consent box so we can reply.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source: 'contact',
          name: name.trim(),
          email: email.trim(),
          business: business.trim() || undefined,
          phone: phone.trim() || undefined,
          message: message.trim() || undefined,
          consent_given: true,
          website,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Could not send your message. Please try again.');
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 text-sm text-muted-foreground leading-relaxed">
        Thanks{name.trim() ? `, ${name.trim().split(' ')[0]}` : ''}. We&apos;ve got your
        message and will reply to{' '}
        <span className="text-foreground font-medium">{email.trim()}</span> within one working
        day.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="ct-name">Your name</Label>
        <Input
          id="ct-name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Thandi Nkosi"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ct-email">Email</Label>
          <Input
            id="ct-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.co.za"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ct-phone">
            Phone <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="ct-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="082 000 0000"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ct-business">
          Business name <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="ct-business"
          type="text"
          autoComplete="organization"
          value={business}
          onChange={(e) => setBusiness(e.target.value)}
          placeholder="Your company"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ct-message">
          What can we help with?{' '}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="ct-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="A line or two about your business and what you need."
          rows={3}
        />
      </div>

      <ConsentCheckbox id="ct-consent" checked={consent} onCheckedChange={setConsent} />

      {/* Honeypot — hidden from humans, visible to bots */}
      <div className="hidden" aria-hidden="true">
        <Label htmlFor="ct-website">Website</Label>
        <Input
          id="ct-website"
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

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" /> Sending…
          </>
        ) : (
          'Send message'
        )}
      </Button>
    </form>
  );
}
