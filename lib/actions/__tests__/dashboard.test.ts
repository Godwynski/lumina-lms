import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDashboardStats, getBookCopyTitle } from '../dashboard';
import { getBorrowingHistory } from '../history';
import { getMe } from '@/lib/auth-helpers';
import { createSafeClient } from '@/lib/supabase/server';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';
import type { ProfileData, UserRole } from '@/lib/types';

vi.mock('@/lib/auth-helpers', () => ({
  getMe: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSafeClient: vi.fn(),
}));

vi.mock('../history', () => ({
  getBorrowingHistory: vi.fn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/error-utils', () => ({
  isAbortError: vi.fn((err: unknown) => {
    return Boolean(err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError');
  }),
}));

describe('Dashboard Server Actions', () => {
  let mockClientHelper: MockSupabaseClientHelper;

  const mockUser = (
    role: UserRole = 'librarian',
    id = 'user-dash-1',
    status = 'ACTIVE'
  ) => ({
    user: {
      id,
      email: `${role}@school.edu`,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id,
      email: `${role}@school.edu`,
      role,
      status,
      full_name: 'Dashboard User',
      permissions: {},
    } as unknown as ProfileData,
    role,
    isStaff: role === 'super_admin' || role === 'librarian' || (role === 'student_assistant' && status === 'ACTIVE'),
    isAdmin: role === 'super_admin',
    isDeactivatedSA: role === 'student_assistant' && status !== 'ACTIVE',
    hasPermission: vi.fn().mockReturnValue(true),
    supabase: mockClientHelper.client,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientHelper = createMockSupabaseClient();
    vi.mocked(createSafeClient).mockReturnValue(
      mockClientHelper.client as unknown as ReturnType<typeof createSafeClient>
    );

    vi.mocked(getBorrowingHistory).mockResolvedValue({
      records: [],
      totalCount: 0,
    });
  });

  describe('getDashboardStats', () => {
    it('throws Unauthorized when user is not authenticated', async () => {
      vi.mocked(getMe).mockResolvedValue(null);

      await expect(getDashboardStats({ role: 'student' })).rejects.toThrow('Unauthorized');
    });

    it('returns scoped patron metrics for student role, leaving manager/approval metrics at zero', async () => {
      const student = mockUser('student', 'student-42');
      vi.mocked(getMe).mockResolvedValue(
        student as unknown as Awaited<ReturnType<typeof getMe>>
      );

      // Student active borrows list
      const myActiveBorrowsList = [
        {
          id: 'b-rec-1',
          user_id: 'student-42',
          status: 'ACTIVE',
          book_copies: { books: { title: 'Clean Code' } },
        },
      ];
      vi.mocked(getBorrowingHistory).mockResolvedValue({
        records: myActiveBorrowsList as unknown as Awaited<ReturnType<typeof getBorrowingHistory>>['records'],
        totalCount: 1,
      });

      // Books table for recent books cache
      const recentBooksData = [
        { id: 'b-1', title: 'Intro to Algorithms', author: 'Cormen', cover_url: null, created_at: '2026-01-01' },
      ];
      mockClientHelper.setTableResponse('books', recentBooksData);

      // Active borrows count
      mockClientHelper.setTableResponse('borrowing_records', null, null, 12);
      // Attendance count
      mockClientHelper.setTableResponse('attendance', null, null, 8);

      const stats = await getDashboardStats({ role: 'student' });

      // Patron sees their own borrows
      expect(stats.myActiveBorrows).toBe(1);
      expect(stats.activeBorrowsList).toEqual(myActiveBorrowsList);
      expect(stats.recentBooks).toEqual(recentBooksData);
      expect(stats.attendanceToday).toBe(8);
      expect(stats.activeBorrows).toBe(12);

      // Admin & manager metrics must be strictly zero for students
      expect(stats.pendingApprovals).toBe(0);
      expect(stats.totalBooks).toBe(0);
      expect(stats.totalUsers).toBe(0);
      expect(stats.archivedBooks).toBe(0);
      expect(stats.archivedUsers).toBe(0);
      expect(stats.overdueBorrows).toBe(0);
      expect(stats.readyHolds).toBe(0);

      expect(getBorrowingHistory).toHaveBeenCalledWith(
        'student-42',
        1,
        5,
        'ACTIVE',
        undefined,
        mockClientHelper.client
      );
    });

    it('returns full administrative metrics for librarian or super_admin', async () => {
      const librarian = mockUser('librarian', 'lib-1');
      vi.mocked(getMe).mockResolvedValue(
        librarian as unknown as Awaited<ReturnType<typeof getMe>>
      );

      mockClientHelper.setTableResponse('borrowing_records', null, null, 15);
      mockClientHelper.setTableResponse('library_cards', null, null, 3);
      mockClientHelper.setTableResponse('attendance', null, null, 25);
      mockClientHelper.setTableResponse('books', null, null, 150);
      mockClientHelper.setTableResponse('profiles', null, null, 80);
      mockClientHelper.setTableResponse('reservations', null, null, 4);

      const stats = await getDashboardStats({ role: 'librarian' });

      expect(stats.activeBorrows).toBe(15);
      expect(stats.pendingApprovals).toBe(3);
      expect(stats.attendanceToday).toBe(25);
      expect(stats.totalBooks).toBe(150);
      expect(stats.totalUsers).toBe(80);
      expect(stats.readyHolds).toBe(4);
    });

    it('grants manager metrics to active student assistant but excludes approval reviews', async () => {
      const activeSA = mockUser('student_assistant', 'sa-1', 'ACTIVE');
      vi.mocked(getMe).mockResolvedValue(
        activeSA as unknown as Awaited<ReturnType<typeof getMe>>
      );

      mockClientHelper.setTableResponse('books', null, null, 200);
      mockClientHelper.setTableResponse('attendance', null, null, 30);
      mockClientHelper.setTableResponse('borrowing_records', null, null, 10);

      const stats = await getDashboardStats({ role: 'student_assistant' });

      // isManager is true for active SA:
      expect(stats.totalBooks).toBe(200);
      expect(stats.attendanceToday).toBe(30);

      // canReviewApprovals is false for SA:
      expect(stats.pendingApprovals).toBe(0);
      expect(stats.totalUsers).toBe(0);
      expect(stats.archivedUsers).toBe(0);
      expect(stats.overdueBorrows).toBe(0);
      expect(stats.readyHolds).toBe(0);
    });

    it('falls back to patron scoping when student assistant is deactivated / inactive', async () => {
      const inactiveSA = mockUser('student_assistant', 'sa-2', 'INACTIVE');
      vi.mocked(getMe).mockResolvedValue(
        inactiveSA as unknown as Awaited<ReturnType<typeof getMe>>
      );

      mockClientHelper.setTableResponse('books', null, null, 200);

      const stats = await getDashboardStats({ role: 'student_assistant' });

      // isActuallyStaff is false for inactive SA: totalBooks is 0
      expect(stats.totalBooks).toBe(0);
      expect(stats.pendingApprovals).toBe(0);
      expect(stats.totalUsers).toBe(0);
    });

    it('resiliently handles database exceptions in individual count queries using safeWrap', async () => {
      const librarian = mockUser('librarian', 'lib-2');
      vi.mocked(getMe).mockResolvedValue(
        librarian as unknown as Awaited<ReturnType<typeof getMe>>
      );

      // Simulate borrowing history query failing with generic error
      vi.mocked(getBorrowingHistory).mockRejectedValueOnce(new Error('Temporary DB outage'));

      const stats = await getDashboardStats({ role: 'librarian' });

      // Borrowing history defaults to empty list and 0 count due to safeWrap without throwing
      expect(stats.myActiveBorrows).toBe(0);
      expect(stats.activeBorrowsList).toEqual([]);
    });

    it('rethrows AbortError instead of suppressing it in safeWrap', async () => {
      const librarian = mockUser('librarian', 'lib-2');
      vi.mocked(getMe).mockResolvedValue(
        librarian as unknown as Awaited<ReturnType<typeof getMe>>
      );

      const abortError = new Error('Request was aborted');
      abortError.name = 'AbortError';

      vi.mocked(getBorrowingHistory).mockRejectedValueOnce(abortError);

      await expect(getDashboardStats({ role: 'librarian' })).rejects.toThrow('Request was aborted');
    });
  });

  describe('getBookCopyTitle', () => {
    it('returns book title when copy and relation exist', async () => {
      const user = mockUser('student');
      vi.mocked(getMe).mockResolvedValue(
        user as unknown as Awaited<ReturnType<typeof getMe>>
      );

      mockClientHelper.setTableResponse('book_copies', {
        books: { title: 'Design Patterns: Elements of Reusable Object-Oriented Software' },
      });

      const title = await getBookCopyTitle('copy-123');

      expect(title).toBe('Design Patterns: Elements of Reusable Object-Oriented Software');
      const copyBuilder = mockClientHelper.getTableBuilder('book_copies');
      expect(copyBuilder.select).toHaveBeenCalledWith('books(title)');
      expect(copyBuilder.eq).toHaveBeenCalledWith('id', 'copy-123');
    });

    it('returns default fallback "Resource" when book title is missing or null', async () => {
      const user = mockUser('student');
      vi.mocked(getMe).mockResolvedValue(
        user as unknown as Awaited<ReturnType<typeof getMe>>
      );

      mockClientHelper.setTableResponse('book_copies', null);

      const title = await getBookCopyTitle('copy-not-found');

      expect(title).toBe('Resource');
    });

    it('returns default fallback "Resource" when caller is unauthenticated', async () => {
      vi.mocked(getMe).mockResolvedValue(null);

      const title = await getBookCopyTitle('copy-123');

      expect(title).toBe('Resource');
    });
  });
});
