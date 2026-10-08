'use client';

import { ArrowRight, CalendarClock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProposalSummary } from './ProposalSummary';
import { AFTER_YOU_SIGN, ANSWER_LABELS, PREMIUM_REQUEST_COPY } from '@/config/calculatorCopy';
import { TIERS_BY_APPLICATION } from '@/config/tiers';
import { ALLOWANCE_CHANGE_NOTE } from '@/config/serviceScope';
import type { Bracket, BracketValue, CalculatorAnswers, Service, Tier } from '@/types';

// 'request' is for a package sold by application (Premium): Capucor follows
// up and no signable proposal is created (tweaks round 1, 2026-10-06).
export type ProposalAction = 'send' | 'accept' | 'request';

interface ReviewStepProps {
  services: Service[];
  brackets: Bracket[];
  tiers: Tier[];
  selectedServices: Set<string>;
  selectedBrackets: Record<string, BracketValue>;
  selectedTier: string;
  selectedAddons: string[];
  answers: CalculatorAnswers;
  onBack: () => void;
  onAction: (action: ProposalAction) => void;
}

function yesNo(value: boolean | null): string {
  return value === null ? 'Not answered' : value ? 'Yes' : 'No';
}

export function ReviewStep({
  services,
  brackets,
  tiers,
  selectedServices,
  selectedBrackets,
  selectedTier,
  selectedAddons,
  answers,
  onBack,
  onAction,
}: ReviewStepProps) {
  const byApplication = TIERS_BY_APPLICATION.includes(selectedTier);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold mb-1.5">Review your subscription</h2>
        <p className="text-sm text-muted-foreground">
          {byApplication
            ? 'Check the details, then send your request.'
            : 'Check the details, then accept now or have the proposal emailed to you.'}
        </p>
      </div>

      <ProposalSummary
        services={services}
        brackets={brackets}
        tiers={tiers}
        selectedServices={[...selectedServices]}
        selectedBrackets={selectedBrackets}
        tierSlug={selectedTier}
        selectedAddons={selectedAddons}
        totalLabel={byApplication ? PREMIUM_REQUEST_COPY.priceLabel : undefined}
      />

      <p className="text-xs text-muted-foreground leading-relaxed">
        {ALLOWANCE_CHANGE_NOTE} Catch-up for the 3 months before you accept is included.
      </p>

      <dl className="rounded-2xl border border-border bg-card/40 p-5 space-y-2 text-sm">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          About your business
        </p>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">{ANSWER_LABELS.vatRegistered}</dt>
          <dd className="font-medium">{yesNo(answers.vatRegistered)}</dd>
        </div>
      </dl>

      {byApplication ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-4 flex flex-col gap-3">
          <div>
            <p className="font-semibold text-sm">{PREMIUM_REQUEST_COPY.reviewTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{PREMIUM_REQUEST_COPY.reviewBody}</p>
          </div>
          <Button onClick={() => onAction('request')} className="gap-2 cta-armed sm:self-start">
            <CalendarClock className="h-4 w-4" />
            {PREMIUM_REQUEST_COPY.action}
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-4 flex flex-col gap-3">
            <div>
              <p className="font-semibold text-sm">Ready to start</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                We create your proposal and open it for you to sign now. A copy is emailed to you.
              </p>
            </div>
            <Button onClick={() => onAction('accept')} className="mt-auto gap-2 cta-armed">
              Accept
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="rounded-2xl border border-border bg-card/40 p-4 flex flex-col gap-3">
            <div>
              <p className="font-semibold text-sm">Want to think it over</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                We email the proposal to you. Review and sign it within 7 days.
              </p>
            </div>
            <Button variant="outline" onClick={() => onAction('send')} className="mt-auto gap-2">
              <Mail className="h-4 w-4" />
              Send proposal
            </Button>
          </div>
        </div>
      )}

      {!byApplication && (
        <div className="rounded-2xl border border-border bg-card/40 p-4">
          <p className="font-semibold text-sm">What happens next</p>
          <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground leading-relaxed list-decimal pl-4">
            {AFTER_YOU_SIGN.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center">
        No payment needed yet · cancel any time with 30 days&apos; notice
      </p>

      <div className="flex justify-start pt-2">
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
      </div>
    </div>
  );
}
