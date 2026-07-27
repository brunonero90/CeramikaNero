import type { MetadataRoute } from 'next';
import { shouldDisallowPublicIndexing } from '@/lib/seo/indexing';

export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://ceramikanero.pl';

  if (shouldDisallowPublicIndexing()) {
    return {
      rules: [
        {
          userAgent: '*',
          disallow: '/',
        },
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api/',
          '/rezerwacja/',
          '/cart',
          '/cart/',
          '/checkout',
          '/zamowienie/',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
