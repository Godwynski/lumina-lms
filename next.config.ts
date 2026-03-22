import type { NextConfig } from "next";

const nextConfig = {
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
  allowedDevOrigins: ['localhost', '127.0.0.1'],
} satisfies NextConfig & {
  allowedDevOrigins?: string[];
};

export default nextConfig;
