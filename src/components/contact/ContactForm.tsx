'use client';

import { useState } from 'react';
import { CalendarClock, Check, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConsentCheckbox } from '@/components/ui/ConsentCheckbox';
import { siteConfig } from '@/config/site';
import { CONTACT_QUESTIONS, type NextStep } from '@/config/contactQuestions';
import { cn } from '@/lib/utils';

type SingleKey = 'turnover' | 'teamSize' | 'booksNow';
type FieldKey = 'firstName' | 'lastName' | 'business' | 'email' | SingleKey | 'services' | 'consent';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Form order, used to focus the first field in error.
const FIELD_IDS: Record<FieldKey, string> = {
  firstName: 'ct-first-name',
  lastName: 'ct-last-name',
  business: 'ct-business',
  email: 'ct-email',
  turnover: 'ct-turnover',
  teamSize: 'ct-teamSize',
  booksNow: 'ct-booksNow',
  services: 'ct-service-0',
  consent: 'ct-consent',
};

// Every "Book a fit call" on the site lands here, and the answers come first
// (decision 2026-10-12). Two ways out (Zjak, 2026-10-13): "Send message" stays
// on the page; "Book a meeting" saves the same lead, then goes to the booking
// page. The buttons are always live; a click with gaps marks the required
// fields in red instead.
export function ContactForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [single, setSingle] = useState<Partial<Record<SingleKey, string>>>({});
  const [services, setServices] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState<NextStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<NextStep | null>(null);

  function toggleService(option: string) {
    setServices((cur) => {
      if (cur.includes(option)) return cur.filter((s) => s !== option);
      // "Not sure yet" and a named service contradict each other: picking one clears the other.
      if (option === 'Not sure yet') return [option];
      return [...cur.filter((s) => s !== 'Not sure yet'), option];
    });
  }

  // Everything but "Anything else we should know?" is required. Recomputed on
  // every render, so a red field clears as soon as it is filled.
  function validate(): Partial<Record<FieldKey, string>> {
    const e: Partial<Record<FieldKey, string>> = {};
    if (!firstName.trim()) e.firstName = 'Please enter your first name.';
    if (!lastName.trim()) e.lastName = 'Please enter your last name.';
    if (!business.trim()) e.business = 'Please enter your business name.';
    if (!email.trim()) e.email = 'Please enter your email address.';
    else if (!EMAIL_RE.test(email.trim())) e.email = 'Please enter a valid email address.';
    for (const key of ['turnover', 'teamSize', 'booksNow'] as const) {
      if (!single[key]) e[key] = 'Please choose an option.';
    }
    if (services.length === 0) e.services = 'Please pick at least one.';
    if (!consent) e.consent = 'Please tick the consent box so we can reply.';
    return e;
  }

  const errors = showErrors ? validate() : {};

  async function send(nextStep: NextStep) {
    if (submitting) return;
    setError(null);
    const found = validate();
    const firstBad = (Object.keys(FIELD_IDS) as FieldKey[]).find((k) => found[k]);
    if (firstBad) {
      setShowErrors(true);
      setError('Please complete the fields marked in red.');
      document.getElementById(FIELD_IDS[firstBad])?.focus();
      return;
    }

    setSubmitting(nextStep);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          source: 'contact',
          name: `${firstName.trim()} ${lastName.trim()}`,
          email: email.trim(),
          business: business.trim(),
          message: message.trim() || undefined,
          answers: { ...single, services, nextStep },
          consent_given: true,
          website,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Could not send your answers. Please try again.');
      }
      setDone(nextStep);
      window.scrollTo({ top: 0, behavior: 'auto' });
      // The lead is saved; only now does the visitor reach the calendar.
      if (nextStep === 'meeting') window.location.assign(siteConfig.links.booking);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your answers. Please try again.');
    } finally {
      setSubmitting(null);
    }
  }

  if (done) {
    const first = firstName.trim();
    return (
      <div className="space-y-5 text-center" role="status">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Check className="size-6" aria-hidden />
        </span>
        {done === 'meeting' ? (
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Thanks{first ? `, ${first}` : ''}. Opening the calendar…</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We&apos;ll read your answers before the fit call. If the booking page does not open,{' '}
              <a href={siteConfig.links.booking} className="text-primary underline underline-offset-2">
                pick a time here
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Thanks{first ? `, ${first}` : ''}. Your message is in.</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              We&apos;ll get back to you at{' '}
              <span className="font-medium text-foreground">{email.trim()}</span>.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-8" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="ct-first-name" label="First Name" error={errors.firstName}>
          <Input
            id="ct-first-name"
            type="text"
            autoComplete="given-name"
            required
            maxLength={50}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            {...invalid('ct-first-name', errors.firstName)}
          />
        </Field>
        <Field id="ct-last-name" label="Last Name" error={errors.lastName}>
          <Input
            id="ct-last-name"
            type="text"
            autoComplete="family-name"
            required
            maxLength={49}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            {...invalid('ct-last-name', errors.lastName)}
          />
        </Field>
        <Field id="ct-business" label="Business Name" error={errors.business}>
          <Input
            id="ct-business"
            type="text"
            autoComplete="organization"
            required
            maxLength={100}
            value={business}
            onChange={(e) => setBusiness(e.target.value)}
            {...invalid('ct-business', errors.business)}
          />
        </Field>
        <Field id="ct-email" label="Email" error={errors.email}>
          <Input
            id="ct-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.co.za"
            {...invalid('ct-email', errors.email)}
          />
        </Field>
      </div>

      <div className="space-y-6">
        {(['turnover', 'teamSize', 'booksNow'] as const).map((key) => (
          <SelectField
            key={key}
            id={`ct-${key}`}
            {...CONTACT_QUESTIONS[key]}
            value={single[key]}
            onChange={(v) => setSingle((s) => ({ ...s, [key]: v }))}
            error={errors[key]}
          />
        ))}
        <ServiceChecklist
          {...CONTACT_QUESTIONS.services}
          selected={services}
          onToggle={toggleService}
          error={errors.services}
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
      </div>

      <ConsentCheckbox id="ct-consent" checked={consent} onCheckedChange={setConsent} error={errors.consent} />

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

      {/* Premium fill for "Send message", plain outline for "Book a meeting"
          (Zjak, 2026-10-13); the same pair as the hero CTAs. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          size="lg"
          disabled={!!submitting}
          onClick={() => send('message')}
          className="gradient-cta w-full"
        >
          <span className="relative z-[2] inline-flex items-center gap-2">
            {submitting === 'message' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            Send message
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={!!submitting}
          onClick={() => send('meeting')}
          className="w-full"
        >
          {submitting === 'meeting' ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <CalendarClock className="size-4" aria-hidden />
          )}
          Book a meeting
        </Button>
      </div>
    </form>
  );
}

function invalid(id: string, error: string | undefined) {
  return error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {};
}

function Field({
  id,
  label,
  optional,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {optional && <span className="text-muted-foreground font-normal"> (optional)</span>}
      </Label>
      {children}
      <FieldError id={id} error={error} />
    </div>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="text-sm text-destructive">
      {error}
    </p>
  );
}

function SelectField({
  id,
  label,
  placeholder,
  options,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  placeholder: string;
  options: readonly string[];
  value: string | undefined;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value ?? ''}
        onValueChange={(v) => onChange(String(v))}
        items={Object.fromEntries(options.map((o) => [o, o]))}
      >
        <SelectTrigger id={id} className="w-full" {...invalid(id, error)}>
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
      <FieldError id={id} error={error} />
    </div>
  );
}

// A checkbox card per service, two to a row from sm up (modelled on the
// multi-select on uppitai.com/contact, Zjak 2026-10-12).
function ServiceChecklist({
  label,
  options,
  selected,
  onToggle,
  error,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  onToggle: (value: string) => void;
  error?: string;
}) {
  return (
    <div
      className="space-y-2.5"
      role="group"
      aria-labelledby="ct-services-label"
      aria-describedby={error ? 'ct-services-error' : undefined}
    >
      <p id="ct-services-label" className="text-sm font-medium">
        {label}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((option, i) => {
          const id = `ct-service-${i}`;
          const on = selected.includes(option);
          return (
            <label
              key={option}
              htmlFor={id}
              className={cn('check-card', on && 'check-card-on', error && 'check-card-invalid')}
            >
              <Checkbox id={id} checked={on} onCheckedChange={() => onToggle(option)} />
              <span>{option}</span>
            </label>
          );
        })}
      </div>
      <FieldError id="ct-services" error={error} />
    </div>
  );
}
