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
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: siteConfig.marketingUrl,
    title: {
      default: 'Capucor Business Solutions | Outsourced Finance for SMEs',
      template: '%s | Capucor Business Solutions',
    },
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [{ url: '/api/og', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: {
      default: 'Capucor Business Solutions',
      template: '%s | Capucor Business Solutions',
    },
    description: siteConfig.description,
    images: ['/api/og'],
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
