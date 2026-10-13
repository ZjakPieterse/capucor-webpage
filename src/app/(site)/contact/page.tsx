import type { Metadata } from 'next';
import { Mail } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { ContactForm } from '@/components/contact/ContactForm';

// Every "Book a fit call" on the site lands here: the visitor answers a few
// questions first and gets the booking link once they are sent
// (decision 2026-10-12; replaced the homepage "Start a conversation" section).
const PAGE_TITLE = 'Contact us and book a fit call';
const PAGE_DESCRIPTION =
  'Tell us about your business: turnover, team, what you need and who does your books now. Then book a fit call with Capucor.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: `${siteConfig.marketingUrl}/contact` },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: `${siteConfig.marketingUrl}/contact`,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    siteName: siteConfig.name,
    images: [{ url: `${siteConfig.marketingUrl}/api/og`, width: 1200, height: 630 }],
  },
};

export default function ContactPage() {
  return (
    <section className="premium-section py-14 lg:py-20">
      <div className="mx-auto max-w-3xl px-6">
        <header className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Let&apos;s get in touch
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Tell us about your business. Simply complete the form, then you can book a fit call
            straight away or send a message and we&apos;ll get back to you.
          </p>
        </header>

        <div className="premium-glass mt-10 rounded-2xl border border-white/10 bg-card/75 p-6 sm:p-8">
          <ContactForm />
        </div>

        {/* Inline, not flex: the longer line (2026-10-13) must wrap as text on phones. */}
        <p className="mt-6 text-center text-sm leading-relaxed text-muted-foreground">
          <Mail className="mr-2 inline size-4 align-[-3px] text-primary" aria-hidden />
          Or simply send us an email:{' '}
          <a
            href={`mailto:${siteConfig.email.contact}`}
            className="text-primary underline underline-offset-2"
          >
            {siteConfig.email.contact}
          </a>
        </p>
      </div>
    </section>
  );
}
