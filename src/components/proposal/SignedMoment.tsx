'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeckCard, HANDING_OVER_CARD } from '@/components/landing/FirstNinetyDays';

// The signed moment (full-site audit D11 preview, 2026-10-13). Signing used to
// end on a tick; now it ends on the next real step, in the site's own words:
// the confirmation, the homepage's "Handing over" 90-day card, the checklist
// link (A03) and where the signed PDF goes (A02). The story closes with the
// card it opened with. Used right after confirming (ConfirmSignButton) and on
// the signed proposal link (proposal/[token]).
//
// The PDF is not offered on the page: a signed link stays valid, so a leaked
// link must not expose the document (proposal/[token] keeps that view
// minimal). It goes to the client by email (decision 3).

const EASE = [0.16, 1, 0.3, 1] as const;

export function SignedMoment({
  title,
  detail,
  deliveryPending = false,
}: {
  title: string;
  /** "Signed by … on …", when known. */
  detail?: string | null;
  /** The follow-up email could not be confirmed yet. */
  deliveryPending?: boolean;
}) {
  const reduce = useReducedMotion();
  const enter = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, ease: EASE, delay },
        };

  return (
    <div className="space-y-6">
      <motion.div {...enter(0)} className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Check className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold">{title}</p>
        {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
        <p className="mt-2 text-sm text-muted-foreground">
          {/* Signing stops at signed + PDF (web-standalone, 2026-10-07): no
              capucor.app portal link. */}
          Your acceptance is recorded. We&rsquo;ll be in touch shortly to set up your onboarding.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          A PDF of what you signed is on its way to your inbox.
        </p>
        {deliveryPending && (
          <p className="mt-2 text-sm text-muted-foreground">
            We could not confirm delivery of the follow-up email yet, but your signed acceptance is safely recorded.
          </p>
        )}
      </motion.div>

      <motion.div {...enter(0.25)}>
        <p className="mb-3 text-center text-xs font-semibold text-muted-foreground">
          Your first 90 days start here
        </p>
        <DeckCard card={HANDING_OVER_CARD} className="deck-card deck-card-solo" />
      </motion.div>

      <motion.div {...enter(0.45)} className="flex flex-col items-center gap-3 text-center">
        {/* A03: the next real step, in the homepage's "What we'll need" words. */}
        <p className="text-sm text-muted-foreground">
          Most of this you already have somewhere. Start gathering now and your first month goes
          faster.
        </p>
        <Button
          nativeButton={false}
          render={<Link href="/resources/onboarding-checklist" />}
          variant="outline"
          size="lg"
          className="gap-2"
        >
          Start gathering what we&rsquo;ll need <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </motion.div>
    </div>
  );
}
