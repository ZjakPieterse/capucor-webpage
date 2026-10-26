// capucor.com is this site: landing, service pages, pricing calculator and the
// sales funnel through proposal signing. Everything indexable and every
// canonical URL uses MARKETING_URL.
//
// APP_URL is the legacy client portal (capucor.app). Nothing links it since the
// Navbar's Client Portal link went (2026-10-08); it is kept until os-sunset,
// the same lifetime as the /portal, /login, /internal redirects in
// next.config.ts. Do not add a consumer: no email, signing page or API here
// links or calls capucor.app.
// See "Domain seam" in AGENTS.md.
const MARKETING_URL = process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://capucor.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://capucor.app';

export const siteConfig = {
  name: 'Capucor Business Solutions',
  description:
    'Monthly accounting, bookkeeping, payroll and SARS work for owner-run South African businesses with staff. One fixed monthly subscription, run in Xero.',
  // Public site: canonicals, sitemap, OG tags, proposal + POPIA email links.
  marketingUrl: MARKETING_URL,
  // Legacy client portal: unused, kept until os-sunset.
  appUrl: APP_URL,
  ogImage: '/api/og',
  // Email senders. The domain (capucor.com) must be verified in Resend before
  // any of these will deliver. Resend only needs the DOMAIN verified, not a
  // real mailbox — so noreply@capucor.com works without an inbox existing.
  // Client-facing emails carry a reply-to of the monitored team@ address
  // (the one client-facing address everywhere, Zjak 2026-10-26).
  email: {
    sender: 'Capucor <noreply@capucor.com>',
    senderWebsite: 'Capucor Website <noreply@capucor.com>',
    senderPrivacy: 'Capucor Privacy <noreply@capucor.com>',
    replyTo: 'team@capucor.com',
    contact: 'team@capucor.com',
  },
  links: {
    facebook: 'https://www.facebook.com/capucorbusinesssolutions',
    instagram: 'https://www.instagram.com/capucorbusinesssolutions/',
    linkedin: 'https://www.linkedin.com/company/capucor/',
    // Every "Book a fit call" button goes here, not to the calendar: the
    // visitor answers the /contact questions first and the booking link
    // appears once they are sent (decision 2026-10-12). `booking` is used
    // directly only there and in the signing document.
    fitCall: '/contact',
    booking: process.env.NEXT_PUBLIC_BOOKING_URL ?? 'https://calendar.app.google/ixopmxLuGgNH5Lkk8',
  },
  // Header: Home, Pricing, Contact only (decision 2026-10-08). The service
  // pages are reached from the footer and the homepage cards.
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Contact', href: '/contact' },
  ],
};
