import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://ceramikanero.netlify.app';

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
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
