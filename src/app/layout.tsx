import type { Metadata } from 'next';
import { geistSans, geistMono } from '@/lib/fonts';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { siteConfig } from '@/config/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
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
  authors: [{ name: 'Capucor Business Solutions', url: siteConfig.url }],
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: siteConfig.url,
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
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
