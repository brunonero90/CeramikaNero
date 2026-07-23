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
};

export default nextConfig;
