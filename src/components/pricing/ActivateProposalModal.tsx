'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ArrowRight, Check, MailCheck, FileSignature } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConsentCheckbox } from '@/components/ui/ConsentCheckbox';
import { ProposalSummary } from './ProposalSummary';
import type { ProposalAction } from './ReviewStep';
import { z } from 'zod';
import { ProposalRequestSchema } from '@/lib/validations';
import { PREMIUM_REQUEST_COPY } from '@/config/calculatorCopy';
import type { Bracket, BracketValue, CalculatorAnswers, Service, Tier } from '@/types';

const FormSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Surname is required').max(80),
  businessName: z.string().min(2, 'Business name is required').max(120),
  email: z.string().email('Enter a valid email address'),
  website: z.string().max(0).optional(),
});

type FormValues = z.infer<typeof FormSchema>;
type ProposalDelivery = {
  email: string;
  proposalUrl: string;
  deliveryStatus: 'accepted' | 'pending';
};

interface ActivateProposalModalProps {
  open: boolean;
  /**
   * 'send' emails the proposal (valid 7 days) and shows a confirmation.
   * 'accept' makes the same call, then opens the returned proposalUrl to sign.
   * 'request' (Premium, sold by application) sends Capucor a request; no
   * proposal is created and Capucor follows up.
   */
  mode: ProposalAction;
  onOpenChange: (open: boolean) => void;
  services: Service[];
  brackets: Bracket[];
  tiers: Tier[];
  selectedServices: Set<string>;
  selectedBrackets: Record<string, BracketValue>;
  selectedTier: string | null;
  selectedAddons?: string[];
  /** VAT and payroll answers; the VAT answer is stored with the lead. */
  answers: CalculatorAnswers;
  /** Called after a proposal is successfully created — marks the flow complete. */
  onSuccess: () => void;
}

