import { Caveat } from 'next/font/google';

// Handwriting face for the typed e-signature on /proposal/<token> and the hero
// sticky note. Its own module so only the pages that use it preload it: in
// fonts.ts (imported by the root layout) it was preloaded on every page
// (74.5 KB; technical review T04, full-site audit 2026-10-13). Self-hosted by
// next/font (no runtime network call on Cloudflare). Used both for the live
// preview and as the canvas font when rendering a typed signature to a PNG.
export const signatureFont = Caveat({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-signature',
  display: 'swap',
});
