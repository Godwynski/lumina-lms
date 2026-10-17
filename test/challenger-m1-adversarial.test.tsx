import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import * as fs from 'fs';
import * as path from 'path';

// Mock Next.js navigation hooks
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@/hooks/use-search-params-lite', () => ({
  useSearchParamsLite: () => ({
    get: (key: string) => (key === 'view' ? null : null),
  }),
}));

vi.mock('@/components/providers/PreferencesProvider', () => ({
  usePreferences: () => ({
    role: 'super_admin',
    profile: {
      id: 'admin-1',
      full_name: 'Super Admin',
      status: 'ACTIVE',
      permissions: { manage_attendance: true, manage_circulation: true },
    },
  }),
}));

vi.mock('@/hooks/use-logout', () => ({
  useLogout: () => ({
    isLoggingOut: false,
    handleLogout: vi.fn(),
  }),
}));

describe('Empirical Challenger M1: Adversarial Stress Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ========================================================================
   * 1. Adversarial Stress-Testing: ProtectedNav Prefetch Engine & Edge Cases
   * ======================================================================== */
  describe('1. ProtectedNav Prefetch & Input Edge Cases', () => {
    // Isolated oracle matching ProtectedNav handlePrefetch contract (ProtectedNav.tsx:166-170)
    function testPrefetchLogic(href: string, router: typeof mockRouter) {
      if (href && href !== '#' && !href.startsWith('javascript:')) {
        router.prefetch(href);
      }
    }

    it('ADVERSARIAL: safely ignores falsy, empty, and exact hash strings without calling prefetch', () => {
      const benignExclusions = ['', '#', undefined as unknown as string, null as unknown as string];
      
      benignExclusions.forEach((input) => {
        testPrefetchLogic(input, mockRouter);
      });

      expect(mockRouter.prefetch).not.toHaveBeenCalled();
    });

    it('ADVERSARIAL: blocks dangerous javascript pseudo-protocols from router.prefetch', () => {
      const xssPayloads = [
        'javascript:alert(1)',
        'javascript:void(0)',
        'javascript:document.cookie',
      ];

      xssPayloads.forEach((payload) => {
        expect(() => testPrefetchLogic(payload, mockRouter)).not.toThrow();
      });

      expect(mockRouter.prefetch).not.toHaveBeenCalled();
    });

    it('ADVERSARIAL: withstands rapid burst cursor hover events (100 sequential prefetch requests)', () => {
      const routes = [
        '/dashboard',
        '/inventory',
        '/circulation',
        '/history?view=logs',
        '/attendance',
        '/users',
        '/policies',
        '/audit',
      ];

      expect(() => {
        for (let i = 0; i < 100; i++) {
          const target = routes[i % routes.length];
          testPrefetchLogic(target, mockRouter);
        }
      }).not.toThrow();

      expect(mockRouter.prefetch).toHaveBeenCalledTimes(100);
      expect(mockRouter.prefetch).toHaveBeenCalledWith('/dashboard');
      expect(mockRouter.prefetch).toHaveBeenCalledWith('/circulation');
    });

    it('ADVERSARIAL: preserves query string parameters and special characters during prefetch dispatch', () => {
      const complexRoutes = [
        '/history?view=logs&page=2&filter=active',
        '/student-catalog?category=CS%20000-099',
        '/users?status=pending_approval',
      ];

      complexRoutes.forEach((route) => {
        testPrefetchLogic(route, mockRouter);
        expect(mockRouter.prefetch).toHaveBeenLastCalledWith(route);
      });
    });

    it('EMPIRICAL: executes ProtectedNav component rendering and verifies navigation links', async () => {
      const { ProtectedNav } = await import('@/components/layout/ProtectedNav');
      const { SidebarProvider } = await import('@/components/ui/sidebar');

      const html = renderToString(
        <SidebarProvider>
          <ProtectedNav
            role="super_admin"
            user={{ id: 'u1', email: 'admin@lumina.edu' } as unknown as import('@supabase/supabase-js').User}
            profile={{
              id: 'u1',
              full_name: 'Library Director',
              status: 'ACTIVE',
              permissions: { manage_attendance: true, manage_circulation: true },
            } as unknown as import('@/lib/auth/permissions').Profile}
          />
        </SidebarProvider>
      );

      // Verify essential links rendered in sidebar
      expect(html).toContain('href="/dashboard"');
      expect(html).toContain('href="/inventory"');
      expect(html).toContain('href="/circulation"');
      expect(html).toContain('href="/audit"');
      expect(html).toContain('href="/policies"');
      expect(html).toContain('Lumina');
    });
  });

  /* ========================================================================
   * 2. Role-Based Navigation Matrix: Permission Invariants & Link Integrity
   * ======================================================================== */
  describe('2. ProtectedNav Permission Invariants & Link Integrity', () => {
    it('verifies all static NAV_ITEMS have strictly valid relative paths and Lucide icons', async () => {
      const sourceCode = fs.readFileSync(
        path.join(process.cwd(), 'components/layout/ProtectedNav.tsx'),
        'utf8'
      );

      // Verify that all declared paths start with '/'
      const hrefMatches = [...sourceCode.matchAll(/href:\s*["']([^"']+)["']/g)].map(m => m[1]);
      expect(hrefMatches.length).toBeGreaterThan(0);

      hrefMatches.forEach((href) => {
        expect(href.startsWith('/')).toBe(true);
        expect(href).not.toContain('undefined');
        expect(href).not.toContain('null');
        expect(href).not.toMatch(/^https?:\/\//); // No external hardcoded navigation items
      });
    });
  });

  /* ========================================================================
   * 3. Empirical Execution of All 16 Route Loading Components
   * ======================================================================== */
  describe('3. Empirical Execution & Idempotence of All 16 Route Loading Components', () => {
    const loaders = [
      { name: 'analytics/loading', path: 'app/(authenticated)/analytics/loading.tsx' },
      { name: 'attendance/loading', path: 'app/(authenticated)/attendance/loading.tsx' },
      { name: 'audit/loading', path: 'app/(authenticated)/audit/loading.tsx' },
      { name: 'circulation/loading', path: 'app/(authenticated)/circulation/loading.tsx' },
      { name: 'dashboard/loading', path: 'app/(authenticated)/dashboard/loading.tsx' },
      { name: 'history/loading', path: 'app/(authenticated)/history/loading.tsx' },
      { name: 'inventory/loading', path: 'app/(authenticated)/inventory/loading.tsx' },
      { name: 'inventory/add/loading', path: 'app/(authenticated)/inventory/add/loading.tsx' },
      { name: 'policies/loading', path: 'app/(authenticated)/policies/loading.tsx' },
      { name: 'profile/loading', path: 'app/(authenticated)/profile/loading.tsx' },
      { name: 'security/loading', path: 'app/(authenticated)/security/loading.tsx' },
      { name: 'student-catalog/loading', path: 'app/(authenticated)/student-catalog/loading.tsx' },
      { name: 'student-catalog/[id]/loading', path: 'app/(authenticated)/student-catalog/[id]/loading.tsx' },
      { name: 'users/loading', path: 'app/(authenticated)/users/loading.tsx' },
      { name: 'users/[id]/loading', path: 'app/(authenticated)/users/[id]/loading.tsx' },
      { name: 'users/new/loading', path: 'app/(authenticated)/users/new/loading.tsx' },
    ];

    loaders.forEach(({ name, path: relPath }) => {
      it(`EMPIRICAL: renders ${name} synchronously, confirms non-async export and valid pulse/spin DOM`, async () => {
        const fullPath = path.join(process.cwd(), relPath);
        expect(fs.existsSync(fullPath)).toBe(true);

        const content = fs.readFileSync(fullPath, 'utf8');

        // CRITICAL INVARIANT: loading.tsx must NOT be an async function (causes Suspense deadlocks in Next.js)
        expect(content).not.toMatch(/export\s+default\s+async\s+function/);

        // Dynamically import module
        const mod = await import(path.resolve(fullPath));
        const Component = mod.default;
        expect(typeof Component).toBe('function');

        // Render to string
        const html = renderToString(<Component />);
        expect(html).toBeDefined();
        expect(html.length).toBeGreaterThan(10);

        // Verify skeleton visual feedback class presence
        const hasPulse = html.includes('animate-pulse');
        const hasSpin = html.includes('animate-spin');
        const hasMuted = html.includes('bg-muted');
        expect(hasPulse || hasSpin || hasMuted).toBe(true);

        // IDEMPOTENCE STRESS: Render 10 times consecutively, verify DOM consistency
        for (let i = 0; i < 10; i++) {
          const iteratedHtml = renderToString(<Component />);
          expect(iteratedHtml).toBe(html);
        }
      });
    });
  });

  /* ========================================================================
   * 4. Next.js Config staleTimes & Experimental Safety Oracle
   * ======================================================================== */
  describe('4. Next.js staleTimes & Invariant Bounds', () => {
    it('verifies staleTimes adheres to freshness invariants (dynamic <= 60s, static <= 300s)', async () => {
      const nextConfig = (await import('../next.config')).default;
      const staleTimes = nextConfig.experimental?.staleTimes;

      expect(staleTimes).toBeDefined();
      expect(typeof staleTimes?.dynamic).toBe('number');
      expect(typeof staleTimes?.static).toBe('number');

      // Invariant: dynamic stale time must be short enough to prevent data staleness (<= 60s)
      expect(staleTimes!.dynamic).toBeGreaterThanOrEqual(15);
      expect(staleTimes!.dynamic).toBeLessThanOrEqual(60);

      // Invariant: static stale time must be >= dynamic stale time
      expect(staleTimes!.static!).toBeGreaterThanOrEqual(staleTimes!.dynamic!);

      // Invariant: poweredByHeader must remain false for OWASP compliance
      expect(nextConfig.poweredByHeader).toBe(false);
    });

    it('verifies security headers function returns valid CSP and HSTS', async () => {
      const nextConfig = (await import('../next.config')).default;
      expect(typeof nextConfig.headers).toBe('function');

      const headersList = await nextConfig.headers!();
      expect(Array.isArray(headersList)).toBe(true);
      expect(headersList.length).toBeGreaterThan(0);

      const rootHeaderEntry = headersList.find((h: { source: string }) => h.source === '/(.*)');
      expect(rootHeaderEntry).toBeDefined();

      const headerKeys = rootHeaderEntry!.headers.map((h: { key: string }) => h.key.toLowerCase());
      expect(headerKeys).toContain('content-security-policy');
      expect(headerKeys).toContain('strict-transport-security');
      expect(headerKeys).toContain('x-frame-options');
    });
  });

  /* ========================================================================
   * 5. Structural Decoupling & Elimination of Waterfall Renders
   * ======================================================================== */
  describe('5. Structural Decoupling & Anti-Waterfall Invariants', () => {
    it('verifies CatalogContent does not use dynamic import with ssr: false', () => {
      const catalogContentCode = fs.readFileSync(
        path.join(process.cwd(), 'app/(authenticated)/catalog/CatalogContent.tsx'),
        'utf8'
      );

      expect(catalogContentCode).not.toContain('ssr: false');
      expect(catalogContentCode).not.toContain("from 'next/dynamic'");
      expect(catalogContentCode).not.toContain('from "next/dynamic"');
    });

    it('verifies app/(authenticated)/layout.tsx does not introduce nested Suspense around sync headers/navs', () => {
      const layoutCode = fs.readFileSync(
        path.join(process.cwd(), 'app/(authenticated)/layout.tsx'),
        'utf8'
      );

      expect(layoutCode).not.toMatch(/<Suspense[^>]*>\s*<StreamedNav/);
      expect(layoutCode).not.toMatch(/<Suspense[^>]*>\s*<BreadcrumbNav/);
      expect(layoutCode).not.toMatch(/<Suspense[^>]*>\s*<MainHeader/);
    });

    it('verifies circulation page and layout do not wrap wizard or guards in redundant Suspense', () => {
      const circLayout = fs.readFileSync(
        path.join(process.cwd(), 'app/(authenticated)/circulation/layout.tsx'),
        'utf8'
      );
      const circPage = fs.readFileSync(
        path.join(process.cwd(), 'app/(authenticated)/circulation/page.tsx'),
        'utf8'
      );

      expect(circLayout).not.toMatch(/<Suspense[^>]*>\s*<CirculationGuard/);
      expect(circPage).not.toMatch(/<Suspense[^>]*>\s*<CirculationWizard/);
    });
  });
});
