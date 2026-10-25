import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { siteConfig } from '@/config/site';
import {
  PAYROLL_ONLY_RESPONSIBILITIES_OURS,
  PAYROLL_ONLY_RESPONSIBILITIES_YOURS,
  PAYROLL_ONLY_TERMS,
  PROPOSAL_TERMS,
  RESPONSIBILITIES_OURS,
  RESPONSIBILITIES_YOURS,
} from '@/config/proposalTerms';

const CONTACT_EMAIL = 'info@capucor.com';

export const metadata: Metadata = {
  title: 'Terms of use',
  description:
    'The full terms of use that apply to a signed Capucor proposal: fees, fair usage, responsibilities, debit-order authorisation, and more.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${siteConfig.marketingUrl}/terms/engagement` },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    siteName: siteConfig.name,
    url: `${siteConfig.marketingUrl}/terms/engagement`,
    images: [{ url: `${siteConfig.marketingUrl}/api/og`, width: 1200, height: 630 }],
  },
};

function Responsibilities({ ours, yours }: { ours: string[]; yours: string[] }) {
  return (
    <>
      <p className="mb-2 text-sm font-semibold text-foreground">We&apos;ll</p>
      <ul className="mb-6 list-outside list-disc space-y-1.5 pl-5 leading-relaxed text-muted-foreground">
        {ours.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="mb-2 text-sm font-semibold text-foreground">You&apos;ll</p>
      <ul className="list-outside list-disc space-y-1.5 pl-5 leading-relaxed text-muted-foreground">
        {yours.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </>
  );
}

export default function EngagementTermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-20">
      <Link
        href="/"
        className="mb-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
      </Link>

      <h1 className="mb-3 text-3xl font-semibold tracking-tight md:text-h1">Terms of use</h1>
      <p className="mb-10 text-sm text-muted-foreground">
        These terms apply to a signed Capucor proposal. Your proposal sets out the services and
        fees; these terms set out how we work together. If anything here conflicts with your
        proposal, the proposal wins.
      </p>

      <section className="space-y-10">
        <div>
          <h2 className="mb-3 text-xl font-semibold">What each of us does</h2>
          <p className="mb-6 leading-relaxed text-muted-foreground">
            Your proposal shows the list for your package. For the Basic, Pro and Premium packages:
          </p>
          <Responsibilities ours={RESPONSIBILITIES_OURS} yours={RESPONSIBILITIES_YOURS} />
          <h3 className="mb-3 mt-8 text-lg font-semibold">For the Payroll package</h3>
          <Responsibilities
            ours={PAYROLL_ONLY_RESPONSIBILITIES_OURS}
            yours={PAYROLL_ONLY_RESPONSIBILITIES_YOURS}
          />
        </div>

        <div>
          <h2 className="mb-3 text-xl font-semibold">{PAYROLL_ONLY_TERMS.heading} (Payroll package)</h2>
          {PAYROLL_ONLY_TERMS.paragraphs.map((p, i) => (
            <p key={i} className="mb-3 leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
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
