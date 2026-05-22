import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : '';

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@radix-ui/react-avatar",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-slider",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-slot",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-switch",
      "@radix-ui/react-label",
      "@radix-ui/react-separator",
      "date-fns"
    ],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
    remotePatterns: [
      ...(supabaseHostname
        ? [{
            protocol: 'https' as const,
            hostname: supabaseHostname,
            port: '',
            pathname: '/storage/v1/object/public/**',
          }]
        : []),
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
  async redirects() {
    return [
      {
        source: '/settings',
        destination: '/profile',
        permanent: true,
      },
      {
        source: '/settings/:tab',
        destination: '/:tab',
        permanent: true,
      },
      {
        source: '/protected',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/protected/:path*',
        destination: '/:path*',
        permanent: true,
      },
    ];
  },
};

export default process.env.ANALYZE === "true"
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? require("@next/bundle-analyzer")({ enabled: true })(nextConfig)
  : nextConfig;
