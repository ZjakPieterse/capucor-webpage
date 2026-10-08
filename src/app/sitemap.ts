import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';
import { SITEMAP_PATHS } from '@/config/sitemap';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.marketingUrl;
  return SITEMAP_PATHS.map(({ path, changeFrequency, priority }) => ({
    url: path === '/' ? `${base}/` : `${base}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
