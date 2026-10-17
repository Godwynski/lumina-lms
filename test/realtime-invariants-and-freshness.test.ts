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

describe('Milestone 2: Real-Time Invariants, Data Freshness & Regression Shield', () => {
  const rootDir = process.cwd();
  let mockClientHelper: MockSupabaseClientHelper;

  const mockStaffUser = (role: UserRole = 'librarian', id = 'librarian-m2') => ({
    user: {
      id,
      email: 'librarian@lumina.edu',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id,
      email: 'librarian@lumina.edu',
      role,
      status: 'ACTIVE',
      full_name: 'Lead Librarian',
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
      mockStaffUser() as unknown as Awaited<ReturnType<typeof getMe>>
    );
    vi.mocked(logAuditActivity).mockResolvedValue(undefined);
  });

  describe('1. Copy Mutation Tag Invalidation in lib/actions/catalog/copies.ts', () => {
    describe('addBookCopies', () => {
      it('calls revalidateTag for catalog, public-books, and book-${bookId} on success', async () => {
        const bookId = 'book-fresh-101';
        const copiesBuilder = mockClientHelper.getTableBuilder('book_copies');
        copiesBuilder.insert.mockResolvedValueOnce({ error: null });

        const result = await addBookCopies({
          bookId,
          copiesCount: 3,
        });

        expect(result.success).toBe(true);
        expect(copiesBuilder.insert).toHaveBeenCalledWith(
          expect.arrayContaining([
            { book_id: bookId, status: 'AVAILABLE' },
          ])
        );

        // Required tag and path invalidations
        expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
        expect(revalidateTag).toHaveBeenCalledWith('public-books', 'max');
        expect(revalidateTag).toHaveBeenCalledWith(`book-${bookId}`, 'max');
        expect(revalidatePath).toHaveBeenCalledWith(`/catalog/${bookId}`);
      });

      it('rejects copyCount exceeding maximum limit of 50', async () => {
        const result = await addBookCopies({
          bookId: 'book-invalid-count',
          copiesCount: 51,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Validation failed');
        }
        expect(revalidateTag).not.toHaveBeenCalled();
      });

      it('rejects copyCount less than minimum limit of 1', async () => {
        const result = await addBookCopies({
          bookId: 'book-invalid-min',
          copiesCount: 0,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Validation failed');
        }
        expect(revalidateTag).not.toHaveBeenCalled();
      });

      it('rejects unauthorized role (student)', async () => {
        vi.mocked(getMe).mockResolvedValue({
          ...mockStaffUser('student', 'student-1'),
          role: 'student',
          isStaff: false,
          isAdmin: false,
        } as unknown as Awaited<ReturnType<typeof getMe>>);

        const result = await addBookCopies({
          bookId: 'book-unauth',
          copiesCount: 2,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Unauthorized access');
        }
        expect(revalidateTag).not.toHaveBeenCalled();
      });
    });

    describe('updateBookCopyStatus', () => {
      it('calls revalidateTag for catalog, public-books, and book-${book_id} on status update', async () => {
        const copyBuilder = mockClientHelper.getTableBuilder('book_copies');
        const borrowBuilder = mockClientHelper.getTableBuilder('borrowing_records');

        copyBuilder.single.mockResolvedValueOnce({
          data: { id: 'copy-inv-1', book_id: 'book-inv-999', status: 'AVAILABLE' },
          error: null,
        });

        const result = await updateBookCopyStatus({
          id: 'copy-inv-1',
          status: 'AVAILABLE',
        });

        expect(result.success).toBe(true);
        expect(copyBuilder.update).toHaveBeenCalledWith({ status: 'AVAILABLE' });
        expect(borrowBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'RETURNED' })
        );

        // Invariant: must invalidate both public-books and catalog tags
        expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
        expect(revalidateTag).toHaveBeenCalledWith('public-books', 'max');
        expect(revalidateTag).toHaveBeenCalledWith('book-book-inv-999', 'max');
        expect(revalidatePath).toHaveBeenCalledWith('/catalog');
        expect(revalidatePath).toHaveBeenCalledWith('/catalog/book-inv-999');
      });

      it('calls revalidateTag on MAINTENANCE status update and closes lingering active borrows', async () => {
        const copyBuilder = mockClientHelper.getTableBuilder('book_copies');
        const borrowBuilder = mockClientHelper.getTableBuilder('borrowing_records');

        copyBuilder.single.mockResolvedValueOnce({
          data: { id: 'copy-maint-1', book_id: 'book-maint-555', status: 'MAINTENANCE' },
          error: null,
        });

        const result = await updateBookCopyStatus({
          id: 'copy-maint-1',
          status: 'MAINTENANCE',
        });

        expect(result.success).toBe(true);
        expect(borrowBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'RETURNED' })
        );
        expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
        expect(revalidateTag).toHaveBeenCalledWith('public-books', 'max');
        expect(revalidateTag).toHaveBeenCalledWith('book-book-maint-555', 'max');
      });

      it('calls revalidateTag on BORROWED status update without modifying borrowing records', async () => {
        const copyBuilder = mockClientHelper.getTableBuilder('book_copies');
        const borrowBuilder = mockClientHelper.getTableBuilder('borrowing_records');

        copyBuilder.single.mockResolvedValueOnce({
          data: { id: 'copy-borrow-1', book_id: 'book-borrow-222', status: 'BORROWED' },
          error: null,
        });

        const result = await updateBookCopyStatus({
          id: 'copy-borrow-1',
          status: 'BORROWED',
        });

        expect(result.success).toBe(true);
        expect(borrowBuilder.update).not.toHaveBeenCalled();
        expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
        expect(revalidateTag).toHaveBeenCalledWith('public-books', 'max');
        expect(revalidateTag).toHaveBeenCalledWith('book-book-borrow-222', 'max');
        expect(revalidatePath).toHaveBeenCalledWith('/catalog');
        expect(revalidatePath).toHaveBeenCalledWith('/catalog/book-borrow-222');
      });

      it('rejects update when caller is student_assistant', async () => {
        vi.mocked(getMe).mockResolvedValue({
          ...mockStaffUser('student_assistant', 'sa-1'),
          role: 'student_assistant',
          isAdmin: false,
        } as unknown as Awaited<ReturnType<typeof getMe>>);

        const result = await updateBookCopyStatus({
          id: 'copy-sa',
          status: 'AVAILABLE',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Unauthorized access');
        }
        expect(revalidateTag).not.toHaveBeenCalled();
      });
    });
  });

  describe('2. Real-Time Transition Smoothing (startTransition wrapping router.refresh)', () => {
    const targetComponents = [
      {
        name: 'DashboardClient',
        filePath: 'components/dashboard/DashboardClient.tsx',
        description: 'debouncedRefresh wrapped in startTransition',
      },
      {
        name: 'ModernInventoryClient',
        filePath: 'components/inventory/ModernInventoryClient.tsx',
        description: 'realtime subscription handlers wrapped in startTransition',
      },
      {
        name: 'HistoryContent',
        filePath: 'app/(authenticated)/history/HistoryContent.tsx',
        description: 'history-realtime subscription handler wrapped in startTransition',
      },
      {
        name: 'StudentCatalogClient',
        filePath: 'app/(authenticated)/student-catalog/StudentCatalogClient.tsx',
        description: 'catalog-realtime subscription handlers wrapped in startTransition',
      },
      {
        name: 'StudentBookDetailClient',
        filePath: 'app/(authenticated)/student-catalog/[id]/StudentBookDetailClient.tsx',
        description: 'debouncedRefresh & handleReserveSuccess wrapped in startTransition',
      },
      {
        name: 'PolicyLayout',
        filePath: 'components/admin/policies/PolicyLayout.tsx',
        description: 'policies-realtime & handleSaveSettings wrapped in startTransition',
      },
      {
        name: 'BookDetailModal',
        filePath: 'components/catalog/BookDetailModal.tsx',
        description: 'handleReserveSuccess wrapped in startTransition',
      },
      {
        name: 'UserDetailClient',
        filePath: 'app/(authenticated)/users/[id]/UserDetailClient.tsx',
        description: 'handleSave & handleVerifyAndApprove wrapped in startTransition',
      },
      {
        name: 'NewUserClient',
        filePath: 'app/(authenticated)/users/new/NewUserClient.tsx',
        description: 'handleInvite mutation handler wrapped in startTransition',
      },
    ];

    targetComponents.forEach(({ name, filePath, description }) => {
      it(`verifies ${name} imports startTransition and wraps router.refresh() (${description})`, () => {
        const fullPath = path.join(rootDir, filePath);
        expect(fs.existsSync(fullPath)).toBe(true);

        const content = fs.readFileSync(fullPath, 'utf8');

        // Verify startTransition is imported or used via useTransition
        const usesStartTransition =
          content.includes('startTransition') ||
          content.includes('useTransition');
        expect(usesStartTransition).toBe(true);

        // Verify that startTransition wraps router.refresh()
        const wrapsRouterRefresh =
          /startTransition\s*\(\s*(?:async\s*)?\(\)\s*=>\s*\{[\s\S]*?router\.refresh\(\)/m.test(content) ||
          /startTransition\s*\(\s*\(\)\s*=>\s*router\.refresh\(\)\s*\)/m.test(content);
        expect(wrapsRouterRefresh).toBe(true);
      });
    });

    it('verifies no unwrapped naked router.refresh() calls exist in real-time listeners across target client components', () => {
      targetComponents.forEach(({ name, filePath }) => {
        const fullPath = path.join(rootDir, filePath);
        const content = fs.readFileSync(fullPath, 'utf8');

        // Match all router.refresh() invocations
        const refreshRegex = /router\.refresh\(\)/g;
        let match: RegExpExecArray | null;
        let count = 0;

        while ((match = refreshRegex.exec(content)) !== null) {
          count++;
          const index = match.index;
          // Look backwards up to 300 characters to verify startTransition enclosing context
          const prefix = content.slice(Math.max(0, index - 300), index);
          const hasStartTransition = prefix.includes('startTransition');
          expect(
            hasStartTransition,
            `Found naked router.refresh() in ${name} (${filePath}) at position ${index}`
          ).toBe(true);
        }

        expect(count).toBeGreaterThan(0);
      });
    });
  });

  describe('3. Supabase Real-Time Channel Lifecycle & Unmount Cleanup Invariant', () => {
    const realtimeComponents = [
      { name: 'DashboardClient', file: 'components/dashboard/DashboardClient.tsx' },
      { name: 'ModernInventoryClient', file: 'components/inventory/ModernInventoryClient.tsx' },
      { name: 'HistoryContent', file: 'app/(authenticated)/history/HistoryContent.tsx' },
      { name: 'StudentCatalogClient', file: 'app/(authenticated)/student-catalog/StudentCatalogClient.tsx' },
      { name: 'StudentBookDetailClient', file: 'app/(authenticated)/student-catalog/[id]/StudentBookDetailClient.tsx' },
      { name: 'PolicyLayout', file: 'components/admin/policies/PolicyLayout.tsx' },
      { name: 'BookDetailModal', file: 'components/catalog/BookDetailModal.tsx' },
      { name: 'UserDetailClient', file: 'app/(authenticated)/users/[id]/UserDetailClient.tsx' },
    ];

    realtimeComponents.forEach(({ name, file }) => {
      it(`verifies ${name} cleans up real-time channel via removeChannel on unmount`, () => {
        const fullPath = path.join(rootDir, file);
        expect(fs.existsSync(fullPath)).toBe(true);

        const content = fs.readFileSync(fullPath, 'utf8');

        // Must create channel
        expect(content).toMatch(/\.channel\(/);

        // Must include removeChannel in cleanup return
        const hasRemoveChannel =
          content.includes('removeChannel') ||
          content.includes('supabase.removeChannel');
        expect(
          hasRemoveChannel,
          `${name} (${file}) does not invoke removeChannel on unmount`
        ).toBe(true);

        // Verify it is inside an effect cleanup return
        const hasCleanupReturn =
          /return\s*\(\)\s*=>\s*\{[\s\S]*?removeChannel/m.test(content) ||
          /return\s*\(\)\s*=>\s*(?:void\s+)?(?:supabase\.)?removeChannel/m.test(content);
        expect(
          hasCleanupReturn,
          `${name} (${file}) does not return a cleanup function with removeChannel`
        ).toBe(true);
      });
    });
  });
});
