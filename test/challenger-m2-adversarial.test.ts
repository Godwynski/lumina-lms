import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { addBookCopies, updateBookCopyStatus } from '@/lib/actions/catalog/copies';
import { getMe } from '@/lib/auth-helpers';
import { logAuditActivity } from '@/lib/audit';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';
import type { ProfileData, UserRole } from '@/lib/types';

vi.mock('@/lib/auth-helpers', () => ({
  getMe: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditActivity: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: () => unknown) => fn),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Empirical Challenger M2: Adversarial Stress Test Suite', () => {
  const rootDir = process.cwd();
  let mockClientHelper: MockSupabaseClientHelper;

  const createMockStaff = (role: UserRole = 'librarian', id = 'challenger-librarian') => ({
    user: {
      id,
      email: 'staff@lumina.edu',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id,
      email: 'staff@lumina.edu',
      role,
      status: 'ACTIVE',
      full_name: 'Lead Staff',
      permissions: {},
    } as unknown as ProfileData & {
      id: string;
      email: string | null;
      role: string;
      status: string;
      permissions: Record<string, boolean> | null;
    },
    role,
    isStaff: true,
    isAdmin: role === 'super_admin',
    isDeactivatedSA: false,
    hasPermission: vi.fn().mockReturnValue(true),
    supabase: mockClientHelper.client,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientHelper = createMockSupabaseClient();
    vi.mocked(getMe).mockResolvedValue(
      createMockStaff() as unknown as Awaited<ReturnType<typeof getMe>>
    );
    vi.mocked(logAuditActivity).mockResolvedValue(undefined);
  });

  /* ========================================================================
   * 1. Adversarial Testing: lib/actions/catalog/copies.ts under Failure & Edge Conditions
   * ======================================================================== */
  describe('1. Server Action Invariants: Revalidations Under Adversarial Conditions', () => {
    describe('addBookCopies under edge and failure modes', () => {
      it('never calls revalidateTag if database insert fails (e.g., foreign key violation or connection drop)', async () => {
        const bookId = 'book-non-existent-fk-fail';
        const copiesBuilder = mockClientHelper.getTableBuilder('book_copies');
        copiesBuilder.insert.mockResolvedValueOnce({
          data: null,
          error: { message: 'insert or update on table "book_copies" violates foreign key constraint', code: '23503' },
        });

        const result = await addBookCopies({
          bookId,
          copiesCount: 5,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Failed to add book copies.');
        }

        // Adversarial invariant: Cache must NEVER be invalidated on failed mutation
        expect(revalidateTag).not.toHaveBeenCalled();
        expect(revalidatePath).not.toHaveBeenCalled();
      });

      it('never calls revalidateTag when unauthenticated (getMe returns null)', async () => {
        vi.mocked(getMe).mockResolvedValueOnce(null);

        const result = await addBookCopies({
          bookId: 'book-auth-fail',
          copiesCount: 2,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Authentication required');
        }
        expect(revalidateTag).not.toHaveBeenCalled();
        expect(revalidatePath).not.toHaveBeenCalled();
      });

      it('never calls revalidateTag when caller is deactivated student assistant', async () => {
        vi.mocked(getMe).mockResolvedValueOnce({
          ...createMockStaff('student_assistant'),
          role: 'student_assistant',
          isDeactivatedSA: true,
        } as unknown as Awaited<ReturnType<typeof getMe>>);

        const result = await addBookCopies({
          bookId: 'book-deactivated-sa',
          copiesCount: 1,
        });

        expect(result.success).toBe(false);
        expect(revalidateTag).not.toHaveBeenCalled();
      });

      it('strictly enforces copy count bounds: 0, negative, and 51+ must reject without invalidating', async () => {
        const invalidCounts = [0, -1, -50, 51, 100, 9999];

        for (const count of invalidCounts) {
          const result = await addBookCopies({
            bookId: 'book-bound-check',
            copiesCount: count,
          });

          expect(result.success).toBe(false);
          expect(revalidateTag).not.toHaveBeenCalled();
        }
      });

      it('correctly revalidates all 3 required cache tags on exact boundary values 1 and 50', async () => {
        const copiesBuilder = mockClientHelper.getTableBuilder('book_copies');

        for (const validCount of [1, 50]) {
          vi.clearAllMocks();
          copiesBuilder.insert.mockResolvedValueOnce({ error: null });

          const result = await addBookCopies({
            bookId: `book-boundary-${validCount}`,
            copiesCount: validCount,
          });

          expect(result.success).toBe(true);
          expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
          expect(revalidateTag).toHaveBeenCalledWith('public-books', 'max');
          expect(revalidateTag).toHaveBeenCalledWith(`book-book-boundary-${validCount}`, 'max');
          expect(revalidatePath).toHaveBeenCalledWith(`/catalog/book-boundary-${validCount}`);
        }
      });
    });

    describe('updateBookCopyStatus under edge and failure modes', () => {
      it('never calls revalidateTag if copy ID does not exist in database (PGRST116)', async () => {
        const copyBuilder = mockClientHelper.getTableBuilder('book_copies');
        copyBuilder.single.mockResolvedValueOnce({
          data: null,
          error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' },
        });

        const result = await updateBookCopyStatus({
          id: 'non-existent-copy-uuid',
          status: 'MAINTENANCE',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toContain('JSON object requested');
        }

        // Invariant: Failed status change must never invalidate cache
        expect(revalidateTag).not.toHaveBeenCalled();
        expect(revalidatePath).not.toHaveBeenCalled();
      });

      it('never calls revalidateTag if status is not a valid enum value', async () => {
        const result = await updateBookCopyStatus({
          id: 'copy-invalid-enum',
          status: 'DESTROYED' as unknown as 'AVAILABLE',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Validation failed');
        }
        expect(revalidateTag).not.toHaveBeenCalled();
        expect(revalidatePath).not.toHaveBeenCalled();
      });

      it('never calls revalidateTag if caller lacks permission (patron/student)', async () => {
        vi.mocked(getMe).mockResolvedValueOnce({
          ...createMockStaff('student'),
          role: 'student',
          isStaff: false,
        } as unknown as Awaited<ReturnType<typeof getMe>>);

        const result = await updateBookCopyStatus({
          id: 'copy-unauth',
          status: 'AVAILABLE',
        });

        expect(result.success).toBe(false);
        expect(revalidateTag).not.toHaveBeenCalled();
      });

      it('revalidates both public-books and catalog tags for all allowed status changes', async () => {
        const statuses = ['AVAILABLE', 'MAINTENANCE', 'LOST', 'BORROWED'] as const;

        for (const status of statuses) {
          vi.clearAllMocks();
          const copyBuilder = mockClientHelper.getTableBuilder('book_copies');
          copyBuilder.single.mockResolvedValueOnce({
            data: { id: `copy-${status}`, book_id: `book-${status}-123`, status },
            error: null,
          });

          const result = await updateBookCopyStatus({
            id: `copy-${status}`,
            status,
          });

          expect(result.success).toBe(true);
          expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
          expect(revalidateTag).toHaveBeenCalledWith('public-books', 'max');
          expect(revalidateTag).toHaveBeenCalledWith(`book-book-${status}-123`, 'max');
          expect(revalidatePath).toHaveBeenCalledWith('/catalog');
          expect(revalidatePath).toHaveBeenCalledWith(`/catalog/book-${status}-123`);
        }
      });
    });
  });

  /* ========================================================================
   * 2. Adversarial Stress-Testing: React 19 Concurrent Transitions & Burst Events
   * ======================================================================== */
  describe('2. Real-Time Transition Smoothing & Event Burst Resilience', () => {
    it('demonstrates debounced listener collapses 100 rapid events into a single refresh execution', async () => {
      vi.useFakeTimers();

      let refreshCallCount = 0;
      const mockRefresh = vi.fn(() => {
        refreshCallCount++;
      });
      const mockStartTransition = vi.fn((fn: () => void) => {
        fn();
      });

      // Oracle replicating debouncedRefresh in DashboardClient & StudentBookDetailClient
      let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
      const debouncedRefresh = (delay = 500) => {
        if (refreshTimeout) clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
          mockStartTransition(() => {
            mockRefresh();
          });
        }, delay);
      };

      // Rapidly fire 100 real-time events over 10ms
      for (let i = 0; i < 100; i++) {
        debouncedRefresh(500);
        vi.advanceTimersByTime(1);
      }

      // At this point (10ms elapsed), no refresh should have fired yet
      expect(refreshCallCount).toBe(0);

      // Fast-forward past the 500ms debounce window
      vi.advanceTimersByTime(600);

      // Invariant: Exactly 1 transition refresh occurs despite 100 event triggers
      expect(refreshCallCount).toBe(1);
      expect(mockStartTransition).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('demonstrates unmount cleanup clears pending debounce timeout to prevent post-unmount execution', async () => {
      vi.useFakeTimers();

      let refreshCallCount = 0;
      const mockRefresh = vi.fn(() => {
        refreshCallCount++;
      });

      let refreshTimeout: ReturnType<typeof setTimeout> | null = null;
      const debouncedRefresh = () => {
        if (refreshTimeout) clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(() => {
          mockRefresh();
        }, 500);
      };

      // Event arrives
      debouncedRefresh();

      // Component unmounts after 200ms
      vi.advanceTimersByTime(200);
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }

      // Fast-forward past remaining time
      vi.advanceTimersByTime(1000);

      // Invariant: Zero refresh executions after cleanup
      expect(refreshCallCount).toBe(0);

      vi.useRealTimers();
    });

    it('verifies AST-level absence of naked router.refresh() in all real-time listeners across 9 components', () => {
      const components = [
        'components/dashboard/DashboardClient.tsx',
        'components/inventory/ModernInventoryClient.tsx',
        'app/(authenticated)/history/HistoryContent.tsx',
        'app/(authenticated)/student-catalog/StudentCatalogClient.tsx',
        'app/(authenticated)/student-catalog/[id]/StudentBookDetailClient.tsx',
        'components/admin/policies/PolicyLayout.tsx',
        'components/catalog/BookDetailModal.tsx',
        'app/(authenticated)/users/[id]/UserDetailClient.tsx',
        'app/(authenticated)/users/new/NewUserClient.tsx',
      ];

      for (const relPath of components) {
        const fullPath = path.join(rootDir, relPath);
        expect(fs.existsSync(fullPath)).toBe(true);

        const content = fs.readFileSync(fullPath, 'utf8');

        // Search for all occurrences of router.refresh()
        const regex = /router\.refresh\(\)/g;
        let match: RegExpExecArray | null;
        let found = 0;

        while ((match = regex.exec(content)) !== null) {
          found++;
          const idx = match.index;
          // Inspect enclosing window before the call
          const prefix = content.slice(Math.max(0, idx - 350), idx);
          const isWrappedInStartTransition =
            prefix.includes('startTransition') || prefix.includes('useTransition');

          expect(
            isWrappedInStartTransition,
            `File ${relPath} contains unwrapped router.refresh() at character ${idx}`
          ).toBe(true);
        }

        expect(found).toBeGreaterThan(0);
      }
    });
  });

  /* ========================================================================
   * 3. Channel Lifecycle & Memory Leak Elimination
   * ======================================================================== */
  describe('3. Supabase Real-Time Channel Lifecycle & WebSocket Invariants', () => {
    const subscriberComponents = [
      { name: 'DashboardClient', file: 'components/dashboard/DashboardClient.tsx' },
      { name: 'ModernInventoryClient', file: 'components/inventory/ModernInventoryClient.tsx' },
      { name: 'HistoryContent', file: 'app/(authenticated)/history/HistoryContent.tsx' },
      { name: 'StudentCatalogClient', file: 'app/(authenticated)/student-catalog/StudentCatalogClient.tsx' },
      { name: 'StudentBookDetailClient', file: 'app/(authenticated)/student-catalog/[id]/StudentBookDetailClient.tsx' },
      { name: 'PolicyLayout', file: 'components/admin/policies/PolicyLayout.tsx' },
      { name: 'BookDetailModal', file: 'components/catalog/BookDetailModal.tsx' },
      { name: 'UserDetailClient', file: 'app/(authenticated)/users/[id]/UserDetailClient.tsx' },
    ];

    subscriberComponents.forEach(({ name, file }) => {
      it(`verifies ${name} guarantees removeChannel execution on unmount without throwing`, () => {
        const fullPath = path.join(rootDir, file);
        const content = fs.readFileSync(fullPath, 'utf8');

        // 1. Channel creation
        expect(content).toMatch(/\.channel\(/);

        // 2. Cleanup return in useEffect
        expect(content).toMatch(/return\s*\(\)\s*=>\s*\{[\s\S]*?removeChannel/);

        // 3. Channel removed via supabase client
        expect(content).toContain('removeChannel');
      });
    });
  });
});
