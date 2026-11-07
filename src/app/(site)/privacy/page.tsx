import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { CAPUCOR_LEGAL } from '@/config/proposalTerms';
import {
  DATA_REQUEST_RETENTION_DAYS,
  DATA_REQUEST_SLA_DAYS,
  EMAIL_DELIVERY_RETENTION_DAYS,
  LEAD_RETENTION_DAYS,
  PRIVACY_POLICY_UPDATED,
  UNSIGNED_PROPOSAL_RETENTION_DAYS,
} from '@/lib/consent';

// Privacy notice v4 (Zjak, 2026-11-06; v2 + retention periods = v3; no registered address at signing = v4; no registered name or number at signing = v5). Written to POPIA s18(1): what we
// collect, who we are, why, whether it is required, the law, transfers abroad,
// who receives it, and the person's rights, including a complaint to the
// Information Regulator. Bump CONSENT_VERSION and PRIVACY_POLICY_UPDATED in
// lib/consent.ts when this text changes substantively.

const LEAD_RETENTION_MONTHS = Math.round(LEAD_RETENTION_DAYS / 30);
const DATA_REQUEST_RETENTION_YEARS = Math.round(DATA_REQUEST_RETENTION_DAYS / 365);
const EMAIL_DELIVERY_RETENTION_MONTHS = Math.round(EMAIL_DELIVERY_RETENTION_DAYS / 30);
const CONTACT_EMAIL = CAPUCOR_LEGAL.email;

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Capucor Business Solutions collects, uses, shares and protects your personal information under POPIA.',
  robots: { index: true, follow: true },
  alternates: { canonical: `${siteConfig.marketingUrl}/privacy` },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    siteName: siteConfig.name,
    url: `${siteConfig.marketingUrl}/privacy`,
    images: [{ url: `${siteConfig.marketingUrl}/api/og`, width: 1200, height: 630 }],
  },
};

interface Activity {
  title: string;
  collect: string;
  why: string;
}

const ACTIVITIES: Activity[] = [
  {
    title: 'When you contact us or ask for a fit call',
    collect:
      'Your name, email address and business name, your answers about turnover, team size, the services you need and how your books are kept now, and any message you add.',
    why: 'To reply to you and prepare for the call. If you book a call, Google Calendar takes your name, email address and the time you choose.',
  },
  {
    title: 'When you download a free resource',
    collect: 'Your name and email address, and which resource you asked for.',
    why: 'To keep a record of your request. We don’t add you to a mailing list.',
  },
  {
    title: 'When you ask for a proposal',
    collect:
      'Your first name, surname, business name and email address, the services, volumes, package and add-ons you chose in the calculator, your VAT answer, and the price we quoted. We also record your IP address and browser type.',
    why: 'To prepare and send your proposal, and to keep an accurate record of what we offered and to whom. We note when you open the proposal so we know whether to follow up.',
  },
  {
    title: 'When you sign a proposal',
    collect:
      'The name you sign with, your signature (typed, drawn or uploaded), your confirmation that you may sign for the business, the terms version, the time, and your IP address.',
    why: 'To conclude our agreement and keep evidence of your electronic signature. The signed proposal is also the debit-order mandate, so we need it for billing.',
  },
  {
    title: 'Whenever you visit the site',
    collect:
      'Technical data: your IP address, browser type, the pages you open and the site that sent you. Your IP address is held for up to 10 minutes to stop abuse of our forms.',
    why: 'To keep the site secure and working, and to count visits in aggregate.',
  },
  {
    title: 'When you ask about your information',
    collect:
      'Your email address and what you asked for (a copy or deletion), with the time, your IP address and browser type.',
    why: 'To confirm the request is yours and keep a record of how we handled it.',
  },
  {
    title: 'When we email you',
    collect: 'Your email address, which message we sent, and whether it was delivered.',
    why: 'To make sure important emails, such as your proposal, reach you, and to resend them if they fail.',
  },
];

const BASES = [
  'Replying to you, preparing a proposal and concluding our agreement: these steps are needed to enter into or carry out a contract with you (POPIA section 11(1)(b)).',
  'Keeping signed proposals and billing records: we must keep certain records by law, and the agreement needs them (section 11(1)(b) and (c)).',
  'Security, abuse protection, counting visits, delivery records and keeping a record of resource requests: our legitimate interest in running a safe, working website (section 11(1)(f)).',
];

const OPERATORS = [
  'Cloudflare: hosts the website, protects it from abuse and counts visits.',
  'Supabase, on Amazon Web Services: stores what you submit through our forms.',
  'Resend: sends our emails, such as your proposal and confirmation messages.',
  'Google Workspace: our email, file storage for signed proposals, and the calendar you book a fit call in.',
];

const RETENTION = [
  `Enquiries and resource requests that don’t lead to an engagement: deleted automatically after ${LEAD_RETENTION_MONTHS} months.`,
  `Proposals that are not signed: they expire after 7 days, and we delete them ${UNSIGNED_PROPOSAL_RETENTION_DAYS} days after that. A proposal sent as part of a plan review for an existing client is kept with that client’s records.`,
  'Signed proposals and the records of our work for you: for the length of our engagement and afterwards for as long as the law requires us to keep them (generally five years).',
  `Requests about your information, and our record of how we handled them: ${DATA_REQUEST_RETENTION_YEARS} years.`,
  `Records of the emails we sent you and whether they were delivered: ${EMAIL_DELIVERY_RETENTION_MONTHS} months. For a signed proposal, the record of the signed copy we sent is kept with the signed proposal.`,
  'Abuse-protection records of your IP address: up to 10 minutes.',
  'Website traffic data: kept by Cloudflare in aggregate, under its own retention rules.',
  'Backups: deleted records can stay in our backup copies for up to six months, until those copies expire.',
];

