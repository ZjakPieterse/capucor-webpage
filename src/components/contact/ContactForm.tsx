'use client';

import { useState } from 'react';
import { CalendarClock, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConsentCheckbox } from '@/components/ui/ConsentCheckbox';
import { siteConfig } from '@/config/site';
import { CONTACT_QUESTIONS } from '@/config/contactQuestions';
import { cn } from '@/lib/utils';

type SingleKey = 'turnover' | 'teamSize' | 'booksNow' | 'mainReason';

// The booking link is rendered only in the sent state: every "Book a fit call"
// on the site lands here, and the answers come first (decision 2026-10-12).
export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [business, setBusiness] = useState('');
  const [single, setSingle] = useState<Partial<Record<SingleKey, string>>>({});
  const [services, setServices] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function toggleService(option: string) {
    setServices((cur) => {
      if (cur.includes(option)) return cur.filter((s) => s !== option);
      // "Not sure yet" and a named service contradict each other: picking one clears the other.
      if (option === 'Not sure yet') return [option];
      return [...cur.filter((s) => s !== 'Not sure yet'), option];
    });
  }

  function firstMissing(): string | null {
    if (!name.trim()) return 'Please enter your name.';
    if (!email.trim()) return 'Please enter your email address.';
    if (!business.trim()) return 'Please enter your business name.';
    if (!single.turnover) return 'Please pick your annual turnover.';
    if (!single.teamSize) return 'Please pick how many people are in the business.';
    if (services.length === 0) return 'Please pick at least one thing you need help with.';
    if (!single.booksNow) return 'Please tell us who does your books now.';
    if (!single.mainReason) return 'Please tell us what made you look now.';
    if (!consent) return 'Please tick the consent box so we can reply.';
    return null;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const missing = firstMissing();
    if (missing) {
      setError(missing);
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
          business: business.trim(),
          phone: phone.trim() || undefined,
          message: message.trim() || undefined,
          answers: { ...single, services },
          consent_given: true,
          website,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Could not send your answers. Please try again.');
      }
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'auto' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your answers. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const first = name.trim().split(' ')[0];
    return (
      <div className="space-y-5 text-center" role="status">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Check className="size-6" aria-hidden />
        </span>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Thanks{first ? `, ${first}` : ''}. Now pick a time.</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We&apos;ll read your answers before the fit call, so we can spend it on your business
            rather than on questions. Prefer email? We&apos;ll also reply to{' '}
            <span className="font-medium text-foreground">{email.trim()}</span>.
          </p>
        </div>
        <Button
          nativeButton={false}
          size="lg"
          className="gap-2"
          render={<a href={siteConfig.links.booking} target="_blank" rel="noopener noreferrer" />}
        >
          <CalendarClock className="h-4 w-4" /> Book your fit call
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <fieldset className="space-y-4">
        <legend className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">
          About you
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ct-name" label="Your name">
            <Input
              id="ct-name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name and surname"
            />
          </Field>
          <Field id="ct-business" label="Business name">
            <Input
              id="ct-business"
              type="text"
              autoComplete="organization"
              required
              value={business}
              onChange={(e) => setBusiness(e.target.value)}
              placeholder="Your company"
            />
          </Field>
          <Field id="ct-email" label="Email">
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
          </Field>
          <Field id="ct-phone" label="Phone" optional>
            <Input
              id="ct-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="082 000 0000"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-6">
        <legend className="mb-4 text-sm font-semibold uppercase tracking-widest text-primary">
          About your business
        </legend>
        <ChoiceGroup
          name="turnover"
          {...CONTACT_QUESTIONS.turnover}
          selected={single.turnover ? [single.turnover] : []}
          onPick={(v) => setSingle((s) => ({ ...s, turnover: v }))}
        />
        <ChoiceGroup
          name="teamSize"
          {...CONTACT_QUESTIONS.teamSize}
          selected={single.teamSize ? [single.teamSize] : []}
          onPick={(v) => setSingle((s) => ({ ...s, teamSize: v }))}
        />
        <ChoiceGroup
          name="services"
          multiple
          {...CONTACT_QUESTIONS.services}
          selected={services}
          onPick={toggleService}
        />
        <ChoiceGroup
          name="booksNow"
          {...CONTACT_QUESTIONS.booksNow}
          selected={single.booksNow ? [single.booksNow] : []}
          onPick={(v) => setSingle((s) => ({ ...s, booksNow: v }))}
        />
        <ChoiceGroup
          name="mainReason"
          {...CONTACT_QUESTIONS.mainReason}
          selected={single.mainReason ? [single.mainReason] : []}
          onPick={(v) => setSingle((s) => ({ ...s, mainReason: v }))}
        />
        <Field id="ct-message" label="Anything else we should know?" optional>
          <Textarea
            id="ct-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="A line or two about your business and what you need."
            rows={3}
          />
        </Field>
      </fieldset>

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

      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        {submitting ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" /> Sending…
          </>
        ) : (
          'Send and choose a time'
        )}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  optional,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="text-muted-foreground font-normal"> (optional)</span>}
      </Label>
      {children}
    </div>
  );
}

function ChoiceGroup({
  name,
  label,
  hint,
  options,
  selected,
  multiple,
  onPick,
}: {
  name: string;
  label: string;
  hint?: string;
  options: readonly string[];
  selected: string[];
  multiple?: boolean;
  onPick: (value: string) => void;
}) {
  const labelId = `ct-${name}-label`;
  return (
    <div className="space-y-2.5">
      <p id={labelId} className="text-sm font-medium">
        {label}
        {hint && <span className="text-muted-foreground font-normal"> {hint}</span>}
      </p>
      <div
        role={multiple ? 'group' : 'radiogroup'}
        aria-labelledby={labelId}
        className="flex flex-wrap gap-2"
      >
        {options.map((option) => {
          const on = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={on}
              onClick={() => onPick(option)}
              className={cn('choice-chip', on && 'choice-chip-on')}
            >
              {multiple && on && <Check className="size-3.5" aria-hidden />}
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
