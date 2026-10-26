'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HANDING_OVER_CARD } from '@/components/landing/FirstNinetyDays';

// The signed moment (full-site audit D11 preview, 2026-10-13). Signing used to
// end on a tick; now it ends on the next real step, in the site's own words:
// the confirmation, the homepage's "Handing over" 90-day card, the checklist
// link (A03) and where the signed PDF goes (A02). The story closes with the
// card it opened with. Used right after confirming (ConfirmSignButton) and on
// the signed proposal link (proposal/[token]).
//
// On paper, like the proposal it closes (design review G2, Zjak 2026-10-26),
// and laid out for the desktop: the confirmation beside the next step, not
// one narrow card ("looks like mobile view", Zjak 2026-10-18). One icon only,
// the tick ("too many icons"): the Handing over card shows as plain text here,
// not the homepage deck card with its icon and ticks.
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
  const card = HANDING_OVER_CARD;

  return (
    <motion.div
      {...enter(0)}
      className="document-paper overflow-hidden rounded-2xl border border-border"
    >
      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="p-6 sm:p-8 lg:p-10">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Check className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}
          <p className="mt-4 text-base leading-relaxed">
            {/* Signing stops at signed + PDF (web-standalone, 2026-10-07): no
                capucor.app portal link. */}
            Your acceptance is recorded. We&rsquo;ll be in touch shortly to set up your onboarding.
          </p>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            A PDF of what you signed is on its way to your inbox.
          </p>
          {deliveryPending && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We could not confirm delivery of the follow-up email yet, but your signed acceptance is safely recorded.
            </p>
          )}
        </div>

        <motion.div
          {...enter(0.25)}
          className="border-t border-border bg-muted/60 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10"
        >
          <p className="text-sm font-semibold text-muted-foreground">Your first 90 days start here</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">{card.title}</h2>
          <p className="mt-2 text-base leading-relaxed">{card.body}</p>
          {card.yours && (
            <p className="mt-3 text-base leading-relaxed">
              <span className="font-semibold">Your part: </span>
              {card.yours}
            </p>
          )}
          <p className="mt-5 text-sm font-semibold">{card.listTitle}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-base leading-relaxed marker:text-muted-foreground">
            {card.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          {/* A03: the next real step, in the homepage's "What we'll need" words. */}
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Most of this you already have somewhere. Start gathering now and your first month goes
            faster.
          </p>
          <Button
            nativeButton={false}
            render={<Link href="/resources/onboarding-checklist" />}
            variant="outline"
            size="lg"
            className="mt-4"
          >
            Start gathering what we&rsquo;ll need
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
