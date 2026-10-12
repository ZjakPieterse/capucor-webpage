'use client';

import { useState } from 'react';
import { CalendarClock, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConsentCheckbox } from '@/components/ui/ConsentCheckbox';
import { siteConfig } from '@/config/site';
import { CONTACT_QUESTIONS } from '@/config/contactQuestions';
import { cn } from '@/lib/utils';

type SingleKey = 'turnover' | 'teamSize' | 'booksNow';

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
    if (!single.booksNow) return 'Please tell us who does your books now.';
    if (services.length === 0) return 'Please pick at least one thing you need help with.';
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
        {(['turnover', 'teamSize', 'booksNow'] as const).map((key) => (
          <SelectField
            key={key}
            id={`ct-${key}`}
            {...CONTACT_QUESTIONS[key]}
            value={single[key]}
            onChange={(v) => setSingle((s) => ({ ...s, [key]: v }))}
          />
        ))}
        <ServiceChecklist {...CONTACT_QUESTIONS.services} selected={services} onToggle={toggleService} />
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

function SelectField({
  id,
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  options: readonly string[];
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value ?? ''}
        onValueChange={(v) => onChange(String(v))}
        items={Object.fromEntries(options.map((o) => [o, o]))}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent align="start" className="rounded-xl p-1.5">
          {options.map((option) => (
            <SelectItem key={option} value={option} className="rounded-lg py-2 pl-3 pr-9">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// A checkbox card per service, two to a row from sm up (modelled on the
// multi-select on uppitai.com/contact, Zjak 2026-10-12).
function ServiceChecklist({
  label,
  hint,
  options,
  selected,
  onToggle,
}: {
  label: string;
  hint: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="space-y-2.5" role="group" aria-labelledby="ct-services-label">
      <p id="ct-services-label" className="text-sm font-medium">
        {label} <span className="text-muted-foreground font-normal">{hint}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option, i) => {
          const id = `ct-service-${i}`;
          const on = selected.includes(option);
          return (
            <label key={option} htmlFor={id} className={cn('check-card', on && 'check-card-on')}>
              <Checkbox id={id} checked={on} onCheckedChange={() => onToggle(option)} />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
