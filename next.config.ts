import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const storageHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;
const isNetlify = process.env.NETLIFY === 'true';

const nextConfig: NextConfig = {
  // Standalone is for Docker/self-host. On Netlify it inflates the server
  // handler beyond upload limits — the Next runtime plugin packages instead.
  ...(isNetlify ? {} : { output: 'standalone' as const }),
  serverExternalPackages: ['isomorphic-dompurify', 'jsdom'],
  outputFileTracingExcludes: {
    '*': [
      './reference/**/*',
      './tmp/**/*',
      './scripts/**/*',
      './docs/**/*',
      './supabase/**/*',
      './.git/**/*',
      './lib/clone/page-spec-headings.node.ts',
      'node_modules/playwright/**/*',
      'node_modules/@playwright/**/*',
      'node_modules/cheerio/**/*',
      'node_modules/jsdom/**/*',
    ],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: storageHostname
      ? [
          {
            protocol: 'https',
            hostname: storageHostname,
            pathname: '/storage/v1/object/public/media/**',
          },
        ]
      : [],
  },
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: '/onas',
        destination: '/pracownia',
        permanent: true,
      },
      {
        source: '/dladzieci',
        destination: '/dla-dzieci',
        permanent: true,
      },
      {
        source: '/dladoroslych',
        destination: '/dla-doroslych',
        permanent: true,
      },
      {
        source: '/dlafirm',
        destination: '/grupy-i-firmy',
        permanent: true,
      },
      {
        source: '/profile/gosianowicka/profile',
        destination: '/blog',
        permanent: true,
      },
      {
        source: '/profile/gosianowicka/events',
        destination: '/',
        permanent: true,
      },
      {
        source: '/copy-of-panie%C5%84ski-opis',
        destination: '/copy-of-panienski-opis',
        permanent: true,
      },
      {
        source: '/copy-of-panieński-opis',
        destination: '/copy-of-panienski-opis',
        permanent: true,
      },
      {
        source: '/kopia-panie%C5%84ski-plus-opis',
        destination: '/kopia-panienski-plus-opis',
        permanent: true,
      },
      {
        source: '/kopia-panieński-plus-opis',
        destination: '/kopia-panienski-plus-opis',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
