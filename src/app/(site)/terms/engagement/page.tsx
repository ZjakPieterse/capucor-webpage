import type { Metadata } from 'next';
import Link from 'next/link';
import {
  PROPOSAL_TERMS,
  RESPONSIBILITIES_OURS,
  RESPONSIBILITIES_YOURS,
} from '@/config/proposalTerms';

const CONTACT_EMAIL = 'info@capucor.com';

export const metadata: Metadata = {
  title: 'Engagement terms',
  description:
    'The full terms of engagement that apply to a signed Capucor proposal: fees, fair usage, responsibilities, debit-order authorisation, and more.',
  robots: { index: true, follow: true },
};

export default function EngagementTermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20">
      <Link
        href="/"
        className="mb-10 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Back to home
      </Link>

      <h1 className="mb-3 text-3xl font-bold tracking-tight">Engagement terms</h1>
      <p className="mb-10 text-sm text-muted-foreground">
        These terms apply to a signed Capucor proposal. Your proposal sets out the services and
        fees; these terms set out how we work together. If anything here conflicts with your
        proposal, the proposal wins.
      </p>

      <section className="space-y-10">
        <div>
          <h2 className="mb-3 text-xl font-semibold">What each of us does</h2>
          <p className="mb-2 text-sm font-semibold text-foreground">We&apos;ll</p>
          <ul className="mb-4 list-inside list-disc space-y-1 text-muted-foreground">
            {RESPONSIBILITIES_OURS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="mb-2 text-sm font-semibold text-foreground">You&apos;ll</p>
          <ul className="list-inside list-disc space-y-1 text-muted-foreground">
            {RESPONSIBILITIES_YOURS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>

        {PROPOSAL_TERMS.map((block) => (
          <div key={block.id}>
            <h2 className="mb-3 text-xl font-semibold">{block.heading}</h2>
            {block.paragraphs.map((p, i) => (
              <p key={i} className="mb-3 leading-relaxed text-muted-foreground">
                {p}
              </p>
            ))}
          </div>
        ))}

        <div>
          <h2 className="mb-3 text-xl font-semibold">Questions</h2>
          <p className="leading-relaxed text-muted-foreground">
            Anything unclear? Email us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
              {CONTACT_EMAIL}
            </a>{' '}
            before you sign.
          </p>
        </div>
      </section>
    </article>
  );
}
