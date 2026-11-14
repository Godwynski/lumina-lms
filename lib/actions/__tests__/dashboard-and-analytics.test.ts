import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabaseClient, createMockQueryBuilder, type MockSupabaseClientHelper, type MockSupabaseQueryBuilder } from '@/test/mocks/supabase';

let serverClientHelper: MockSupabaseClientHelper;
let safeClientHelper: MockSupabaseClientHelper;

vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => serverClientHelper.client),
  createSafeClient: vi.fn(() => safeClientHelper.client),
}));

import { getDashboardStats, getBookCopyTitle } from '@/lib/actions/dashboard';
import { getAnalyticsSummary } from '@/lib/actions/analytics';

function queueTableBuilders(
  helper: MockSupabaseClientHelper,
  buildersByTable: Record<string, MockSupabaseQueryBuilder[]>
) {
  const queues = new Map<string, MockSupabaseQueryBuilder[]>(
    Object.entries(buildersByTable).map(([k, v]) => [k, [...v]])
  );
  helper.from.mockImplementation((table: string) => {
    const q = queues.get(table);
    if (q && q.length > 0) {
      return q.shift()!;
    }
    return helper.getTableBuilder(table);
  });
}

describe('Dashboard & Analytics Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClientHelper = createMockSupabaseClient();
    safeClientHelper = createMockSupabaseClient();
  });

  describe('getDashboardStats (lib/actions/dashboard.ts)', () => {
    it('throws Unauthorized when unauthenticated', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(getDashboardStats({ role: 'student' })).rejects.toThrow('Unauthorized');
    });

    it('returns student view without querying staff-only tables', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'stu-1' } }, error: null });
      serverClientHelper.setTableResponse('profiles', { id: 'stu-1', role: 'student', status: 'ACTIVE' }, null);
      serverClientHelper.setTableResponse('borrowing_records', null, null, 3);
      serverClientHelper.setTableResponse('attendance', null, null, 12);
      serverClientHelper.setRpcResponse(
        [
          {
            id: 'loan-1',
            book_copy_id: 'copy-1',
            user_id: 'stu-1',
            status: 'ACTIVE',
            borrowed_at: '2026-11-01T08:00:00Z',
            due_date: '2026-11-20T08:00:00Z',
            returned_at: null,
            fine_amount: 0,
            total_count: 1,
            book_id: 'book-1',
            book_title: 'Clean Code',
            book_author: 'Robert Martin',
            book_cover_url: null,
          },
        ],
        null,
        'get_borrowing_history_v2'
      );

      const recentBooks = [
        { id: 'b-recent', title: 'New Arrival', author: 'Author', cover_url: null, created_at: '2026-11-10T00:00:00Z' },
      ];
      safeClientHelper.setTableResponse('books', recentBooks, null);

      const stats = await getDashboardStats({ role: 'student' });

      expect(stats).toEqual({
        activeBorrows: 3,
        pendingApprovals: 0,
        myActiveBorrows: 1,
        recentBooks,
        activeBorrowsList: [
          expect.objectContaining({
            id: 'loan-1',
            status: 'ACTIVE',
            books: expect.objectContaining({ id: 'book-1', title: 'Clean Code' }),
          }),
        ],
        attendanceToday: 12,
        totalBooks: 0,
        totalUsers: 0,
        archivedBooks: 0,
        archivedUsers: 0,
        overdueBorrows: 0,
        readyHolds: 0,
      });

      const calledTables = serverClientHelper.from.mock.calls.map(([t]) => t);
      expect(calledTables).not.toContain('library_cards');
      expect(calledTables).not.toContain('reservations');
      expect(calledTables).not.toContain('books');

      // Check Manila timezone midnight filter on attendance
      const attendanceGteCall = serverClientHelper.getTableBuilder('attendance').gte.mock.calls[0];
      expect(attendanceGteCall[0]).toBe('check_in_at');
      expect(attendanceGteCall[1]).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\+08:00$/);
    });

    it('gates book totals for active vs deactivated student_assistant', async () => {
      // Active SA: gets totalBooks and archivedBooks, not pendingApprovals/totalUsers/overdueBorrows/readyHolds
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'sa-1' } }, error: null });
      queueTableBuilders(serverClientHelper, {
        profiles: [createMockQueryBuilder({ id: 'sa-1', role: 'student_assistant', status: 'ACTIVE' }, null)],
        books: [
          createMockQueryBuilder(null, null, 120),
          createMockQueryBuilder(null, null, 8),
        ],
      });
      serverClientHelper.setTableResponse('borrowing_records', null, null, 4);
      serverClientHelper.setTableResponse('attendance', null, null, 5);
      serverClientHelper.setRpcResponse([], null, 'get_borrowing_history_v2');
      safeClientHelper.setTableResponse('books', [], null);

      const activeSaStats = await getDashboardStats({ role: 'student_assistant' });
      expect(activeSaStats.totalBooks).toBe(120);
      expect(activeSaStats.archivedBooks).toBe(8);
      expect(activeSaStats.pendingApprovals).toBe(0);
      expect(activeSaStats.totalUsers).toBe(0);
      expect(activeSaStats.overdueBorrows).toBe(0);
      expect(activeSaStats.readyHolds).toBe(0);

      // Deactivated SA: book totals stay 0
      serverClientHelper = createMockSupabaseClient();
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'sa-2' } }, error: null });
      serverClientHelper.setTableResponse('profiles', { id: 'sa-2', role: 'student_assistant', status: 'INACTIVE' }, null);
      serverClientHelper.setRpcResponse([], null, 'get_borrowing_history_v2');
      const inactiveSaStats = await getDashboardStats({ role: 'student_assistant' });
      expect(inactiveSaStats.totalBooks).toBe(0);
      expect(inactiveSaStats.archivedBooks).toBe(0);
    });

    it('returns full admin metrics for librarian and super_admin', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'lib-1' } }, error: null });
      queueTableBuilders(serverClientHelper, {
        profiles: [
          createMockQueryBuilder({ id: 'lib-1', role: 'librarian', status: 'ACTIVE' }, null), // getMe
          createMockQueryBuilder(null, null, 250), // totalUsers
          createMockQueryBuilder(null, null, 15), // archivedUsers
        ],
        borrowing_records: [
          createMockQueryBuilder(null, null, 34), // activeBorrows
          createMockQueryBuilder(null, null, 7), // overdueBorrows
        ],
        books: [
          createMockQueryBuilder(null, null, 500), // totalBooks
          createMockQueryBuilder(null, null, 22), // archivedBooks
        ],
        library_cards: [createMockQueryBuilder(null, null, 9)], // pendingApprovals
        attendance: [createMockQueryBuilder(null, null, 41)], // attendanceToday
        reservations: [createMockQueryBuilder(null, null, 6)], // readyHolds
      });
      serverClientHelper.setRpcResponse([], null, 'get_borrowing_history_v2');
      safeClientHelper.setTableResponse('books', [], null);

      const stats = await getDashboardStats({ role: 'librarian' });
      expect(stats).toEqual({
        activeBorrows: 34,
        pendingApprovals: 9,
        myActiveBorrows: 0,
        recentBooks: [],
        activeBorrowsList: [],
        attendanceToday: 41,
        totalBooks: 500,
        totalUsers: 250,
        archivedBooks: 22,
        archivedUsers: 15,
        overdueBorrows: 7,
        readyHolds: 6,
      });
    });

    it('handles non-abort sub-query failures gracefully via safeWrap, and rethrows AbortError', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'lib-1' } }, error: null });
      serverClientHelper.setTableResponse('profiles', { id: 'lib-1', role: 'super_admin', status: 'ACTIVE' }, null);
      serverClientHelper.setRpcResponse([], null, 'get_borrowing_history_v2');
      safeClientHelper.setTableResponse('books', null, null);
      safeClientHelper.from.mockImplementationOnce(() => {
        throw new Error('Recent books cache transient error');
      });

      const stats = await getDashboardStats({ role: 'super_admin' });
      expect(stats.recentBooks).toEqual([]);

      // AbortError must propagate out of safeWrap
      const abortErr = new Error('Request aborted');
      abortErr.name = 'AbortError';
      safeClientHelper.from.mockImplementationOnce(() => {
        throw abortErr;
      });
      await expect(getDashboardStats({ role: 'super_admin' })).rejects.toThrow('Request aborted');
    });
  });

  describe('getBookCopyTitle (lib/actions/dashboard.ts)', () => {
    it('returns Resource when unauthenticated or copy has no book title, otherwise returns title', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      expect(await getBookCopyTitle('copy-1')).toBe('Resource');

      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
      serverClientHelper.setTableResponse('profiles', { id: 'u1', role: 'student', status: 'ACTIVE' }, null);
      serverClientHelper.setTableResponse('book_copies', { books: { title: 'Designing Data-Intensive Applications' } }, null);
      expect(await getBookCopyTitle('copy-1')).toBe('Designing Data-Intensive Applications');

      serverClientHelper.setTableResponse('book_copies', { books: null }, null);
      expect(await getBookCopyTitle('copy-missing')).toBe('Resource');
    });
  });

  describe('getAnalyticsSummary (lib/actions/analytics.ts)', () => {
    it('enforces authentication and restricts access to librarian and super_admin', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(getAnalyticsSummary('7d')).rejects.toThrow('Unauthorized');

      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'stu-1' } }, error: null });
      serverClientHelper.setTableResponse('profiles', { id: 'stu-1', role: 'student', status: 'ACTIVE' }, null);
      await expect(getAnalyticsSummary('7d')).rejects.toThrow('Forbidden');

      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'sa-1' } }, error: null });
      serverClientHelper.setTableResponse('profiles', { id: 'sa-1', role: 'student_assistant', status: 'ACTIVE' }, null);
      await expect(getAnalyticsSummary('30d')).rejects.toThrow('Forbidden');
    });

    it('calls get_analytics_summary RPC for requested range and enriches popularBooks with author and ISBN', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'lib-1' } }, error: null });
      serverClientHelper.setTableResponse('profiles', { id: 'lib-1', role: 'librarian', status: 'ACTIVE' }, null);
      serverClientHelper.setRpcResponse(
        {
          attendanceTrends: [{ label: 'Mon', count: 14 }],
          borrowingTrends: [{ label: 'Mon', count: 6 }],
          categoryDistribution: [{ name: 'CS', value: 10 }],
          peakHours: [{ hour: '10 AM', count: 9 }],
          popularBooks: [
            { id: 'book-1', title: 'Refactoring', count: 15 },
            { id: 'book-2', title: 'Unknown Copy', count: 3 },
          ],
        },
        null,
        'get_analytics_summary'
      );
      serverClientHelper.setTableResponse(
        'books',
        [{ id: 'book-1', author: 'Martin Fowler', isbn: '978-0134757599' }],
        null
      );

      const summary = await getAnalyticsSummary('30d');

      expect(serverClientHelper.rpc).toHaveBeenCalledWith('get_analytics_summary', { p_range: '30d' });
      expect(serverClientHelper.getTableBuilder('books').in).toHaveBeenCalledWith('id', ['book-1', 'book-2']);
      expect(summary).toEqual({
        attendanceTrends: [{ label: 'Mon', count: 14 }],
        borrowingTrends: [{ label: 'Mon', count: 6 }],
        categoryDistribution: [{ name: 'CS', value: 10 }],
        peakHours: [{ hour: '10 AM', count: 9 }],
        popularBooks: [
          { id: 'book-1', title: 'Refactoring', count: 15, author: 'Martin Fowler', isbn: '978-0134757599' },
          { id: 'book-2', title: 'Unknown Copy', count: 3, author: null, isbn: null },
        ],
      });
    });

    it('returns empty arrays when dataset is empty/null without querying books, and throws on RPC error', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
      serverClientHelper.setTableResponse('profiles', { id: 'admin-1', role: 'super_admin', status: 'ACTIVE' }, null);
      serverClientHelper.setRpcResponse(null, null, 'get_analytics_summary');

      const empty = await getAnalyticsSummary('1y');
      expect(empty).toEqual({
        attendanceTrends: [],
        borrowingTrends: [],
        categoryDistribution: [],
        peakHours: [],
        popularBooks: [],
      });
      expect(serverClientHelper.from).not.toHaveBeenCalledWith('books');

      serverClientHelper.setRpcResponse(null, { message: 'Analytics RPC timeout' }, 'get_analytics_summary');
      await expect(getAnalyticsSummary('7d')).rejects.toThrow('Analytics RPC timeout');
    });
  });
});
