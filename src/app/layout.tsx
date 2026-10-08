import type { Metadata } from 'next';
import { geistSans, geistMono } from '@/lib/fonts';
import { siteConfig } from '@/config/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.marketingUrl),
  title: {
    default: 'Capucor Business Solutions | Outsourced Finance for SMEs',
    template: '%s | Capucor Business Solutions',
  },
  description: siteConfig.description,
  keywords: [
    'outsourced accounting',
    'bookkeeping South Africa',
    'payroll services',
    'SME accounting',
    'Xero partner',
    'SAICA',
  ],
  authors: [{ name: 'Capucor Business Solutions', url: siteConfig.marketingUrl }],
  // No og title, description or url here. A page that sets no openGraph of its
  // own (privacy, terms, 404) inherits this object, and a fixed title/url would
  // make every such page share as the homepage. Left out, Next fills og:title
  // and og:description from the page's own metadata.
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    siteName: siteConfig.name,
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  // Card type only. With no twitter title/description/images set, Next copies
  // them from the page's resolved openGraph, so each page's share card matches
  // its own title. Setting them here pinned every page to the same card.
  twitter: {
    card: 'summary_large_image',
  },
  robots: { index: true, follow: true },
};

// Bare shell: <html> + fonts + globals + metadata only. Marketing chrome (Navbar/
// Footer) moved to app/(site)/layout.tsx so /proposal, /portal and /internal can
// render standalone with their own layouts (PR11). Every group inherits the fonts,
// globals.css and metadata from here.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-ZA"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="min-h-screen flex flex-col bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
