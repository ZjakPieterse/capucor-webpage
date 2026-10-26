import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { siteConfig } from '@/config/site';
import {
  CAPUCOR_LEGAL,
  PAYROLL_ONLY_RESPONSIBILITIES_OURS,
  PAYROLL_ONLY_RESPONSIBILITIES_YOURS,
  PAYROLL_ONLY_TERMS,
  PROPOSAL_TERMS,
  RESPONSIBILITIES_OURS,
  RESPONSIBILITIES_YOURS,
  TERMS_VERSION,
} from '@/config/proposalTerms';

const CONTACT_EMAIL = CAPUCOR_LEGAL.email;

export const metadata: Metadata = {
  title: 'Engagement terms',
  description:
    'The engagement terms that apply to a signed Capucor proposal: who the agreement is with, fees and payment, responsibilities, POPIA, records, and more.',
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

      <h1 className="mb-3 text-3xl font-semibold tracking-tight md:text-h1">Engagement terms</h1>
      <p className="mb-2 text-sm text-muted-foreground">
        These terms apply to a signed Capucor proposal. Your proposal sets out the services and
        fees; these terms set out how we work together. If anything here conflicts with your
        proposal, the proposal wins.
      </p>
      <p className="mb-10 text-sm text-muted-foreground">Terms version {TERMS_VERSION}</p>

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

        {/* If you sign as an individual: ECTA s44 cooling-off for natural-person clients. */}
        <div>
          <h2 className="mb-3 text-xl font-semibold">If you sign as an individual</h2>
          <p className="mb-3 leading-relaxed text-muted-foreground">
            If you sign this proposal as an individual (for example as a sole proprietor) rather
            than for a company, close corporation or trust, you may cancel it within 7 days of
            signing, without giving a reason and without penalty. We refund anything you have paid
            within 30 days of your cancellation.
          </p>
        </div>

        {/* About us: ECTA s43 supplier details. No phone number by choice (Zjak, 2026-10-26). */}
        <div>
          <h2 className="mb-3 text-xl font-semibold">About us</h2>
          <ul className="mb-3 list-outside list-disc space-y-1.5 pl-5 leading-relaxed text-muted-foreground">
            <li>
              {CAPUCOR_LEGAL.name}, a private company registered in South Africa, registration
              number {CAPUCOR_LEGAL.registrationNumber}, trading as {CAPUCOR_LEGAL.tradingAs}.
            </li>
            <li>Registered and physical address: {CAPUCOR_LEGAL.address}.</li>
            <li>
              Email:{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>
              . Website: capucor.com.
            </li>
            <li>
              Our work is led by a member of the South African Institute of Chartered Accountants
              (SAICA), as an Associate General Accountant, AGA(SA), and follows the SAICA Code of
              Professional Conduct.
            </li>
            <li>
              How we handle personal information:{' '}
              <Link href="/privacy" className="text-primary underline underline-offset-2">
                privacy policy
              </Link>
              .
            </li>
            <li>
              You can save or print this page, and you receive a PDF copy of your signed proposal
              with these terms by email.
            </li>
          </ul>
        </div>

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
