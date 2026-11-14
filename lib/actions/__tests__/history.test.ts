import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient, createMockQueryBuilder } from '@/test/mocks/supabase';

const mockCreateClient = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockGetMe = vi.fn();
const mockLogAuditActivity = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock('@/lib/auth-helpers', () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
}));

vi.mock('@/lib/audit', () => ({
  logAuditActivity: (...args: unknown[]) => mockLogAuditActivity(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { getBorrowingHistory, settleBorrowingFine } from '@/lib/actions/history';

const VALID_RECORD_ID = '11111111-1111-4111-8111-111111111111';

function makeStaffContext(
  supabase: ReturnType<typeof createMockSupabaseClient>['client'],
  overrides: {
    id?: string;
    role?: 'super_admin' | 'librarian' | 'student_assistant' | 'student';
    isDeactivatedSA?: boolean;
    hasCirculationPerm?: boolean;
  } = {}
) {
  const role = overrides.role ?? 'librarian';
  const id = overrides.id ?? 'staff-1';
  const isDeactivatedSA = overrides.isDeactivatedSA ?? false;
  const hasCirculationPerm =
    overrides.hasCirculationPerm ?? (role === 'super_admin' || role === 'librarian' || role === 'student_assistant');

  return {
    user: { id },
    profile: { id, role, status: isDeactivatedSA ? 'DEACTIVATED' : 'ACTIVE' },
    role,
    isStaff: role !== 'student',
    isAdmin: role === 'super_admin',
    isDeactivatedSA,
    hasPermission: (perm: string) => {
      if (role === 'super_admin' || role === 'librarian') return true;
      return perm === 'manage_circulation' ? hasCirculationPerm : false;
    },
    supabase,
  };
}

describe('history server actions', () => {
  let supaMock: ReturnType<typeof createMockSupabaseClient>;
  let adminMock: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    supaMock = createMockSupabaseClient();
    adminMock = createMockSupabaseClient();
    mockCreateClient.mockResolvedValue(supaMock.client);
    mockCreateAdminClient.mockReturnValue(adminMock.client);
    mockGetMe.mockResolvedValue(makeStaffContext(supaMock.client));
    mockLogAuditActivity.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('overdue fine calculation (via getBorrowingHistory and settleBorrowingFine)', () => {
    it('computes overdue days across Asia/Manila calendar day boundaries accurately', async () => {
      vi.useFakeTimers();
      // 2026-06-11T17:00:00Z = 2026-06-12 01:00:00 Asia/Manila
      vi.setSystemTime(new Date('2026-06-11T17:00:00Z'));

      supaMock.setRpcResponse(
        [
          {
            id: 'rec-manila-2d',
            book_copy_id: 'copy-1',
            user_id: 'user-1',
            status: 'OVERDUE',
            borrowed_at: '2026-06-01T00:00:00Z',
            // 2026-06-10T15:00:00Z = 2026-06-10 23:00:00 Asia/Manila -> 2 Manila calendar days overdue (June 10 -> June 12)
            due_date: '2026-06-10T15:00:00Z',
            returned_at: null,
            fine_amount: null,
            total_count: 2,
          },
          {
            id: 'rec-manila-1d',
            book_copy_id: 'copy-2',
            user_id: 'user-1',
            status: 'OVERDUE',
            borrowed_at: '2026-06-01T00:00:00Z',
            // 2026-06-10T16:30:00Z = 2026-06-11 00:30:00 Asia/Manila -> 1 Manila calendar day overdue (June 11 -> June 12)
            due_date: '2026-06-10T16:30:00Z',
            returned_at: null,
            fine_amount: null,
            total_count: 2,
          },
        ],
        null,
        'get_borrowing_history_v2'
      );

      const res = await getBorrowingHistory(null, 1, 10);
      expect(res.records[0].fine_amount).toBe(10); // 2 * 5
      expect(res.records[1].fine_amount).toBe(5); // 1 * 5
    });

    it('returns 0 for non-overdue active records and legacy closed RETURNED records with null fine_amount', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-10T04:00:00Z'));

      supaMock.setRpcResponse(
        [
          {
            id: 'rec-active-ok',
            book_copy_id: 'copy-1',
            user_id: 'user-1',
            status: 'ACTIVE',
            borrowed_at: '2026-06-01T00:00:00Z',
            due_date: '2026-06-15T00:00:00Z',
            returned_at: null,
            fine_amount: null,
            total_count: 2,
          },
          {
            id: 'rec-legacy-returned',
            book_copy_id: 'copy-2',
            user_id: 'user-1',
            status: 'RETURNED',
            borrowed_at: '2026-05-01T00:00:00Z',
            due_date: '2026-05-05T00:00:00Z',
            returned_at: '2026-05-10T00:00:00Z',
            fine_amount: null,
            total_count: 2,
          },
        ],
        null,
        'get_borrowing_history_v2'
      );

      const res = await getBorrowingHistory(null, 1, 10);
      expect(res.records[0].fine_amount).toBe(0);
      expect(res.records[1].fine_amount).toBe(0);
    });

    it('preserves snapshotted fine_amount when non-null', async () => {
      supaMock.setRpcResponse(
        [
          {
            id: 'rec-snap',
            book_copy_id: 'copy-1',
            user_id: 'user-1',
            status: 'RETURNED',
            borrowed_at: '2026-05-01T00:00:00Z',
            due_date: '2026-05-05T00:00:00Z',
            returned_at: '2026-05-09T00:00:00Z',
            fine_amount: '42.5',
            total_count: 1,
          },
        ],
        null,
        'get_borrowing_history_v2'
      );

      const res = await getBorrowingHistory(null, 1, 10);
      expect(res.records[0].fine_amount).toBe(42.5);
    });

    it('treats legacy closed RETURNED records with null fine_amount as 0 even with custom overdue_fine_per_day', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-13T04:00:00Z'));

      adminMock.setTableResponse('borrowing_records', {
        id: VALID_RECORD_ID,
        book_copy_id: 'copy-1',
        due_date: '2026-06-10T04:00:00Z',
        returned_at: '2026-06-13T04:00:00Z',
        status: 'RETURNED',
        fine_amount: null,
        fine_settled_at: null,
      });
      adminMock.setTableResponse('system_settings', { value: '12.5' });

      const res = await settleBorrowingFine({ recordId: VALID_RECORD_ID, mode: 'settle' });

      expect(res).toEqual({
        success: false,
        error: 'This record has no overdue penalty to settle.',
      });
    });
  });

  describe('getBorrowingHistory', () => {
    it('uses get_borrowing_history_v2 RPC with status filters, sanitized search, and copy_qr mapping', async () => {
      supaMock.setRpcResponse(
        [
          {
            id: 'rec-1',
            book_copy_id: 'copy-1',
            user_id: 'user-1',
            status: 'RETURNED',
            borrowed_at: '2026-06-01T00:00:00Z',
            due_date: '2026-06-08T00:00:00Z',
            returned_at: '2026-06-10T00:00:00Z',
            fine_amount: 10,
            fine_settled_at: '2026-06-10T01:00:00Z',
            copy_qr: 'QR-BOOK-001',
            total_count: '25',
            book_id: 'book-1',
            book_title: 'Noli Me Tangere',
            book_author: 'Jose Rizal',
            book_cover_url: 'https://example.com/cover.png',
            profile_id: 'user-1',
            profile_name: 'Maria Clara',
            profile_email: 'maria@example.edu',
            profile_student_id: '2024-0001',
          },
        ],
        null,
        'get_borrowing_history_v2'
      );

      for (const status of ['all', 'ACTIVE', 'OVERDUE', 'RETURNED', 'SETTLED'] as const) {
        await getBorrowingHistory('user-1', 2, 15, status, 'Noli (Me),:*\\"');
        expect(supaMock.rpc).toHaveBeenCalledWith('get_borrowing_history_v2', {
          p_user_id: 'user-1',
          p_page: 2,
          p_page_size: 15,
          p_status: status === 'all' ? null : status,
          p_search: 'Noli Me',
        });
      }

      const result = await getBorrowingHistory('user-1', 1, 10, 'SETTLED');
      expect(result.totalCount).toBe(25);
      expect(result.records).toEqual([
        {
          id: 'rec-1',
          book_copy_id: 'copy-1',
          user_id: 'user-1',
          status: 'RETURNED',
          borrowed_at: '2026-06-01T00:00:00Z',
          due_date: '2026-06-08T00:00:00Z',
          returned_at: '2026-06-10T00:00:00Z',
          copy_qr: 'QR-BOOK-001',
          fine_amount: 10,
          fine_settled_at: '2026-06-10T01:00:00Z',
          books: {
            id: 'book-1',
            title: 'Noli Me Tangere',
            author: 'Jose Rizal',
            cover_url: 'https://example.com/cover.png',
          },
          profiles: {
            id: 'user-1',
            full_name: 'Maria Clara',
            email: 'maria@example.edu',
            student_id: '2024-0001',
          },
        },
      ]);
    });

    it('returns empty records and 0 totalCount when RPC returns empty array', async () => {
      supaMock.setRpcResponse([], null, 'get_borrowing_history_v2');
      const result = await getBorrowingHistory(null, 1, 10, 'all');
      expect(result).toEqual({ records: [], totalCount: 0 });
    });

    it('falls back to direct query when RPC returns an error, filtering status and computing fines', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-12T04:00:00Z')); // June 12 Manila

      supaMock.setRpcResponse(null, { message: 'function get_borrowing_history_v2 does not exist' }, 'get_borrowing_history_v2');
      supaMock.setTableResponse('profiles', [{ id: 'student-1' }]);
      supaMock.setTableResponse('books', [{ id: 'book-1' }]);
      supaMock.setTableResponse('book_copies', [{ id: 'copy-1' }]);
      supaMock.setTableResponse(
        'borrowing_records',
        [
          {
            id: 'rec-fallback-1',
            book_copy_id: 'copy-1',
            user_id: 'student-1',
            status: 'OVERDUE',
            borrowed_at: '2026-06-01T00:00:00Z',
            due_date: '2026-06-10T04:00:00Z', // 2 days overdue -> 10
            returned_at: null,
            fine_amount: null,
            fine_settled_at: null,
            book_copies: {
              qr_string: 'QR-FB-1',
              books: { id: 'book-1', title: 'El Filibusterismo', author: 'Jose Rizal', cover_url: null },
            },
            profiles: {
              id: 'student-1',
              full_name: 'Crisostomo Ibarra',
              email: 'ibarra@example.edu',
              student_id: '2024-0009',
            },
          },
        ],
        null,
        1
      );

      const result = await getBorrowingHistory(null, 1, 10, 'overdue', 'Ibarra');
      const borrowBuilder = supaMock.getTableBuilder('borrowing_records');

      expect(borrowBuilder.eq).toHaveBeenCalledWith('status', 'OVERDUE');
      expect(borrowBuilder.or).toHaveBeenCalledWith('user_id.in.(student-1),book_copy_id.in.(copy-1)');
      expect(borrowBuilder.range).toHaveBeenCalledWith(0, 9);
      expect(result.totalCount).toBe(1);
      expect(result.records[0].copy_qr).toBe('QR-FB-1');
      expect(result.records[0].fine_amount).toBe(10);
      expect(result.records[0].books?.title).toBe('El Filibusterismo');
    });

    it('uses impossible uuid filter in fallback search when neither profiles nor books match', async () => {
      supaMock.setRpcResponse(null, { message: 'rpc failed' }, 'get_borrowing_history_v2');
      supaMock.setTableResponse('profiles', []);
      supaMock.setTableResponse('books', []);
      supaMock.setTableResponse('borrowing_records', [], null, 0);

      const res = await getBorrowingHistory(null, 1, 10, 'all', 'nonexistent');
      expect(supaMock.getTableBuilder('borrowing_records').eq).toHaveBeenCalledWith(
        'id',
        '00000000-0000-0000-0000-000000000000'
      );
      expect(res).toEqual({ records: [], totalCount: 0 });
    });

    it('uses referencedTable search in fallback when userId is provided', async () => {
      supaMock.setRpcResponse(null, { message: 'rpc failed' }, 'get_borrowing_history_v2');
      supaMock.setTableResponse('borrowing_records', [], null, 0);

      await getBorrowingHistory('student-1', 1, 10, 'ACTIVE', 'Rizal*');
      const borrowBuilder = supaMock.getTableBuilder('borrowing_records');
      expect(borrowBuilder.eq).toHaveBeenCalledWith('user_id', 'student-1');
      expect(borrowBuilder.or).toHaveBeenCalledWith(
        'title.ilike.%Rizal%,author.ilike.%Rizal%',
        { referencedTable: 'book_copies.books' }
      );
    });

    it('propagates AbortError from RPC and DB errors from fallback', async () => {
      const abortErr = new DOMException('The operation was aborted', 'AbortError');
      supaMock.rpc.mockRejectedValueOnce(abortErr);

      await expect(getBorrowingHistory(null, 1, 10)).rejects.toThrow();
      expect(supaMock.from).not.toHaveBeenCalled();

      supaMock.setRpcResponse(null, { message: 'rpc failed' }, 'get_borrowing_history_v2');
      supaMock.setTableResponse('borrowing_records', null, { message: 'DB connection lost' }, null);

      await expect(getBorrowingHistory(null, 1, 10)).rejects.toEqual({ message: 'DB connection lost' });
    });
  });

  describe('settleBorrowingFine', () => {
    it('rejects unauthorized roles, deactivated SA, and invalid UUID', async () => {
      mockGetMe.mockResolvedValue(null);
      expect(await settleBorrowingFine({ recordId: VALID_RECORD_ID })).toEqual({
        success: false,
        error: 'Authentication required',
      });

      mockGetMe.mockResolvedValue(makeStaffContext(supaMock.client, { role: 'student' }));
      expect(await settleBorrowingFine({ recordId: VALID_RECORD_ID })).toEqual({
        success: false,
        error: 'Unauthorized access',
      });

      mockGetMe.mockResolvedValue(
        makeStaffContext(supaMock.client, { role: 'student_assistant', isDeactivatedSA: true })
      );
      expect(await settleBorrowingFine({ recordId: VALID_RECORD_ID })).toEqual({
        success: false,
        error: 'Access denied: Staff account is currently deactivated.',
      });

      mockGetMe.mockResolvedValue(makeStaffContext(supaMock.client));
      const invalidUuidRes = await settleBorrowingFine({ recordId: 'not-a-uuid' });
      expect(invalidUuidRes.success).toBe(false);
      expect(invalidUuidRes.error).toBe('Validation failed');
    });

    it('rejects missing record, already settled record, and zero-fine record', async () => {
      adminMock.setTableResponse('borrowing_records', null);
      expect(await settleBorrowingFine({ recordId: VALID_RECORD_ID })).toEqual({
        success: false,
        error: 'Borrowing record not found.',
      });

      adminMock.setTableResponse('borrowing_records', {
        id: VALID_RECORD_ID,
        book_copy_id: 'copy-1',
        due_date: '2026-06-01T00:00:00Z',
        returned_at: '2026-06-05T00:00:00Z',
        status: 'RETURNED',
        fine_amount: 20,
        fine_settled_at: '2026-06-05T01:00:00Z',
      });
      expect(await settleBorrowingFine({ recordId: VALID_RECORD_ID })).toEqual({
        success: false,
        error: 'Overdue penalty is already settled.',
      });

      adminMock.setTableResponse('borrowing_records', {
        id: VALID_RECORD_ID,
        book_copy_id: 'copy-1',
        due_date: '2026-06-10T00:00:00Z',
        returned_at: '2026-06-05T00:00:00Z',
        status: 'RETURNED',
        fine_amount: 0,
        fine_settled_at: null,
      });
      adminMock.setTableResponse('system_settings', { value: '5' });
      expect(await settleBorrowingFine({ recordId: VALID_RECORD_ID })).toEqual({
        success: false,
        error: 'This record has no overdue penalty to settle.',
      });
    });

    it('mode settle: rejects unreturned book and settles returned late record with snapshotted fine', async () => {
      adminMock.setTableResponse('borrowing_records', {
        id: VALID_RECORD_ID,
        book_copy_id: 'copy-1',
        due_date: '2026-06-01T00:00:00Z',
        returned_at: null,
        status: 'OVERDUE',
        fine_amount: null,
        fine_settled_at: null,
      });

      expect(await settleBorrowingFine({ recordId: VALID_RECORD_ID, mode: 'settle' })).toEqual({
        success: false,
        error: 'Book must be returned before settling the penalty.',
      });

      adminMock.setTableResponse('borrowing_records', {
        id: VALID_RECORD_ID,
        book_copy_id: 'copy-1',
        due_date: '2026-06-01T00:00:00Z',
        returned_at: '2026-06-05T00:00:00Z',
        status: 'RETURNED',
        fine_amount: 35,
        fine_settled_at: null,
      });
      adminMock.setTableResponse('system_settings', { value: '5' });

      const res = await settleBorrowingFine({ recordId: VALID_RECORD_ID, mode: 'settle' });

      expect(res.success).toBe(true);
      expect(res.data).toEqual({
        id: VALID_RECORD_ID,
        fine_amount: 35,
        fine_settled_at: expect.any(String),
      });
      const borrowBuilder = adminMock.getTableBuilder('borrowing_records');
      expect(borrowBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          fine_amount: 35,
          fine_settled_at: expect.any(String),
          updated_at: expect.any(String),
        })
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/history');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/circulation');
      expect(mockLogAuditActivity).toHaveBeenCalledWith(
        'staff-1',
        'borrowing_record',
        VALID_RECORD_ID,
        'settle_fine',
        'Settled overdue fine (PHP 35)',
        null,
        null,
        null
      );
    });

    it('mode return_and_settle: looks up QR, calls process_qr_return, settles fine, and handles missing copy or RPC error', async () => {
      adminMock.setTableResponse('borrowing_records', {
        id: VALID_RECORD_ID,
        book_copy_id: 'copy-1',
        due_date: '2026-06-01T00:00:00Z',
        returned_at: null,
        status: 'OVERDUE',
        fine_amount: null,
        fine_settled_at: null,
      });

      // Copy not found
      adminMock.setTableResponse('book_copies', null);
      expect(await settleBorrowingFine({ recordId: VALID_RECORD_ID, mode: 'return_and_settle' })).toEqual({
        success: false,
        error: 'Book copy QR code not found.',
      });

      // RPC error
      adminMock.setTableResponse('book_copies', { qr_string: 'QR-COPY-1' });
      adminMock.setRpcResponse(null, { message: 'RPC failure' }, 'process_qr_return');
      expect(await settleBorrowingFine({ recordId: VALID_RECORD_ID, mode: 'return_and_settle' })).toEqual({
        success: false,
        error: 'RPC failure',
      });

      // Success
      adminMock.setRpcResponse(
        { ok: true, returned_at: '2026-06-06T00:00:00Z', fine_amount: 25 },
        null,
        'process_qr_return'
      );
      adminMock.setTableResponse('system_settings', { value: '5' });

      const res = await settleBorrowingFine({ recordId: VALID_RECORD_ID, mode: 'return_and_settle' });

      expect(adminMock.rpc).toHaveBeenCalledWith('process_qr_return', {
        p_librarian_id: 'staff-1',
        p_book_qr: 'QR-COPY-1',
        p_idempotency_key: null,
        p_preview_only: false,
      });
      expect(res.success).toBe(true);
      expect(res.data).toEqual({
        id: VALID_RECORD_ID,
        fine_amount: 25,
        fine_settled_at: expect.any(String),
      });
      expect(adminMock.getTableBuilder('borrowing_records').update).toHaveBeenCalledWith(
        expect.objectContaining({
          fine_amount: 25,
          fine_settled_at: expect.any(String),
        })
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/history');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/circulation');
    });

    it('mode return_only: rejects already returned, calls process_qr_return, and returns fine_settled_at: null without updating borrowing_records', async () => {
      adminMock.setTableResponse('borrowing_records', {
        id: VALID_RECORD_ID,
        book_copy_id: 'copy-1',
        due_date: '2026-06-01T00:00:00Z',
        returned_at: '2026-06-05T00:00:00Z',
        status: 'RETURNED',
        fine_amount: 20,
        fine_settled_at: null,
      });

      expect(await settleBorrowingFine({ recordId: VALID_RECORD_ID, mode: 'return_only' })).toEqual({
        success: false,
        error: 'Book is already returned.',
      });

      const selectBuilder = createMockQueryBuilder({
        id: VALID_RECORD_ID,
        book_copy_id: 'copy-1',
        due_date: '2026-06-01T00:00:00Z',
        returned_at: null,
        status: 'OVERDUE',
        fine_amount: null,
        fine_settled_at: null,
      });
      adminMock.from.mockImplementation((table: string) => {
        if (table === 'borrowing_records') return selectBuilder;
        return adminMock.getTableBuilder(table);
      });
      adminMock.setTableResponse('book_copies', { qr_string: 'QR-COPY-2' });
      adminMock.setRpcResponse(
        { ok: true, returned_at: '2026-06-06T00:00:00Z', fine_amount: 30 },
        null,
        'process_qr_return'
      );

      const res = await settleBorrowingFine({ recordId: VALID_RECORD_ID, mode: 'return_only' });

      expect(adminMock.rpc).toHaveBeenCalledWith('process_qr_return', {
        p_librarian_id: 'staff-1',
        p_book_qr: 'QR-COPY-2',
        p_idempotency_key: null,
        p_preview_only: false,
      });
      expect(res).toEqual({
        success: true,
        data: {
          id: VALID_RECORD_ID,
          fine_amount: 30,
          fine_settled_at: null,
        },
      });
      expect(selectBuilder.update).not.toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith('/history');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/circulation');
    });
  });
});