export function ActivateProposalModal({
  open,
  mode,
  onOpenChange,
  services,
  brackets,
  tiers,
  selectedServices,
  selectedBrackets,
  selectedTier,
  selectedAddons = [],
  answers,
  onSuccess,
}: ActivateProposalModalProps) {
  const isAccept = mode === 'accept';
  const isRequest = mode === 'request';
  const [serverError, setServerError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [consentError, setConsentError] = useState('');
  const [delivery, setDelivery] = useState<ProposalDelivery | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const activeServiceSlugs = [...selectedServices];
  const integerBrackets: Record<string, number> = {};
  for (const [slug, value] of Object.entries(selectedBrackets)) {
    if (typeof value === 'number') integerBrackets[slug] = value;
  }

  const defaultContact: FormValues = {
    firstName: '',
    lastName: '',
    businessName: '',
    email: '',
    website: '',
  };

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
      setDelivery(null);
      setRequested(false);
      setRedirecting(false);
      setServerError(null);
      setConsentGiven(false);
      setConsentError('');
      reset();
    }
    onOpenChange(next);
  }

  async function onSubmit(values: FormValues) {
    if (!consentGiven) {
      setConsentError('You must consent before continuing.');
      return;
    }
    setConsentError('');
    setServerError(null);

    if (!selectedTier) {
      setServerError('Please choose a package before continuing.');
      return;
    }

    const payload = {
      services: activeServiceSlugs,
      brackets: integerBrackets,
      tierSlug: selectedTier,
      addons: selectedAddons,
      answers: {
        ...(answers.vatRegistered !== null && { vatRegistered: answers.vatRegistered }),
      },
      intent: mode,
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

      onSuccess();
      if (isRequest) {
        setRequested(true);
        return;
      }
      if (isAccept && typeof data.proposalUrl === 'string') {
        // Accept: open the proposal to sign now. The visitor leaves the page,
        // so the modal stays on its submitting state rather than a success panel.
        setRedirecting(true);
        window.location.assign(data.proposalUrl);
        return;
      }
      setDelivery({
        email: values.email,
        proposalUrl: data.proposalUrl,
        deliveryStatus: data.deliveryStatus === 'accepted' ? 'accepted' : 'pending',
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        {requested ? (
          <div className="py-2 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MailCheck className="h-7 w-7" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center text-lg">{PREMIUM_REQUEST_COPY.doneTitle}</DialogTitle>
              <DialogDescription className="text-center">{PREMIUM_REQUEST_COPY.doneBody}</DialogDescription>
            </DialogHeader>
            <Button className="mt-6 w-full" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : delivery ? (
          <div className="py-2 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MailCheck className="h-7 w-7" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-center text-lg">
                {delivery.deliveryStatus === 'accepted' ? 'Your proposal is on its way' : 'Your proposal is ready'}
              </DialogTitle>
              <DialogDescription className="text-center">
                {delivery.deliveryStatus === 'accepted' ? (
                  <>
                    We have emailed your proposal to{' '}
                    <span className="font-medium text-foreground">{delivery.email}</span>. Open it to review the details
                    and sign electronically. No payment needed yet.
                  </>
                ) : (
                  <>
                    Your proposal was created, but we could not confirm email delivery to{' '}
                    <span className="font-medium text-foreground">{delivery.email}</span>. You can open it safely below
                    while we follow up.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <FileSignature className="h-3.5 w-3.5 text-primary" />
              {delivery.deliveryStatus === 'accepted'
                ? 'Look out for “Your Capucor proposal” in your inbox'
                : 'Your proposal link remains available now'}
            </div>
            {delivery.deliveryStatus === 'pending' && (
              <Button nativeButton={false} className="mt-5 w-full" render={<a href={delivery.proposalUrl} />}>
                Open your proposal
              </Button>
            )}
            <Button className="mt-6 w-full" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <DialogHeader>
              <DialogTitle className="text-lg">
                {isRequest ? PREMIUM_REQUEST_COPY.modalTitle : isAccept ? 'Accept your proposal' : 'Get your proposal'}
              </DialogTitle>
              <DialogDescription>
                {isRequest
                  ? PREMIUM_REQUEST_COPY.modalBody
                  : isAccept
                  ? 'Add your details and we’ll open your proposal to sign now. A copy is emailed to you. No payment required to get started.'
                  : 'Tell us where to send it. We’ll email you a proposal to review and sign within 7 days. No payment required to get started.'}
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
              totalLabel={isRequest ? PREMIUM_REQUEST_COPY.priceLabel : undefined}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="firstName" className="mb-1.5 block text-sm">
                  First name
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  aria-invalid={errors.firstName ? 'true' : undefined}
                  aria-describedby={errors.firstName ? 'firstName-error' : undefined}
                  {...register('firstName')}
                />
                {errors.firstName && <p id="firstName-error" className="mt-1 text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div>
                <Label htmlFor="lastName" className="mb-1.5 block text-sm">
                  Surname
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  aria-invalid={errors.lastName ? 'true' : undefined}
                  aria-describedby={errors.lastName ? 'lastName-error' : undefined}
                  {...register('lastName')}
                />
                {errors.lastName && <p id="lastName-error" className="mt-1 text-xs text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="businessName" className="mb-1.5 block text-sm">
                Business name
              </Label>
              <Input
                id="businessName"
                type="text"
                autoComplete="organization"
                placeholder="e.g. Cape Town Roastery"
                aria-invalid={errors.businessName ? 'true' : undefined}
                aria-describedby={errors.businessName ? 'businessName-error' : undefined}
                {...register('businessName')}
              />
              {errors.businessName && <p id="businessName-error" className="mt-1 text-xs text-destructive">{errors.businessName.message}</p>}
            </div>

            <div>
              <Label htmlFor="proposal-email" className="mb-1.5 block text-sm">
                Email
              </Label>
              <Input
                id="proposal-email"
                type="email"
                autoComplete="email"
                aria-invalid={errors.email ? 'true' : undefined}
                aria-describedby={errors.email ? 'proposal-email-error' : undefined}
                {...register('email')}
              />
              {errors.email && <p id="proposal-email-error" className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
            </div>

            {/* Honeypot */}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden
              className="hidden"
              {...register('website')}
            />

            <ConsentCheckbox
              id="proposal-consent"
              checked={consentGiven}
              onCheckedChange={(val) => {
                setConsentGiven(val);
                if (val) setConsentError('');
              }}
              error={consentError}
            />

            {serverError && (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {serverError}
              </p>
            )}

            <Button type="submit" disabled={isSubmitting || redirecting} className="gradient-cta w-full gap-2">
              <span className="relative z-[2] inline-flex items-center gap-2">
                {isSubmitting || redirecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isRequest
                      ? PREMIUM_REQUEST_COPY.submitting
                      : isAccept
                        ? 'Preparing your proposal...'
                        : 'Sending your proposal...'}
                  </>
                ) : (
                  <>
                    {isRequest ? PREMIUM_REQUEST_COPY.submit : isAccept ? 'Accept and sign' : 'Email me my proposal'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </span>
            </Button>

            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
              <Check className="h-3 w-3 text-primary" />
              {isRequest
                ? 'No payment and no commitment'
                : isAccept
                ? 'You sign on the next page. No payment yet.'
                : 'Review and sign at your own pace · cancel any time with 30 days’ notice'}
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
