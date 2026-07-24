import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const storageHostname = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
  output: 'standalone',
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
      // Public author activity index duplicates /blog posts already cloned.
      {
        source: '/profile/gosianowicka/profile',
        destination: '/blog',
        permanent: true,
      },
      // Member "browse events" originally pointed at /warsztaty (404); first-party catalog is /.
      {
        source: '/profile/gosianowicka/events',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
