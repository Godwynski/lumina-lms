import type { NextConfig } from "next";

const nextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "@radix-ui/react-avatar", "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-select", "@radix-ui/react-tooltip"],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lvifzwbafxpopzcgdvtt.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'covers.openlibrary.org',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'books.google.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'books.google.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  allowedDevOrigins: ['localhost', '127.0.0.1'],
} satisfies NextConfig & {
  allowedDevOrigins?: string[];
};

export default nextConfig;
