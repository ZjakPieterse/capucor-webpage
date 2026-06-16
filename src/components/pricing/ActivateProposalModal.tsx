'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ArrowRight, Check, MailCheck, FileSignature } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConsentCheckbox } from '@/components/ui/ConsentCheckbox';
import { ProposalSummary } from './ProposalSummary';
import { z } from 'zod';
import { AmendProposalSchema, ProposalRequestSchema } from '@/lib/validations';
import { clearPricingDraft } from '@/hooks/usePricingState';
import type { AmendContext } from './PricingCalculator';
import type { Bracket, BracketValue, Service, Tier } from '@/types';

const FormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Surname is required').max(80),
  businessName: z.string().min(2, 'Business name is required').max(120),
  email: z.string().email('Enter a valid email address'),
  website: z.string().max(0).optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface ActivateProposalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  services: Service[];
  brackets: Bracket[];
  tiers: Tier[];
  selectedServices: Set<string>;
  selectedBrackets: Record<string, BracketValue>;
  selectedTier: string | null;
  selectedAddons?: string[];
  /** Called after a proposal is successfully sent — marks the flow complete. */
  onSuccess: () => void;
  /**
   * When set, the modal runs in amend mode (PR13c, admin-only): contact is
   * pre-filled, the POPIA consent step is dropped (consent carries over from
   * the original), and submit issues a new revision via /api/proposals/amend.
   */
  amend?: AmendContext;
}

