'use client';

import { ArrowLeft, ArrowRight, CalendarClock, Check, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProposalSummary } from './ProposalSummary';
import { AFTER_YOU_SIGN, PREMIUM_REQUEST_COPY } from '@/config/calculatorCopy';
import { TIERS_BY_APPLICATION } from '@/config/tiers';
import { ALLOWANCE_CHANGE_NOTE } from '@/config/serviceScope';
import type { Bracket, BracketValue, Service, Tier } from '@/types';

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
  /** What the package includes, listed under the summary (reviewInclusions). */
  inclusions?: { heading: string; items: string[] };
  onBack: () => void;
  onAction: (action: ProposalAction) => void;
}

export function ReviewStep({
  services,
  brackets,
  tiers,
  selectedServices,
  selectedBrackets,
  selectedTier,
  selectedAddons,
  inclusions,
  onBack,
  onAction,
}: ReviewStepProps) {
  const byApplication = TIERS_BY_APPLICATION.includes(selectedTier);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 tabIndex={-1} data-step-heading className="text-xl sm:text-2xl font-semibold mb-1.5 outline-none">Review your subscription</h2>
        <p className="text-sm text-muted-foreground">
          {byApplication
            ? 'Check the details, then send your request.'
            : 'Check the details, then accept now or request the proposal to be emailed to you.'}
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
        splitCore
      />

      {inclusions && (
        <div className="rounded-2xl border border-border bg-card/40 p-4">
          <p className="font-semibold text-sm">{inclusions.heading}</p>
          <ul className="mt-2 space-y-1.5">
            {inclusions.items.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {byApplication ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-4 flex flex-col gap-3">
          <div>
            <p className="font-semibold text-sm">{PREMIUM_REQUEST_COPY.reviewTitle}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{PREMIUM_REQUEST_COPY.reviewBody}</p>
          </div>
          <Button size="lg" onClick={() => onAction('request')} className="gap-2 cta-armed sm:self-start">
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
            <Button size="lg" onClick={() => onAction('accept')} className="mt-auto gap-2 cta-armed">
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
            <Button variant="outline" size="lg" onClick={() => onAction('send')} className="mt-auto gap-2">
              <Mail className="h-4 w-4" />
              Send proposal
            </Button>
          </div>
        </div>
      )}

      {/* Right under the actions, where the reassurance is needed (design review, 2026-10-13);
          the band note joined it here (Zjak, 2026-10-14). */}
      <div className="-mt-3 space-y-1.5 text-center text-xs text-muted-foreground leading-relaxed">
        <p className="flex items-center justify-center gap-1.5">
          <Check className="h-3.5 w-3.5 text-primary" />
          No payment needed yet
        </p>
        <p>{ALLOWANCE_CHANGE_NOTE} Catch-up for the 3 months before you accept is included.</p>
      </div>

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

      <div className="flex justify-start pt-2">
        <Button variant="outline" size="lg" onClick={onBack}>
          <ArrowLeft aria-hidden /> Back
        </Button>
      </div>
    </div>
  );
}
