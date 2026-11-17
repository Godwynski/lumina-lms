import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Manrope: () => ({ className: 'manrope-mock', variable: '--font-app-sans' }),
}));

vi.mock('@vercel/speed-insights/next', () => ({
  SpeedInsights: () => null,
}));

vi.mock('sonner', () => ({
  Toaster: () => null,
}));

vi.mock('@/components/providers/animation-provider', () => ({
  AnimationProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/app/(authenticated)/_components/StreamedNav', () => ({
  StreamedNav: () => null,
}));

vi.mock('@/app/(authenticated)/_components/SWRProvider', () => ({
  SWRProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/app/(authenticated)/NavAnimatePresence', () => ({
  default: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/lib/auth-helpers', () => ({
  getMe: vi.fn(),
  getPreferences: vi.fn(),
}));

describe('SEO Metadata & Sitemap', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('exports noindex/nofollow robots metadata from (authenticated) and (auth) layouts', async () => {
    const [authenticatedLayout, authLayout] = await Promise.all([
      import('@/app/(authenticated)/layout'),
      import('@/app/(auth)/layout'),
    ]);

    expect(authenticatedLayout.metadata.robots).toEqual({ index: false, follow: false });
    expect(authLayout.metadata.robots).toEqual({ index: false, follow: false });
  });

  it('prefers NEXT_PUBLIC_SITE_URL over VERCEL_URL for root metadataBase and openGraph.url', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://stilumina.vercel.app');
    vi.stubEnv('VERCEL_URL', 'preview-branch-123.vercel.app');

    const rootLayout = await import('@/app/layout');
    expect(rootLayout.metadata.metadataBase?.toString()).toBe('https://stilumina.vercel.app/');
    expect(rootLayout.metadata.openGraph?.url).toBe('https://stilumina.vercel.app');
  });

  it('falls back to VERCEL_URL then localhost when NEXT_PUBLIC_SITE_URL is unset in root layout', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('VERCEL_URL', 'preview-branch-123.vercel.app');

    const withVercel = await import('@/app/layout');
    expect(withVercel.metadata.metadataBase?.toString()).toBe('https://preview-branch-123.vercel.app/');

    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('VERCEL_URL', '');

    const withLocal = await import('@/app/layout');
    expect(withLocal.metadata.metadataBase?.toString()).toBe('http://127.0.0.1:3000/');
  });

  it('generates sitemap() entries using NEXT_PUBLIC_SITE_URL or canonical fallback', async () => {
    const { default: sitemap } = await import('@/app/sitemap');

    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    const defaultEntries = sitemap();
    expect(defaultEntries).toHaveLength(1);
    expect(defaultEntries[0].url).toBe('https://stilumina.vercel.app');
    expect(defaultEntries[0].changeFrequency).toBe('daily');
    expect(defaultEntries[0].priority).toBe(1);

    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://custom-library.edu');
    const customEntries = sitemap();
    expect(customEntries).toHaveLength(1);
    expect(customEntries[0].url).toBe('https://custom-library.edu');
  });
});