export function ActivateProposalModal({
  open,
  onOpenChange,
  services,
  brackets,
  tiers,
  selectedServices,
  selectedBrackets,
  selectedTier,
  selectedAddons = [],
  onSuccess,
  amend,
}: ActivateProposalModalProps) {
  const isAmend = !!amend;
  const [serverError, setServerError] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentError, setConsentError] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);

  const activeServiceSlugs = [...selectedServices];
  const integerBrackets: Record<string, number> = {};
  for (const [slug, value] of Object.entries(selectedBrackets)) {
    if (typeof value === 'number') integerBrackets[slug] = value;
  }

  const defaultContact: FormValues = amend
    ? { ...amend.contact, website: '' }
    : { firstName: '', lastName: '', businessName: '', email: '', website: '' };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    mode: 'onTouched',
    defaultValues: defaultContact,
  });

  // Reset to a clean form whenever the modal closes, so a second visit after a
  // successful send starts fresh rather than showing the old success panel.
  function handleOpenChange(next: boolean) {
    if (!next) {
      setSentTo(null);
      setServerError(null);
      setConsentGiven(false);
      setConsentError('');
      reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: FormValues) {
    // Amend is a staff re-issue: consent was captured on the original and the
    // amend route copies it forward, so there's no consent step here.
    if (!isAmend && !consentGiven) {
      setConsentError('You must consent before continuing.');
      return;
    }
    setConsentError('');
    setServerError(null);

    if (!selectedTier) {
      setServerError('Please choose a package before continuing.');
      return;
    }

    if (isAmend && amend) {
      const payload = {
        proposalId: amend.proposalId,
        services: activeServiceSlugs,
        brackets: integerBrackets,
        tierSlug: selectedTier,
        addons: selectedAddons,
        firstName: values.firstName,
        lastName: values.lastName,
        businessName: values.businessName,
        email: values.email,
      };
      const parsed = AmendProposalSchema.safeParse(payload);
      if (!parsed.success) {
        setServerError(parsed.error.issues[0]?.message ?? 'Please check the details and try again.');
        return;
      }
      try {
        const res = await fetch('/api/proposals/amend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Could not send the updated proposal. Please try again.');

        clearPricingDraft();
        setSentTo(values.email);
        onSuccess();
      } catch (err) {
        setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
      return;
    }

    const payload = {
      services: activeServiceSlugs,
      brackets: integerBrackets,
      tierSlug: selectedTier,
      addons: selectedAddons,
      firstName: values.firstName,
      lastName: values.lastName,
      businessName: values.businessName,
      email: values.email,
      consentGiven: true as const,
      website: values.website ?? '',
    };

    const parsed = ProposalRequestSchema.safeParse(payload);
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? 'Please check your details and try again.');
      return;
    }

    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not send your proposal. Please try again.');

      clearPricingDraft();
      setSentTo(values.email);
      onSuccess();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        {sentTo ? (
          <div className="py-2 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MailCheck className="h-7 w-7" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center text-lg">
                {isAmend ? 'Updated proposal sent' : 'Your proposal is on its way'}
              </DialogTitle>
              <DialogDescription className="text-center">
                {isAmend ? (
                  <>
                    We&rsquo;ve emailed the updated proposal to{' '}
                    <span className="font-medium text-foreground">{sentTo}</span>. It replaces the
                    earlier version, with a fresh link to review and sign.
                  </>
                ) : (
                  <>
                    We&rsquo;ve emailed your proposal to{' '}
                    <span className="font-medium text-foreground">{sentTo}</span>. Open it to review
                    the details and sign electronically. No payment needed yet. A copy has gone to
                    the Capucor team for reference.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <FileSignature className="h-3.5 w-3.5 text-primary" />
              {isAmend
                ? 'The earlier version is now marked superseded'
                : 'Look out for “Your Capucor proposal” in your inbox'}
            </div>
            <Button className="mt-6 w-full" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <DialogHeader>
              <DialogTitle className="text-lg">
                {isAmend ? 'Send the updated proposal' : 'Get your proposal'}
              </DialogTitle>
              <DialogDescription>
                {isAmend
                  ? 'Check the contact details, then send the revised proposal. It supersedes the earlier version and the client gets a fresh link to sign.'
                  : 'Tell us where to send it. We’ll email you a proposal to review and sign. No payment required to get started.'}
              </DialogDescription>
            </DialogHeader>

            <ProposalSummary
              services={services}
              brackets={brackets}
              tiers={tiers}
              selectedServices={activeServiceSlugs}
              selectedBrackets={selectedBrackets}
              tierSlug={selectedTier ?? ''}
              selectedAddons={selectedAddons}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName" className="mb-1.5 block text-sm">First name</Label>
                <Input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  aria-invalid={errors.firstName ? 'true' : undefined}
                  {...register('firstName')}
                />
                {errors.firstName && (
                  <p className="mt-1 text-xs text-destructive">{errors.firstName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName" className="mb-1.5 block text-sm">Surname</Label>
                <Input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  aria-invalid={errors.lastName ? 'true' : undefined}
                  {...register('lastName')}
                />
                {errors.lastName && (
                  <p className="mt-1 text-xs text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="businessName" className="mb-1.5 block text-sm">Business name</Label>
              <Input
                id="businessName"
                type="text"
                placeholder="e.g. Cape Town Roastery"
                aria-invalid={errors.businessName ? 'true' : undefined}
                {...register('businessName')}
              />
              {errors.businessName && (
                <p className="mt-1 text-xs text-destructive">{errors.businessName.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="proposal-email" className="mb-1.5 block text-sm">Email</Label>
              <Input
                id="proposal-email"
                type="email"
                autoComplete="email"
                aria-invalid={errors.email ? 'true' : undefined}
                {...register('email')}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Honeypot — public flow only; amend is a gated staff action. */}
            {!isAmend && (
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                className="hidden"
                {...register('website')}
              />
            )}

            {!isAmend && (
              <ConsentCheckbox
                id="proposal-consent"
                checked={consentGiven}
                onCheckedChange={(val) => {
                  setConsentGiven(val);
                  if (val) setConsentError('');
                }}
                error={consentError}
              />
            )}

            {serverError && (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {serverError}
              </p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="gradient-cta w-full gap-2"
            >
              <span className="relative z-[2] inline-flex items-center gap-2">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isAmend ? 'Sending the update...' : 'Sending your proposal...'}
                  </>
                ) : (
                  <>
                    {isAmend ? 'Send updated proposal' : 'Email me my proposal'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </span>
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
              <Check className="h-3 w-3 text-primary" />
              {isAmend
                ? 'The client reviews and signs the new version · the old one is superseded'
                : 'Review and sign at your own pace · cancel any time with 30 days notice'}
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
