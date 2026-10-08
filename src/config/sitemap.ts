import type { MetadataRoute } from 'next';

// Every indexable public page, consumed by app/sitemap.ts. A page linked from
// the site but missing here is still crawlable, but search engines treat the
// sitemap as the list of pages we want found, so keep it in step with
// app/(site)/. /proposal/* is deliberately absent: those pages are per-client
// and noindex. `seo.test.ts` fails if a (site) page is added without an entry.
export const SITEMAP_PATHS: ReadonlyArray<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
}> = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/pricing', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/accounting', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/bookkeeping', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/payroll', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/resources/compliance-calendar', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/terms/engagement', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
];
