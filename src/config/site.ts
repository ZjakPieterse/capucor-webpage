export const siteConfig = {
  name: 'Capucor Business Solutions',
  tagline: 'Outsourced finance for growing SMEs.',
  description:
    'Subscription accounting, bookkeeping, and payroll for South African SMEs. Fixed monthly pricing, Xero-powered, SAICA-aligned.',
  url: 'https://capucor.app',
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
