import { Geist, Geist_Mono, Caveat } from 'next/font/google';

export const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

// Handwriting face for the typed e-signature on /proposal/<token>. Self-hosted
// by next/font (no runtime network call on Cloudflare). Used both for the live
// preview and as the canvas font when rendering a typed signature to a PNG.
export const signatureFont = Caveat({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-signature',
  display: 'swap',
});
