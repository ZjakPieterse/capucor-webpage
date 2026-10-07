import type { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      // /api/og is the Open Graph / Twitter card image every page points at.
      // Link-preview crawlers that honour robots.txt (X/Twitterbot, LinkedIn)
      // will not fetch an image under a disallowed path, so the share card
      // falls back to no image. The more specific Allow wins over /api/.
      allow: ['/', '/api/og'],
      disallow: '/api/',
    },
    sitemap: `${siteConfig.marketingUrl}/sitemap.xml`,
  };
}
