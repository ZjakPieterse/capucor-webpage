import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CheckCircle2,
  Calendar,
  ArrowRight,
  Mail,
  ShieldCheck,
  Clock3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PreviewLockedNotice } from '@/components/portal/PreviewLockedNotice';
import { isPreviewAllowed } from '@/lib/preview-gate';
import { siteConfig } from '@/config/site';

/**
 * /onboarding — landing page after Paystack checkout completes.
 *
 * FRAMEWORK STUB. When Paystack is wired:
 *   - Read `?ref=...` and `?subscription=...` query params on the server
 *   - Verify the Paystack transaction status via the Paystack verify endpoint
 *   - Pull the subscription row from Supabase and render its real summary
 *   - Show the team member assigned to the account once we have one
 *
 * For now: a generic post-activation welcome with a Calendly slot booker
 * for the handover call.
 */

export const metadata: Metadata = {
  title: 'Welcome',
  description: 'Your subscription is active. Book your handover call to get started.',
  robots: { index: false, follow: false },
  alternates: { canonical: `${siteConfig.url}/onboarding` },
};

const NEXT_STEPS = [
  {
    icon: Mail,
    title: 'Welcome email is on its way',
    body: 'It includes your invoice, your client portal login, and a list of the documents we will ask for during onboarding.',
  },
  {
    icon: Calendar,
    title: 'Book your handover call',
    body: 'A 30-minute call with your assigned senior accountant. We confirm the scope, walk through your existing accounting setup, and agree on the documents we need.',
  },
  {
    icon: ShieldCheck,
    title: 'Week 1: migration',
    body: 'We collect your prior-year statements and Xero access (or migrate you in from another platform). You stay in control of your data at every step.',
  },
  {
    icon: Clock3,
    title: 'From month 1: rhythm',
    body: 'Your first monthly close happens at the end of the first full month with us. You get your management report by the 15th of the following month.',
  },
];

interface OnboardingPageProps {
  searchParams: Promise<{ preview?: string | string[] }>;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const { preview } = await searchParams;
  if (!isPreviewAllowed(preview)) {
    return (
      <PreviewLockedNotice
        title="You're nearly in."
        body="Paystack checkout isn't live yet, so this welcome flow is gated. Leave your email and we'll loop you in the moment subscriptions open."
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16 lg:py-24">

      {/* Success card */}
      <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-8 lg:p-10 text-center mb-12">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 mb-5">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Welcome to Capucor.
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-lg mx-auto">
          Your subscription is being set up. You will receive a confirmation email within the next hour with your invoice and client portal login.
        </p>
      </div>

      {/* What happens next */}
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-5">
        What happens next
      </h2>
      <ol className="space-y-5 mb-12">
        {NEXT_STEPS.map((step, i) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-xl border border-border bg-card p-5"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <step.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                Step {i + 1}
              </p>
              <h3 className="text-base font-semibold mb-1">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* Calendly slot — embedded inline. For now, an external link.
          When wired, replace with a <Calendly /> embed component pointing
          at the handover-call event type. */}
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8 mb-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">
              Step 2 of onboarding
            </p>
            <h3 className="text-xl font-bold tracking-tight">Pick a handover-call slot</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-md">
              30 minutes with the AGA(SA) accountant who will sign off on your monthly close. Pick a time in the next 5 working days that suits you.
            </p>
          </div>
        </div>
        <Button
          nativeButton={false}
          className="gap-2"
          render={
            <a
              href={siteConfig.links.booking}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          Open calendar to book
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Secondary actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center text-center">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/client-portal" />}
        >
          Go to your client portal
        </Button>
        <Button
          variant="ghost"
          nativeButton={false}
          render={<Link href="/" />}
        >
          Back to home
        </Button>
      </div>
    </div>
  );
}
