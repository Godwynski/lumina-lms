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
  experimental: {
    allowedDevOrigins: ['localhost', '127.0.0.1'],
  },
} satisfies NextConfig & {
  experimental?: NextConfig["experimental"] & {
    allowedDevOrigins?: string[];
  };
};

export default nextConfig;
