// capucor.com is this site: landing, service pages, pricing calculator and the
// sales funnel through proposal signing. Everything indexable and every
// canonical URL uses MARKETING_URL.
//
// APP_URL is the legacy client portal (capucor.app), kept ONLY as the target of
// the Navbar's Client Portal link until os-sunset — the same lifetime as the
// /portal, /login, /internal redirects in next.config.ts. Do not add a new
// consumer: no email, signing page or API here links or calls capucor.app.
// See "Domain seam" in AGENTS.md.
const MARKETING_URL = process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://capucor.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://capucor.app';

export const siteConfig = {
  name: 'Capucor Business Solutions',
  tagline: 'Outsourced finance for owner-run businesses with staff.',
  description:
    'Monthly accounting, bookkeeping, payroll and SARS work for owner-run South African businesses with staff. One fixed monthly subscription, run in Xero.',
  // Public site: canonicals, sitemap, OG tags, proposal + POPIA email links.
  marketingUrl: MARKETING_URL,
  // Legacy client portal: the Navbar's Client Portal link only, until os-sunset.
  appUrl: APP_URL,
  ogImage: '/api/og',
  // Email senders. The domain (capucor.com) must be verified in Resend before
  // any of these will deliver. Resend only needs the DOMAIN verified, not a
  // real mailbox — so noreply@capucor.com works without an inbox existing.
  // Client-facing emails carry a reply-to of the monitored info@ address.
  email: {
    sender: 'Capucor <noreply@capucor.com>',
    senderWebsite: 'Capucor Website <noreply@capucor.com>',
    senderPrivacy: 'Capucor Privacy <noreply@capucor.com>',
    replyTo: 'info@capucor.com',
    contact: 'info@capucor.com',
  },
  links: {
    facebook: 'https://www.facebook.com/capucorbusinesssolutions',
    instagram: 'https://www.instagram.com/capucorbusinesssolutions/',
    linkedin: 'https://www.linkedin.com/company/capucor/',
    booking: process.env.NEXT_PUBLIC_BOOKING_URL ?? 'https://calendar.app.google/ixopmxLuGgNH5Lkk8',
  },
  nav: [
    { label: 'Home', href: '/' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'Contact', href: '/#contact' },
  ],
};
