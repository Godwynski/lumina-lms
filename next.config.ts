import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lvifzwbafxpopzcgdvtt.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    // @ts-ignore
    allowedDevOrigins: ['localhost', '127.0.0.1'],
  },
};

export default nextConfig;
