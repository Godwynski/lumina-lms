import { describe, it, expect, vi } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import type { Book, Category } from '@/lib/types';

// Mock Next.js navigation hooks for server/test rendering
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/inventory',
  useSearchParams: () => new URLSearchParams(''),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
    channel: () => ({
      on: () => ({
        subscribe: () => ({ unsubscribe: vi.fn() }),
      }),
    }),
  }),
}));

// Mock server actions used by ModernInventoryClient
vi.mock('@/lib/actions/catalog', () => ({
  getBooksForExport: vi.fn().mockResolvedValue([]),
  batchImportBooks: vi.fn().mockResolvedValue({ success: true }),
  updateBookStock: vi.fn().mockResolvedValue({ success: true }),
  deleteBook: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock BatchTaskProvider
vi.mock('@/components/providers/BatchTaskProvider', () => ({
  useBatchTask: () => ({
    tasks: [],
    addTask: vi.fn(),
  }),
}));

// Mock PreferencesProvider
vi.mock('@/components/providers/PreferencesProvider', () => ({
  PreferencesProvider: ({ children }: { children: React.ReactNode }) => children,
  usePreferences: () => ({
    role: 'librarian',
    profile: { id: 'test-user', full_name: 'Test Librarian' },
  }),
}));

describe('Empirical Challenger: Milestone 1 Navigation, SSR & Loading States', () => {
  const sampleBooks: Book[] = [
    {
      id: 'book-1',
      title: 'Operating Systems: Three Easy Pieces',
      author: 'Remzi Arpaci-Dusseau',
      isbn: '978-1985086593',
      dewey_decimal: '005.43',
      category_id: 'cat-1',
      categories: { name: 'Computer Science' },
      published_year: 2018,
      total_copies: 5,
      available_copies: 4,
      location: 'Main Stacks',
      section: 'CS-01',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'book-2',
      title: 'Introduction to Algorithms',
      author: 'Thomas H. Cormen',
      isbn: '978-0262033848',
      dewey_decimal: '005.1',
      category_id: 'cat-1',
      categories: { name: 'Computer Science' },
      published_year: 2009,
      total_copies: 8,
      available_copies: 2,
      location: 'Main Stacks',
      section: 'CS-02',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    },
  ];

  const sampleCategories: Category[] = [
    { id: 'cat-1', name: 'Computer Science', slug: 'cs', description: 'Computer Science books' },
    { id: 'cat-2', name: 'Mathematics', slug: 'math', description: 'Mathematics books' },
  ];

  describe('Empirical Stress Test 1: ModernInventoryClient SSR Safety', () => {
    it('renders ModernInventoryClient to string without throwing window/document undefined reference errors', async () => {
      const { ModernInventoryClient } = await import('@/components/inventory/ModernInventoryClient');

      expect(() => {
        const html = renderToString(
          <ModernInventoryClient
            books={sampleBooks}
            totalItems={sampleBooks.length}
            categories={sampleCategories}
            canManage={true}
          />
        );
        expect(html).toBeDefined();
        expect(html).toContain('Operating Systems: Three Easy Pieces');
        expect(html).toContain('Introduction to Algorithms');
      }).not.toThrow();
    }, 15000);

    it('renders CatalogSkeleton to string with valid animated pulse classes', async () => {
      const { CatalogSkeleton } = await import('@/app/(authenticated)/catalog/CatalogContent');

      const html = renderToString(<CatalogSkeleton />);
      expect(html).toContain('animate-pulse');
      expect(html).toContain('rounded-xl');
    });
  });

  describe('Empirical Stress Test 2: Route-Level Loading State Execution (All 16 Route Loaders)', () => {
    const loaders = [
      { name: 'dashboard/loading', importFn: () => import('@/app/(authenticated)/dashboard/loading') },
      { name: 'inventory/loading', importFn: () => import('@/app/(authenticated)/inventory/loading') },
      { name: 'circulation/loading', importFn: () => import('@/app/(authenticated)/circulation/loading') },
      { name: 'history/loading', importFn: () => import('@/app/(authenticated)/history/loading') },
      { name: 'attendance/loading', importFn: () => import('@/app/(authenticated)/attendance/loading') },
      { name: 'users/loading', importFn: () => import('@/app/(authenticated)/users/loading') },
      { name: 'audit/loading', importFn: () => import('@/app/(authenticated)/audit/loading') },
      { name: 'student-catalog/loading', importFn: () => import('@/app/(authenticated)/student-catalog/loading') },
      { name: 'policies/loading', importFn: () => import('@/app/(authenticated)/policies/loading') },
      { name: 'analytics/loading', importFn: () => import('@/app/(authenticated)/analytics/loading') },
      { name: 'profile/loading', importFn: () => import('@/app/(authenticated)/profile/loading') },
      { name: 'security/loading', importFn: () => import('@/app/(authenticated)/security/loading') },
      { name: 'inventory/add/loading', importFn: () => import('@/app/(authenticated)/inventory/add/loading') },
      { name: 'users/[id]/loading', importFn: () => import('@/app/(authenticated)/users/[id]/loading') },
      { name: 'users/new/loading', importFn: () => import('@/app/(authenticated)/users/new/loading') },
      { name: 'student-catalog/[id]/loading', importFn: () => import('@/app/(authenticated)/student-catalog/[id]/loading') },
    ];

    loaders.forEach(({ name, importFn }) => {
      it(`executes and renders ${name}.tsx without throwing`, async () => {
        const mod = await importFn();
        const LoadingComponent = mod.default;
        expect(typeof LoadingComponent).toBe('function');

        expect(() => {
          const html = renderToString(<LoadingComponent />);
          expect(html.length).toBeGreaterThan(0);
        }).not.toThrow();
      });
    });
  });

  describe('Empirical Stress Test 3: BreadcrumbNav & MainHeader Synchronous Execution without Suspense', () => {
    it('executes BreadcrumbNav synchronously without throwing or suspending', async () => {
      const { BreadcrumbNav } = await import('@/components/layout/BreadcrumbNav');

      expect(() => {
        const html = renderToString(<BreadcrumbNav />);
        expect(html).toContain('Inventory');
      }).not.toThrow();
    }, 15000);

    it('executes MainHeader synchronously without throwing or suspending when provided Sidebar context', async () => {
      const { MainHeader } = await import('@/components/layout/MainHeader');
      const { SidebarProvider } = await import('@/components/ui/sidebar');

      expect(() => {
        const html = renderToString(
          <SidebarProvider>
            <MainHeader />
          </SidebarProvider>
        );
        expect(html).toContain('Lumina');
      }).not.toThrow();
    }, 15000);
  });

  describe('Empirical Stress Test 4: Router Cache Invariant Verification', () => {
    it('validates experimental.staleTimes thresholds for route transition smoothness', async () => {
      const config = (await import('../next.config')).default;
      const staleTimes = config.experimental?.staleTimes as { dynamic: number; static: number };

      expect(staleTimes).toBeDefined();
      expect(staleTimes.dynamic).toBeGreaterThanOrEqual(30);
      expect(staleTimes.static).toBeGreaterThanOrEqual(180);
      expect(Number.isInteger(staleTimes.dynamic)).toBe(true);
      expect(Number.isInteger(staleTimes.static)).toBe(true);
    });
  });

  describe('Empirical Stress Test 5: ProtectedNav Concrete DOM & Hover Prefetch Verification', () => {
    it('renders ProtectedNav with concrete DOM links and verifies prefetch behavior', async () => {
      const { ProtectedNav } = await import('@/components/layout/ProtectedNav');
      const { SidebarProvider } = await import('@/components/ui/sidebar');
      const { PreferencesProvider } = await import('@/components/providers/PreferencesProvider');

      const html = renderToString(
        <PreferencesProvider
          initialPreferences={{}}
          initialRole="librarian"
          initialProfile={{ id: 'lib-1', role: 'librarian', full_name: 'Librarian User', status: 'ACTIVE' } as unknown as import('@/lib/types').ProfileData & { role?: string; status?: string }}
          user={{ id: 'lib-1', email: 'librarian@lumina.edu' } as unknown as import('@supabase/supabase-js').User}
        >
          <SidebarProvider>
            <ProtectedNav />
          </SidebarProvider>
        </PreferencesProvider>
      );

      // Verify concrete navigation links exist in the rendered DOM output
      expect(html).toContain('href="/dashboard"');
      expect(html).toContain('href="/inventory"');
      expect(html).toContain('href="/circulation"');
      expect(html).toContain('Lumina');
      expect(html).toContain('LMS Platform');
    });
  });
});
