import { Check, X, RefreshCw } from 'lucide-react';
import type { FairUsageLine } from '@/lib/schedule';
import type { TermsBlock } from '@/config/proposalTerms';

// Server-rendered building blocks for the proposal document. No interactivity
// (the sign step is the only client island), so these stay plain components.

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

const dateZA = (iso: string) =>
  new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

export function DocumentHeader({
  businessName,
  firstName,
  lastName,
  refNumber,
  sentAt,
  expiresAt,
  version,
}: {
  businessName: string;
  firstName: string;
  lastName: string;
  refNumber: string | null;
  sentAt: string | null;
  expiresAt: string | null;
  version: number;
}) {
  return (
    <div className="border-b border-border bg-primary/[0.04] p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-bold tracking-tight text-primary">Capucor</p>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Proposal &amp; engagement
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">For {businessName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Prepared for {firstName} {lastName}, by Capucor Business Solutions
          </p>
        </div>
        {refNumber && (
          <div className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-right">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
              Reference
            </p>
            <p className="font-mono text-xs font-semibold sm:text-sm">{refNumber}</p>
            {version > 1 && <p className="text-[10px] text-muted-foreground">Revision {version}</p>}
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        {sentAt && <span>Prepared {dateZA(sentAt)}</span>}
        {expiresAt && <span>Valid until {dateZA(expiresAt)}</span>}
      </div>
    </div>
  );
}

export function ScheduleOfServices({
  inclusions,
  fairUsage,
  outOfScope,
}: {
  inclusions: string[];
  fairUsage: FairUsageLine[];
  outOfScope: string[];
}) {
  return (
    <div>
      <SectionLabel>Schedule of services</SectionLabel>

      <p className="mb-2 text-xs font-semibold text-foreground">What&apos;s included</p>
      <ul className="mb-5 grid gap-2 sm:grid-cols-2">
        {inclusions.map((text) => (
          <li key={text} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{text}</span>
          </li>
        ))}
      </ul>

      {fairUsage.length > 0 && (
        <>
          <p className="mb-2 text-xs font-semibold text-foreground">Your allowances</p>
          <ul className="mb-5 space-y-3">
            {fairUsage.map((f) => (
              <li key={f.slug} className="rounded-lg border border-border bg-card/40 p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{f.name}</span>
                  {f.bracketLabel && (
                    <span className="shrink-0 text-xs font-medium text-primary">{f.bracketLabel}</span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.allowance}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mb-2 text-xs font-semibold text-foreground">What&apos;s not included</p>
      <ul className="space-y-2">
        {outOfScope.map((text) => (
          <li key={text} className="flex items-start gap-2 text-sm text-muted-foreground">
            <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Anything not listed above is out of scope until we&apos;ve quoted it and you&apos;ve accepted an
        updated proposal.
      </p>
    </div>
  );
}

export function FeesNotes() {
  const notes = [
    'Billed monthly in arrears. Your first close runs at the end of your first full month.',
    'The figure above is the all-in monthly price. VAT, where it applies, is shown on your Xero invoice, not here.',
    'Processing for the 3 months before your start date is included. Older periods are catch-up work and quoted separately.',
  ];
  return (
    <ul className="mt-3 space-y-1.5">
      {notes.map((n) => (
        <li key={n} className="text-xs leading-relaxed text-muted-foreground">
          · {n}
        </li>
      ))}
    </ul>
  );
}

export function FeeChangesSection({ fairUsage }: { fairUsage: FairUsageLine[] }) {
  const overages = fairUsage.filter((f) => f.overage);
  return (
    <div>
      <SectionLabel>How your fee stays fair</SectionLabel>
      <div className="flex items-start gap-2.5">
        <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm leading-relaxed text-muted-foreground">
          We review your engagement every quarter against your rolling average over the last 3 to 12
          months. One busy month won&apos;t move your price and a quiet one won&apos;t count against you.
          Any change applies from the next billing cycle and is never back-dated.
        </p>
      </div>
      {overages.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
          {overages.map((f) => (
            <li key={f.slug} className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{f.name}:</span> {f.overage}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ResponsibilitiesSection({ ours, yours }: { ours: string[]; yours: string[] }) {
  return (
    <div>
      <SectionLabel>What each of us does</SectionLabel>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold text-foreground">We&apos;ll</p>
          <ul className="space-y-2">
            {ours.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-foreground">You&apos;ll</p>
          <ul className="space-y-2">
            {yours.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** Shared renderer for engagement-terms blocks (proposal inline + /terms page). */
export function TermsBlocks({ blocks }: { blocks: TermsBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((block) => (
        <div key={block.id}>
          <h3 className="text-sm font-semibold">{block.heading}</h3>
          {block.paragraphs.map((p, i) => (
            <p key={i} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
