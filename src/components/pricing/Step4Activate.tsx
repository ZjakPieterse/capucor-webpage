'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Lock, ShieldCheck, ArrowRight, Sparkles, Check, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConsentCheckbox } from '@/components/ui/ConsentCheckbox';
import { AnimatedPrice } from '@/components/ui/AnimatedPrice';
import { MagneticButton } from '@/components/ui/MagneticButton';
import {
  BusinessDetailsSchema,
  SubscriptionRequestSchema,
} from '@/lib/validations';
import { z } from 'zod';
import { cn, formatZAR } from '@/lib/utils';
import { bracketPrice, monthlyTotal } from '@/lib/pricing';
import { clearPricingDraft } from '@/hooks/usePricingState';
import type { Bracket, BracketValue, Service, Tier } from '@/types';

const VAT_RATE = 0.15;

const FormSchema = z.object({
  fullName: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Enter a valid email address'),
  business: BusinessDetailsSchema,
  website: z.string().max(0).optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface Step4ActivateProps {
  services: Service[];
  brackets: Bracket[];
  tiers: Tier[];
  selectedServices: Set<string>;
  selectedBrackets: Record<string, BracketValue>;
  selectedTier: string | null;
  onBack: () => void;
}

const SECTORS = [
  'Professional services',
  'Retail / e-commerce',
  'Hospitality / food',
  'Manufacturing / industrial',
  'Construction / trades',
  'Health / wellness',
  'Tech / software',
  'Property / real estate',
  'Logistics / transport',
  'Other',
];

export function Step4Activate({
  services,
  brackets,
  tiers,
  selectedServices,
  selectedBrackets,
  selectedTier,
  onBack,
}: Step4ActivateProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentError, setConsentError] = useState('');

  const activeServiceSlugs = [...selectedServices];
  const activeServices = services.filter((s) => selectedServices.has(s.slug));
  const tier = tiers.find((t) => t.slug === selectedTier) ?? null;

  const integerBrackets: Record<string, number> = {};
  for (const [slug, value] of Object.entries(selectedBrackets)) {
    if (typeof value === 'number') integerBrackets[slug] = value;
  }

  const monthlyZAR = tier
    ? monthlyTotal(activeServiceSlugs, selectedBrackets, tier.slug, brackets)
    : 0;
  const vatZAR = Math.round(monthlyZAR * VAT_RATE);
  const totalChargeZAR = monthlyZAR + vatZAR;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: 'onTouched',
    defaultValues: {
      fullName: '',
      email: '',
      business: { legalName: '', cipcNumber: '', vatNumber: '', sector: '' },
      website: '',
    },
  });

  const selectedSector = watch('business.sector');

  async function onSubmit(values: FormValues) {
    if (!consentGiven) {
      setConsentError('You must consent before activating.');
      return;
    }
    setConsentError('');
    setServerError(null);

    if (!tier) {
      setServerError('Please choose a package before activating.');
      return;
    }

    const payload = {
      services: activeServiceSlugs,
      brackets: integerBrackets,
      tierSlug: tier.slug,
      email: values.email,
      fullName: values.fullName,
      business: values.business,
      consentGiven: true as const,
      website: values.website ?? '',
    };

    const parsed = SubscriptionRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? 'Invalid details. Please check your inputs.');
      return;
    }

    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not start checkout. Please try again.');

      if (typeof data.authorizationUrl === 'string') {
        clearPricingDraft();
        window.location.assign(data.authorizationUrl);
      } else {
        throw new Error('Checkout URL missing in response.');
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  const summaryBox = (
    <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">
          Your subscription
        </p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[11px] text-primary/80 hover:text-primary transition-colors"
        >
          <ChevronLeft className="h-3 w-3" />
          Edit selections
        </button>
      </div>
      <ul className="space-y-2 mb-4">
        {activeServices.map((svc) => {
          const sel = integerBrackets[svc.slug];
          const bracket = brackets.find((b) => b.service_slug === svc.slug && b.ordinal === sel);
          const price = bracket && tier ? bracketPrice(bracket, tier.slug) : 0;
          return (
            <li key={svc.slug} className="flex items-center justify-between text-sm">
              <span>
                {svc.name}
                {bracket?.label ? (
                  <span className="text-muted-foreground"> · {bracket.label}</span>
                ) : null}
              </span>
              <span className="font-mono text-sm">{formatZAR(price)}</span>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-primary/20 pt-3 space-y-1.5 text-sm">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span className="font-mono">{formatZAR(monthlyZAR)}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>VAT (15%)</span>
          <span className="font-mono">{formatZAR(vatZAR)}</span>
        </div>
        <div className="flex items-baseline justify-between pt-2 border-t border-primary/15">
          <span className="font-semibold">Total monthly charge</span>
          <span className="font-mono font-bold text-lg">
            <AnimatedPrice amount={totalChargeZAR} />
          </span>
        </div>
        {tier && (
          <p className="text-[11px] text-muted-foreground pt-1">
            {tier.name} tier · billed monthly in arrears · cancel any time with 30 days notice
          </p>
        )}
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div>
        <h2 className="text-xl font-semibold mb-1">Activate your subscription.</h2>
        <p className="text-sm text-muted-foreground">
          A few details so we can prepare your books from day one. You&rsquo;ll be billed via Paystack on a secure South African payment page.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form column */}
        <div className="lg:col-span-2 space-y-6 lg:order-1 order-2">
          {/* Account */}
          <fieldset className="space-y-4">
            <legend className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Account
            </legend>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName" className="mb-1.5 block text-sm">Full name</Label>
                <Input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  aria-invalid={errors.fullName ? 'true' : undefined}
                  {...register('fullName')}
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-destructive">{errors.fullName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="email" className="mb-1.5 block text-sm">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  aria-invalid={errors.email ? 'true' : undefined}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
            </div>
          </fieldset>

          {/* Business details */}
          <fieldset className="space-y-4">
            <legend className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Business details
            </legend>

            <div>
              <Label htmlFor="legalName" className="mb-1.5 block text-sm">Registered business name</Label>
              <Input
                id="legalName"
                type="text"
                placeholder="e.g. Cape Town Roastery (Pty) Ltd"
                aria-invalid={errors.business?.legalName ? 'true' : undefined}
                {...register('business.legalName')}
              />
              {errors.business?.legalName && (
                <p className="mt-1 text-xs text-destructive">{errors.business.legalName.message}</p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cipcNumber" className="mb-1.5 block text-sm">
                  CIPC registration number
                  <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="cipcNumber"
                  type="text"
                  placeholder="2020/123456/07"
                  {...register('business.cipcNumber')}
                />
              </div>
              <div>
                <Label htmlFor="vatNumber" className="mb-1.5 block text-sm">
                  VAT number
                  <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(if registered)</span>
                </Label>
                <Input
                  id="vatNumber"
                  type="text"
                  inputMode="numeric"
                  placeholder="4xxxxxxxxx"
                  aria-invalid={errors.business?.vatNumber ? 'true' : undefined}
                  {...register('business.vatNumber')}
                />
                {errors.business?.vatNumber && (
                  <p className="mt-1 text-xs text-destructive">{errors.business.vatNumber.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label className="mb-2 block text-sm">Sector</Label>
              <div className="flex flex-wrap gap-2">
                {SECTORS.map((s) => {
                  const isSelected = selectedSector === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setValue('business.sector', s, { shouldValidate: true, shouldTouch: true })}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30'
                          : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                      {s}
                    </button>
                  );
                })}
              </div>
              {errors.business?.sector && (
                <p className="mt-1.5 text-xs text-destructive">{errors.business.sector.message}</p>
              )}
            </div>
          </fieldset>

          {/* Honeypot */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            className="hidden"
            {...register('website')}
          />

          {/* Consent */}
          <ConsentCheckbox
            checked={consentGiven}
            onCheckedChange={(val) => {
              setConsentGiven(val);
              if (val) setConsentError('');
            }}
            error={consentError}
          />

          {/* Trust strip */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground border-t border-border pt-4">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-primary" />
              Card details handled by Paystack on its own secure page
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Cancel any time with 30 days notice
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Handover call booked right after checkout
            </span>
          </div>
        </div>

        {/* Summary column — sticky on desktop, top of stack on mobile */}
        <aside className="lg:col-span-1 lg:order-2 order-1">
          <div className="lg:sticky lg:top-4">{summaryBox}</div>
        </aside>
      </div>

      {serverError && (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {serverError}
        </p>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
          ← Back to package
        </Button>
        <MagneticButton>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="gradient-cta gradient-border-cta cta-cursor-glow gap-2"
          >
            <span className="relative z-[2] inline-flex items-center gap-2">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Securing checkout...
                </>
              ) : (
                <>
                  Continue to secure checkout
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </span>
          </Button>
        </MagneticButton>
      </div>
    </form>
  );
}
