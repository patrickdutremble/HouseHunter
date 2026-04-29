import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mspublic.centris.ca',
        pathname: '/**',
      },
    ],
    qualities: [75],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2678400, // 31 days — Centris image URLs include hashes, safe to cache long
  },
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
});
