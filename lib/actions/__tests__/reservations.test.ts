import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabaseClient, createMockQueryBuilder } from '@/test/mocks/supabase';

const mockCreateClient = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockGetMe = vi.fn();
const mockLogAuditActivity = vi.fn();
const mockRevalidatePath = vi.fn();
const mockRevalidateTag = vi.fn();

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
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  getBookAvailabilityStatus,
  cancelReservation,
  getMyReservations,
} from '@/lib/actions/reservations';

function makeAuthContext(
  supabase: ReturnType<typeof createMockSupabaseClient>['client'],
  userId = 'student-1',
  role: 'student' | 'librarian' | 'super_admin' | 'student_assistant' = 'student'
) {
  return {
    user: { id: userId },
    profile: { id: userId, role, status: 'ACTIVE' },
    role,
    isStaff: role !== 'student',
    isAdmin: role === 'super_admin',
    isDeactivatedSA: false,
    hasPermission: () => true,
    supabase,
  };
}

describe('reservations server actions', () => {
  let supaMock: ReturnType<typeof createMockSupabaseClient>;
  let adminMock: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    supaMock = createMockSupabaseClient();
    adminMock = createMockSupabaseClient();
    mockCreateClient.mockResolvedValue(supaMock.client);
    mockCreateAdminClient.mockReturnValue(adminMock.client);
    mockGetMe.mockResolvedValue(makeAuthContext(supaMock.client));
    mockLogAuditActivity.mockResolvedValue(undefined);
  });

  describe('getBookAvailabilityStatus', () => {
    it('returns nextAvailableDate for anonymous visitors without querying reservations', async () => {
      supaMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      supaMock.setRpcResponse('2026-06-20T00:00:00Z', null, 'get_next_due_date');

      const res = await getBookAvailabilityStatus('book-1');

      expect(supaMock.rpc).toHaveBeenCalledWith('get_next_due_date', { p_book_id: 'book-1' });
      expect(supaMock.from).not.toHaveBeenCalledWith('reservations');
      expect(res).toEqual({
        nextAvailableDate: '2026-06-20T00:00:00Z',
        hasReservation: false,
        isReady: false,
        queuePosition: null,
        holdExpiresAt: null,
        reservationId: null,
      });
    });

    it('returns null nextAvailableDate when get_next_due_date RPC fails', async () => {
      supaMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'student-1' } }, error: null });
      supaMock.setRpcResponse(null, { message: 'rpc error' }, 'get_next_due_date');
      supaMock.setTableResponse('reservations', null);

      const res = await getBookAvailabilityStatus('book-1');

      expect(res).toEqual({
        nextAvailableDate: null,
        hasReservation: false,
        isReady: false,
        queuePosition: null,
        holdExpiresAt: null,
        reservationId: null,
      });
    });

    it('returns queuePosition for ACTIVE reservation', async () => {
      supaMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'student-1' } }, error: null });
      supaMock.setRpcResponse('2026-06-25T00:00:00Z', null, 'get_next_due_date');
      supaMock.setTableResponse('reservations', {
        id: 'res-active-1',
        status: 'ACTIVE',
        hold_expires_at: null,
        queue_position: 3,
      });

      const res = await getBookAvailabilityStatus('book-1');
      const resBuilder = supaMock.getTableBuilder('reservations');
      expect(resBuilder.eq).toHaveBeenCalledWith('user_id', 'student-1');
      expect(resBuilder.eq).toHaveBeenCalledWith('book_id', 'book-1');
      expect(resBuilder.in).toHaveBeenCalledWith('status', ['ACTIVE', 'READY']);
      expect(res).toEqual({
        nextAvailableDate: '2026-06-25T00:00:00Z',
        hasReservation: true,
        isReady: false,
        queuePosition: 3,
        holdExpiresAt: null,
        reservationId: 'res-active-1',
      });
    });

    it('overrides nextAvailableDate with hold_expires_at for READY reservation', async () => {
      supaMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'student-1' } }, error: null });
      supaMock.setRpcResponse('2026-06-25T00:00:00Z', null, 'get_next_due_date');
      supaMock.setTableResponse('reservations', {
        id: 'res-ready-1',
        status: 'READY',
        hold_expires_at: '2026-06-18T17:00:00Z',
        queue_position: 1,
      });

      const res = await getBookAvailabilityStatus('book-1');

      expect(res).toEqual({
        nextAvailableDate: '2026-06-18T17:00:00Z',
        hasReservation: true,
        isReady: true,
        queuePosition: null,
        holdExpiresAt: '2026-06-18T17:00:00Z',
        reservationId: 'res-ready-1',
      });
    });
  });

  describe('cancelReservation', () => {
    it('rejects unauthenticated callers and invalid non-string input', async () => {
      mockGetMe.mockResolvedValue(null);
      expect(await cancelReservation('res-1')).toEqual({
        success: false,
        error: 'Authentication required',
      });

      mockGetMe.mockResolvedValue(makeAuthContext(supaMock.client));
      const invalidRes = await cancelReservation(12345);
      expect(invalidRes.success).toBe(false);
      expect(invalidRes.error).toBe('Validation failed');
    });

    it('rejects when reservation is not found or belongs to another user', async () => {
      adminMock.setTableResponse('reservations', null, { message: 'No rows' });
      expect(await cancelReservation('res-404')).toEqual({
        success: false,
        error: 'Reservation not found',
      });

      adminMock.setTableResponse('reservations', {
        user_id: 'other-student',
        book_id: 'book-1',
        status: 'ACTIVE',
        copy_id: null,
      });
      expect(await cancelReservation('res-other')).toEqual({
        success: false,
        error: 'Unauthorized',
      });
    });

    it('cancels an ACTIVE reservation, compresses queue, logs audit, and revalidates tags/paths', async () => {
      adminMock.setTableResponse('reservations', {
        user_id: 'student-1',
        book_id: 'book-42',
        status: 'ACTIVE',
        copy_id: null,
      });
      adminMock.setRpcResponse(null, null, 'compress_reservation_queue');

      const res = await cancelReservation('res-active-1');

      expect(res).toEqual({ success: true, data: { success: true } });
      const resBuilder = adminMock.getTableBuilder('reservations');
      expect(resBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'CANCELLED',
          updated_at: expect.any(String),
        })
      );
      expect(adminMock.rpc).toHaveBeenCalledWith('compress_reservation_queue', { p_book_id: 'book-42' });
      expect(adminMock.rpc).not.toHaveBeenCalledWith('release_copy', expect.anything());
      expect(mockRevalidateTag).toHaveBeenCalledWith('book-book-42', 'max');
      expect(mockRevalidateTag).toHaveBeenCalledWith('public-books', 'max');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard', 'page');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/student-catalog', 'page');
      expect(mockLogAuditActivity).toHaveBeenCalledWith(
        'student-1',
        'reservation',
        'system',
        'cancel',
        'Cancelled reservation for book: book-42',
        { bookId: 'book-42' },
        { status: 'ACTIVE' },
        { status: 'CANCELLED' }
      );
    });

    it('cancels a READY reservation with copy_id by calling release_copy RPC', async () => {
      adminMock.setTableResponse('reservations', {
        user_id: 'student-1',
        book_id: 'book-99',
        status: 'READY',
        copy_id: 'copy-77',
      });
      adminMock.setRpcResponse(null, null, 'release_copy');

      const res = await cancelReservation('res-ready-1');

      expect(res).toEqual({ success: true, data: { success: true } });
      expect(adminMock.rpc).toHaveBeenCalledWith('release_copy', { p_copy_id: 'copy-77' });
      expect(adminMock.rpc).not.toHaveBeenCalledWith('compress_reservation_queue', expect.anything());
    });

    it('propagates DB update error and release_copy RPC error', async () => {
      const fetchBuilder = createMockQueryBuilder({
        user_id: 'student-1',
        book_id: 'book-1',
        status: 'READY',
        copy_id: 'copy-1',
      });
      const updateErrBuilder = createMockQueryBuilder(null, { message: 'Update denied' });

      let calls = 0;
      adminMock.from.mockImplementation((table: string) => {
        if (table === 'reservations') {
          calls += 1;
          return calls === 1 ? fetchBuilder : updateErrBuilder;
        }
        return adminMock.getTableBuilder(table);
      });

      expect(await cancelReservation('res-1')).toEqual({
        success: false,
        error: 'Update denied',
      });

      // Now update succeeds, release_copy fails
      adminMock.from.mockImplementation((table: string) => adminMock.getTableBuilder(table));
      adminMock.setTableResponse('reservations', {
        user_id: 'student-1',
        book_id: 'book-1',
        status: 'READY',
        copy_id: 'copy-1',
      });
      adminMock.setRpcResponse(null, { message: 'release_copy failed' }, 'release_copy');

      expect(await cancelReservation('res-1')).toEqual({
        success: false,
        error: 'release_copy failed',
      });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });

  describe('getMyReservations', () => {
    it('returns empty array when unauthenticated', async () => {
      supaMock.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      const res = await getMyReservations();
      expect(res).toEqual([]);
      expect(supaMock.from).not.toHaveBeenCalled();
    });

    it('fetches ACTIVE and READY reservations for the signed-in user', async () => {
      supaMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'student-1' } }, error: null });
      const rows = [
        {
          id: 'res-1',
          status: 'READY',
          queue_position: 1,
          hold_expires_at: '2026-06-18T17:00:00Z',
          books: { id: 'book-1', title: 'Dune', author: 'Frank Herbert', cover_url: null },
        },
        {
          id: 'res-2',
          status: 'ACTIVE',
          queue_position: 2,
          hold_expires_at: null,
          books: { id: 'book-2', title: 'Foundation', author: 'Isaac Asimov', cover_url: null },
        },
      ];
      supaMock.setTableResponse('reservations', rows);

      const res = await getMyReservations();
      const resBuilder = supaMock.getTableBuilder('reservations');
      expect(resBuilder.eq).toHaveBeenCalledWith('user_id', 'student-1');
      expect(resBuilder.in).toHaveBeenCalledWith('status', ['ACTIVE', 'READY']);
      expect(resBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(res).toEqual(rows);
    });

    it('throws when the reservations query errors', async () => {
      supaMock.auth.getUser.mockResolvedValue({ data: { user: { id: 'student-1' } }, error: null });
      supaMock.setTableResponse('reservations', null, { message: 'Query failed' });

      await expect(getMyReservations()).rejects.toThrow('Query failed');
    });
  });
});