const RIGHTS = [
  'know whether we hold personal information about you and get a copy of it',
  'ask us to correct or delete information that is wrong, out of date or that we no longer may keep',
  'object to us processing your information, including for direct marketing',
  'lodge a complaint with the Information Regulator',
];

const h2 = 'text-xl font-semibold mb-3';
const p = 'text-muted-foreground leading-relaxed';
const ul = 'list-outside list-disc space-y-1.5 pl-5 leading-relaxed text-muted-foreground';
const a = 'text-primary underline underline-offset-2';

export default function PrivacyPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 py-20">
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-10 inline-flex items-center gap-1.5"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight mb-3 md:text-h1">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: {PRIVACY_POLICY_UPDATED}</p>

      <section className="prose prose-slate prose-invert max-w-none space-y-10">
        <div>
          <h2 className={h2}>Who we are</h2>
          <p className={p}>
            {CAPUCOR_LEGAL.name}, registration number {CAPUCOR_LEGAL.registrationNumber}, trading as{' '}
            {CAPUCOR_LEGAL.tradingAs}, is the responsible party for the personal information collected
            through this website. Our address is {CAPUCOR_LEGAL.address}. For anything about your
            personal information, contact our Information Officer at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className={a}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
          <p className={`${p} mt-3`}>
            This policy covers capucor.com. When you become a client, our engagement terms also apply
            to the information we handle for you.
          </p>
        </div>

        <div>
          <h2 className={h2}>What we collect and why</h2>
          <div className="space-y-5">
            {ACTIVITIES.map((item) => (
              <div key={item.title}>
                <h3 className="font-medium mb-1.5">{item.title}</h3>
                <p className={p}>
                  <span className="text-foreground">What: </span>
                  {item.collect}
                </p>
                <p className={`${p} mt-1`}>
                  <span className="text-foreground">Why: </span>
                  {item.why}
                </p>
              </div>
            ))}
          </div>
          <p className={`${p} mt-5`}>
            We collect this information from you directly. We don&apos;t collect ID numbers, banking or
            card details, or special personal information through this website, and we don&apos;t sell
            your information.
          </p>
        </div>

        <div>
          <h2 className={h2}>Why we&apos;re allowed to use it</h2>
          <ul className={ul}>
            {BASES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className={`${p} mt-3`}>
            We don&apos;t send marketing emails to people who aren&apos;t clients. If that changes, we&apos;ll
            ask first.
          </p>
        </div>

        <div>
          <h2 className={h2}>What you have to give us</h2>
          <p className={p}>
            Fields marked as required are needed to reply to you, prepare a proposal or conclude the
            agreement. If you leave them out, we can&apos;t do those things. Everything else is optional.
          </p>
        </div>

        <div>
          <h2 className={h2}>Who we share it with</h2>
          <p className={`${p} mb-3`}>
            We use trusted service providers (operators) who process your information only on our
            instructions and under written agreements that require them to keep it secure:
          </p>
          <ul className={ul}>
            {OPERATORS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className={`${p} mt-3`}>
            We may also share information where the law requires it. Some of these providers store or
            process information outside South Africa, including in the United States. We only use
            providers bound by agreements that give your information a level of protection similar to
            POPIA&apos;s (POPIA section 72).
          </p>
        </div>

        <div>
          <h2 className={h2}>How long we keep it</h2>
          <ul className={ul}>
            {RETENTION.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className={h2}>Cookies and analytics</h2>
          <p className={p}>
            We don&apos;t use cookies on capucor.com. To count visits, we use Cloudflare Web Analytics,
            which doesn&apos;t use cookies or track you across other websites. Cloudflare may set a
            short-lived security cookie if it needs to check that a visitor isn&apos;t a bot. If we ever
            add marketing or tracking cookies, we&apos;ll ask you first.
          </p>
        </div>

        <div>
          <h2 className={h2}>Your rights under POPIA</h2>
          <p className={`${p} mb-3`}>
            Under the Protection of Personal Information Act 4 of 2013 (POPIA), you have the right to:
          </p>
          <ul className={ul}>
            {RIGHTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className={`${p} mt-3`}>
            To use these rights, email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className={a}>
              {CONTACT_EMAIL}
            </a>{' '}
            from the email address we hold for you. We&apos;ll confirm the request is yours, then
            respond within {DATA_REQUEST_SLA_DAYS} days. Some records, such as signed agreements, we
            must keep by law even if you ask us to delete them. We&apos;ll tell you if that applies.
          </p>
          <p className={`${p} mt-3`}>
            If you&apos;re not happy with how we&apos;ve handled your information, please tell us first.
            You may also complain to the Information Regulator through its{' '}
            <a
              href="https://inforegulator.org.za/complaints/"
              className={a}
              rel="noopener noreferrer"
              target="_blank"
            >
              complaints page
            </a>{' '}
            (online through its eServices portal) or by email at{' '}
            <a href="mailto:enquiries@inforegulator.org.za" className={a}>
              enquiries@inforegulator.org.za
            </a>
            .
          </p>
        </div>

        <div>
          <h2 className={h2}>How we protect it</h2>
          <p className={p}>
            Your information is encrypted in transit and at rest with our providers, and only authorised
            Capucor staff can reach it. If we learn of a security breach that affects your information,
            we&apos;ll tell you and the Information Regulator as POPIA requires.
          </p>
        </div>

        <div>
          <h2 className={h2}>Changes to this policy</h2>
          <p className={p}>
            When we change this policy, we update the date at the top. We keep a record of which version
            was in place when you sent us your details.
          </p>
        </div>
      </section>
    </article>
  );
}
