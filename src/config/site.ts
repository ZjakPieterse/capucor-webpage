// Two domains, two jobs. Keep them straight — picking the wrong one sends a
// client to a host that 301s them away, or mints a session on the wrong origin.
//
//   capucor.com — the public company: landing, service pages, pricing
//                 calculator, and the sales funnel through proposal signing.
//                 Everything indexable and every canonical URL.
//   capucor.app — Capucor OS: the client portal and the internal command
//                 centre. Auth lives here, because a session cookie set on one
//                 eTLD+1 is unreachable from the other — the two domains cannot
//                 share a login no matter what cookie domain is set.
//
// Both hosts are served by the same Worker today; the split is enforced by the
// host-based redirect table in next.config.ts. See "Domain seam" in AGENTS.md.
const MARKETING_URL = process.env.NEXT_PUBLIC_MARKETING_URL ?? 'https://capucor.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://capucor.app';

export const siteConfig = {
  name: 'Capucor Business Solutions',
  tagline: 'Outsourced finance for growing SMEs.',
  description:
    'Subscription accounting, bookkeeping, and payroll for South African SMEs. Fixed monthly pricing, Xero-powered, SAICA-aligned.',
  // Public site: canonicals, sitemap, OG tags, proposal + POPIA email links.
  marketingUrl: MARKETING_URL,
  // Capucor OS: login, portal, internal. Used for the portal invite on signing.
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
