import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBorrowingHistory } from '../history';
import { createClient } from '@/lib/supabase/server';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('getBorrowingHistory Server Action', () => {
  let mockSupabaseHelper: MockSupabaseClientHelper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseHelper = createMockSupabaseClient();
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseHelper.client as unknown as Awaited<ReturnType<typeof createClient>>
    );
  });

  const sampleRawRecord = {
    id: 'rec-1',
    book_copy_id: 'copy-101',
    user_id: 'user-001',
    status: 'ACTIVE' as const,
    borrowed_at: '2026-10-01T10:00:00Z',
    due_date: '2026-10-15T10:00:00Z',
    returned_at: null,
    book_copies: {
      books: {
        id: 'book-55',
        title: 'Design Patterns',
        author: 'Gang of Four',
        cover_url: 'https://example.com/cover.png',
      },
    },
    profiles: {
      id: 'user-001',
      full_name: 'John Doe',
      email: 'john@school.edu',
      student_id: 'STU-2026-001',
    },
  };

  describe('User Scoping & Access Control', () => {
    it('scopes query to specific userId when provided (student patron perspective)', async () => {
      mockSupabaseHelper.setTableResponse('borrowing_records', [sampleRawRecord], null, 1);

      const result = await getBorrowingHistory('user-001');

      const builder = mockSupabaseHelper.getTableBuilder('borrowing_records');
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-001');
      expect(result.totalCount).toBe(1);
      expect(result.records).toHaveLength(1);
      expect(result.records[0].books?.title).toBe('Design Patterns');
      expect(result.records[0].profiles?.student_id).toBe('STU-2026-001');
    });

    it('does not filter by userId when userId is null (staff perspective)', async () => {
      mockSupabaseHelper.setTableResponse('borrowing_records', [sampleRawRecord], null, 1);

      const result = await getBorrowingHistory(null);

      const builder = mockSupabaseHelper.getTableBuilder('borrowing_records');
      const eqCalls = builder.eq.mock.calls;
      const userFiltered = eqCalls.some((call: unknown[]) => call[0] === 'user_id');
      expect(userFiltered).toBe(false);
      expect(result.totalCount).toBe(1);
    });

    it('uses preFetchedSupabase client if provided without invoking createClient', async () => {
      const customHelper = createMockSupabaseClient();
      customHelper.setTableResponse('borrowing_records', [sampleRawRecord], null, 1);

      const result = await getBorrowingHistory(
        'user-001',
        1,
        10,
        undefined,
        undefined,
        customHelper.client as unknown as Parameters<typeof getBorrowingHistory>[5]
      );

      expect(createClient).not.toHaveBeenCalled();
      expect(customHelper.from).toHaveBeenCalledWith('borrowing_records');
      expect(result.records).toHaveLength(1);
    });
  });

  describe('Pagination Calculations', () => {
    it('applies default pagination range (page 1, pageSize 10 -> range 0 to 9)', async () => {
      mockSupabaseHelper.setTableResponse('borrowing_records', [], null, 0);

      await getBorrowingHistory('user-001');

      const builder = mockSupabaseHelper.getTableBuilder('borrowing_records');
      expect(builder.range).toHaveBeenCalledWith(0, 9);
      expect(builder.order).toHaveBeenCalledWith('borrowed_at', { ascending: false });
    });

    it('calculates correct range offsets for custom page and pageSize', async () => {
      mockSupabaseHelper.setTableResponse('borrowing_records', [], null, 45);

      // Page 3, pageSize 15 -> from 30, to 44
      await getBorrowingHistory('user-001', 3, 15);

      const builder = mockSupabaseHelper.getTableBuilder('borrowing_records');
      expect(builder.range).toHaveBeenCalledWith(30, 44);
    });

    it('handles pageSize 1 cleanly (range 0 to 0)', async () => {
      mockSupabaseHelper.setTableResponse('borrowing_records', [], null, 1);

      await getBorrowingHistory('user-001', 1, 1);

      const builder = mockSupabaseHelper.getTableBuilder('borrowing_records');
      expect(builder.range).toHaveBeenCalledWith(0, 0);
    });
  });

  describe('Status Filtering', () => {
    it('normalizes statusFilter to uppercase and filters by status', async () => {
      mockSupabaseHelper.setTableResponse('borrowing_records', [], null, 0);

      await getBorrowingHistory('user-001', 1, 10, 'returned');

      const builder = mockSupabaseHelper.getTableBuilder('borrowing_records');
      expect(builder.eq).toHaveBeenCalledWith('status', 'RETURNED');
    });

    it('filters for ACTIVE, OVERDUE, and LOST statuses correctly', async () => {
      mockSupabaseHelper.setTableResponse('borrowing_records', [], null, 0);

      await getBorrowingHistory('user-001', 1, 10, 'OVERDUE');
      const builder = mockSupabaseHelper.getTableBuilder('borrowing_records');
      expect(builder.eq).toHaveBeenCalledWith('status', 'OVERDUE');
    });

    it('ignores statusFilter when set to "all" or undefined', async () => {
      mockSupabaseHelper.setTableResponse('borrowing_records', [], null, 0);

      await getBorrowingHistory('user-001', 1, 10, 'all');

      const builder = mockSupabaseHelper.getTableBuilder('borrowing_records');
      const eqCalls = builder.eq.mock.calls;
      const statusFiltered = eqCalls.some((call: unknown[]) => call[0] === 'status');
      expect(statusFiltered).toBe(false);
    });
  });

  describe('Search Query & Sanitization', () => {
    it('applies sanitized ilike search on title and author with referencedTable', async () => {
      mockSupabaseHelper.setTableResponse('borrowing_records', [], null, 0);

      await getBorrowingHistory('user-001', 1, 10, undefined, 'Clean Architecture');

      const builder = mockSupabaseHelper.getTableBuilder('borrowing_records');
      expect(builder.or).toHaveBeenCalledWith(
        'title.ilike.%Clean Architecture%,author.ilike.%Clean Architecture%',
        { referencedTable: 'book_copies.books' }
      );
    });

    it('sanitizes special characters and PostgREST operators to prevent filter injection', async () => {
      mockSupabaseHelper.setTableResponse('borrowing_records', [], null, 0);

      await getBorrowingHistory('user-001', 1, 10, undefined, 'test,eq.123();"\'%');

      const builder = mockSupabaseHelper.getTableBuilder('borrowing_records');
      expect(builder.or).toHaveBeenCalled();
      const orArg = builder.or?.mock.calls[0][0] as string;
      // PostgREST filter sanitization strips/escapes dangerous control characters
      expect(orArg).not.toContain('eq.123()');
    });
  });

  describe('Relations Mapping & Edge Cases', () => {
    it('maps book_copies.books and profiles into flat record structure', async () => {
      const records = [
        sampleRawRecord,
        {
          id: 'rec-2',
          book_copy_id: 'copy-102',
          user_id: 'user-002',
          status: 'RETURNED' as const,
          borrowed_at: '2026-09-01T10:00:00Z',
          due_date: '2026-09-15T10:00:00Z',
          returned_at: '2026-09-10T14:30:00Z',
          book_copies: null,
          profiles: null,
        },
      ];
      mockSupabaseHelper.setTableResponse('borrowing_records', records, null, 2);

      const result = await getBorrowingHistory(null);

      expect(result.records).toHaveLength(2);
      expect(result.records[0].books).toEqual({
        id: 'book-55',
        title: 'Design Patterns',
        author: 'Gang of Four',
        cover_url: 'https://example.com/cover.png',
      });
      expect(result.records[0].profiles?.full_name).toBe('John Doe');

      // Null relations check
      expect(result.records[1].books).toBeNull();
      expect(result.records[1].profiles).toBeNull();
      expect(result.records[1].returned_at).toBe('2026-09-10T14:30:00Z');
    });

    it('handles empty database results and null count safely', async () => {
      mockSupabaseHelper.setTableResponse('borrowing_records', null, null, null);

      const result = await getBorrowingHistory('user-999');

      expect(result.records).toEqual([]);
      expect(result.totalCount).toBe(0);
    });

    it('rethrows abort errors directly', async () => {
      const abortError = new Error('Request aborted');
      abortError.name = 'AbortError';
      mockSupabaseHelper.setTableResponse('borrowing_records', null, abortError);

      await expect(getBorrowingHistory('user-001')).rejects.toThrow('Request aborted');
    });

    it('logs and rethrows database query errors', async () => {
      const dbError = new Error('Database connection timeout');
      mockSupabaseHelper.setTableResponse('borrowing_records', null, dbError);

      await expect(getBorrowingHistory('user-001')).rejects.toThrow('Database connection timeout');
    });
  });
});
