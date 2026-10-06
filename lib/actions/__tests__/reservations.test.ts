import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cancelReservation, getBookAvailabilityStatus, getMyReservations } from '../reservations';
import { getMe } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAuditActivity } from '@/lib/audit';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';
import type { ProfileData, UserRole } from '@/lib/types';

vi.mock('@/lib/auth-helpers', () => ({
  getMe: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditActivity: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

describe('Reservations Server Actions', () => {
  let mockUserClientHelper: MockSupabaseClientHelper;
  let mockAdminClientHelper: MockSupabaseClientHelper;

  const mockUserMe = (userId = 'user-patron-1', role: UserRole = 'student') => ({
    user: {
      id: userId,
      email: 'patron@school.edu',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id: userId,
      email: 'patron@school.edu',
      role,
      status: 'ACTIVE',
      full_name: 'Patron Student',
      permissions: {},
    } as unknown as ProfileData & {
      id: string;
      email: string | null;
      role: string;
      status: string;
      permissions: Record<string, boolean> | null;
    },
    role,
    isStaff: ['super_admin', 'librarian', 'student_assistant'].includes(role),
    isAdmin: role === 'super_admin',
    isDeactivatedSA: false,
    hasPermission: vi.fn().mockReturnValue(true),
    supabase: mockUserClientHelper.client,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserClientHelper = createMockSupabaseClient();
    mockAdminClientHelper = createMockSupabaseClient();

    vi.mocked(getMe).mockResolvedValue(
      mockUserMe() as unknown as Awaited<ReturnType<typeof getMe>>
    );
    vi.mocked(createClient).mockResolvedValue(
      mockUserClientHelper.client as unknown as Awaited<ReturnType<typeof createClient>>
    );
    vi.mocked(createAdminClient).mockReturnValue(
      mockAdminClientHelper.client as unknown as ReturnType<typeof createAdminClient>
    );
    vi.mocked(logAuditActivity).mockResolvedValue(undefined);
  });

  describe('cancelReservation', () => {
    it('rejects cancellation when user is unauthenticated', async () => {
      vi.mocked(getMe).mockResolvedValue(null);

      const result = await cancelReservation('res-123');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Authentication required');
      }
    });

    it('throws error when reservation is not found in database', async () => {
      mockAdminClientHelper.setTableResponse('reservations', null, { message: 'Not found' });

      const result = await cancelReservation('res-nonexistent');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Reservation not found');
      }
    });

    it('verifies ownership and rejects cancellation when reservation belongs to another user', async () => {
      const resBuilder = mockAdminClientHelper.getTableBuilder('reservations');
      resBuilder.single.mockResolvedValueOnce({
        data: {
          user_id: 'other-user-999',
          book_id: 'book-1',
          status: 'ACTIVE',
          copy_id: null,
        },
        error: null,
      });

      const result = await cancelReservation('res-other-patron');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
      }
    });

    it('cancels an ACTIVE reservation, compresses queue, and does not reassign copies', async () => {
      const resBuilder = mockAdminClientHelper.getTableBuilder('reservations');
      // 1. Initial lookup
      resBuilder.single.mockResolvedValueOnce({
        data: {
          user_id: 'user-patron-1',
          book_id: 'book-math-101',
          status: 'ACTIVE',
          copy_id: null,
        },
        error: null,
      });

      const result = await cancelReservation('res-active-1');

      expect(result.success).toBe(true);
      // Status updated to CANCELLED
      expect(resBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CANCELLED' })
      );
      // Calls compress_reservation_queue directly
      expect(mockAdminClientHelper.rpc).toHaveBeenCalledWith('compress_reservation_queue', {
        p_book_id: 'book-math-101',
      });
      // Does not check nextInQueue or update book_copies
      expect(mockAdminClientHelper.from).not.toHaveBeenCalledWith('book_copies');
      // Revalidates cache tags and paths
      expect(revalidateTag).toHaveBeenCalledWith('book-book-math-101', 'max');
      expect(revalidateTag).toHaveBeenCalledWith('public-books', 'max');
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard', 'page');
      expect(revalidatePath).toHaveBeenCalledWith('/student-catalog', 'page');
    });

    it('cancels a READY reservation and reassigns copy to next patron in queue', async () => {
      const resBuilder = mockAdminClientHelper.getTableBuilder('reservations');
      // 1. Initial reservation lookup
      resBuilder.single.mockResolvedValueOnce({
        data: {
          user_id: 'user-patron-1',
          book_id: 'book-cs-50',
          status: 'READY',
          copy_id: 'copy-cs-50-1',
        },
        error: null,
      });

      // 2. Next in queue lookup in reassignCopy
      resBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'next-res-uuid-2' },
        error: null,
      });

      // 3. System settings hold_expiry_days
      mockAdminClientHelper.setTableResponse('system_settings', {
        value: '5',
      });

      const result = await cancelReservation('res-ready-1');

      expect(result.success).toBe(true);
      // Promotes next patron in queue
      expect(resBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'READY',
          copy_id: 'copy-cs-50-1',
          hold_expires_at: expect.any(String),
        })
      );
      // Compresses reservation queue
      expect(mockAdminClientHelper.rpc).toHaveBeenCalledWith('compress_reservation_queue', {
        p_book_id: 'book-cs-50',
      });
      // Book copy was NOT reverted to AVAILABLE because it was handed over to next waiter
      expect(mockAdminClientHelper.from).not.toHaveBeenCalledWith('book_copies');
    });

    it('cancels a READY reservation with empty queue and returns copy to shelf (AVAILABLE)', async () => {
      const resBuilder = mockAdminClientHelper.getTableBuilder('reservations');
      const copyBuilder = mockAdminClientHelper.getTableBuilder('book_copies');

      // 1. Initial reservation lookup
      resBuilder.single.mockResolvedValueOnce({
        data: {
          user_id: 'user-patron-1',
          book_id: 'book-phy-1',
          status: 'READY',
          copy_id: 'copy-phy-100',
        },
        error: null,
      });

      // 2. Next in queue lookup returns null (queue empty)
      resBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await cancelReservation('res-ready-empty-queue');

      expect(result.success).toBe(true);
      // Reverts book copy to AVAILABLE
      expect(copyBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'AVAILABLE' })
      );
      // Compresses reservation queue
      expect(mockAdminClientHelper.rpc).toHaveBeenCalledWith('compress_reservation_queue', {
        p_book_id: 'book-phy-1',
      });
    });

    it('throws error when database update fails on cancellation', async () => {
      const resBuilder = mockAdminClientHelper.getTableBuilder('reservations');
      resBuilder.single.mockResolvedValueOnce({
        data: {
          user_id: 'user-patron-1',
          book_id: 'book-1',
          status: 'ACTIVE',
          copy_id: null,
        },
        error: null,
      });
      // Update fails
      resBuilder.update.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ error: { message: 'Row lock failed' } }),
      } as unknown as ReturnType<typeof resBuilder.update>);

      const result = await cancelReservation('res-active-fail');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Row lock failed');
      }
    });

    it('rejects cancellation of another patron reservation even when caller is staff or librarian', async () => {
      vi.mocked(getMe).mockResolvedValue(
        mockUserMe('staff-user-1', 'librarian') as unknown as Awaited<ReturnType<typeof getMe>>
      );
      const resBuilder = mockAdminClientHelper.getTableBuilder('reservations');
      resBuilder.single.mockResolvedValueOnce({
        data: {
          user_id: 'student-patron-2',
          book_id: 'book-100',
          status: 'ACTIVE',
          copy_id: null,
        },
        error: null,
      });

      const result = await cancelReservation('res-patron-2');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
      }
    });

    it('rejects invalid non-string reservation ID via schema validation', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await cancelReservation(12345 as any);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/validation/i);
      }
    });

    it('accurately calculates hold expiry timestamp when promoting to next in queue', async () => {
      vi.useFakeTimers();
      const fixedNow = new Date('2026-10-06T10:00:00.000Z');
      vi.setSystemTime(fixedNow);

      try {
        const resBuilder = mockAdminClientHelper.getTableBuilder('reservations');
        resBuilder.single.mockResolvedValueOnce({
          data: {
            user_id: 'user-patron-1',
            book_id: 'book-cs-50',
            status: 'READY',
            copy_id: 'copy-cs-50-1',
          },
          error: null,
        });

        resBuilder.maybeSingle.mockResolvedValueOnce({
          data: { id: 'next-res-uuid-2' },
          error: null,
        });

        mockAdminClientHelper.setTableResponse('system_settings', {
          value: '4', // 4 days
        });

        const result = await cancelReservation('res-ready-1');

        expect(result.success).toBe(true);
        // Expiry must be exactly 4 days from fixedNow: 2026-10-10T10:00:00.000Z
        expect(resBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'READY',
            copy_id: 'copy-cs-50-1',
            hold_expires_at: '2026-10-10T10:00:00.000Z',
          })
        );
        expect(mockAdminClientHelper.rpc).toHaveBeenCalledWith('compress_reservation_queue', {
          p_book_id: 'book-cs-50',
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('falls back to default 3-day hold expiry when system_settings value is missing or null', async () => {
      vi.useFakeTimers();
      const fixedNow = new Date('2026-10-06T10:00:00.000Z');
      vi.setSystemTime(fixedNow);

      try {
        const resBuilder = mockAdminClientHelper.getTableBuilder('reservations');
        resBuilder.single.mockResolvedValueOnce({
          data: {
            user_id: 'user-patron-1',
            book_id: 'book-bio-1',
            status: 'READY',
            copy_id: 'copy-bio-1',
          },
          error: null,
        });

        resBuilder.maybeSingle.mockResolvedValueOnce({
          data: { id: 'next-res-uuid-3' },
          error: null,
        });

        mockAdminClientHelper.setTableResponse('system_settings', null);

        const result = await cancelReservation('res-ready-fallback');

        expect(result.success).toBe(true);
        // Expiry must fall back to 3 days from fixedNow: 2026-10-09T10:00:00.000Z
        expect(resBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'READY',
            copy_id: 'copy-bio-1',
            hold_expires_at: '2026-10-09T10:00:00.000Z',
          })
        );
        expect(mockAdminClientHelper.rpc).toHaveBeenCalledWith('compress_reservation_queue', {
          p_book_id: 'book-bio-1',
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('compresses queue directly if READY reservation has missing copy_id', async () => {
      const resBuilder = mockAdminClientHelper.getTableBuilder('reservations');
      resBuilder.single.mockResolvedValueOnce({
        data: {
          user_id: 'user-patron-1',
          book_id: 'book-arch-1',
          status: 'READY',
          copy_id: null, // missing copy_id
        },
        error: null,
      });

      const result = await cancelReservation('res-ready-no-copy');

      expect(result.success).toBe(true);
      expect(resBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'CANCELLED' })
      );
      // Calls compress_reservation_queue directly without trying reassignCopy
      expect(mockAdminClientHelper.rpc).toHaveBeenCalledWith('compress_reservation_queue', {
        p_book_id: 'book-arch-1',
      });
      expect(mockAdminClientHelper.from).not.toHaveBeenCalledWith('book_copies');
    });
  });

  describe('getBookAvailabilityStatus', () => {
    it('returns earliest due date from active borrowing records', async () => {
      // 1. Active borrow record exists
      mockUserClientHelper.setTableResponse('borrowing_records', [
        { due_date: '2026-11-15T00:00:00.000Z' },
      ]);
      // 2. User has no reservation
      mockUserClientHelper.setTableResponse('reservations', null);

      const status = await getBookAvailabilityStatus('book-uuid-early');

      expect(status.nextAvailableDate).toBe('2026-11-15T00:00:00.000Z');
      expect(status.hasReservation).toBe(false);
      expect(status.isReady).toBe(false);
      expect(status.queuePosition).toBeNull();
      expect(status.holdExpiresAt).toBeNull();
    });

    it('resolves READY reservation with pickup deadline for authenticated user', async () => {
      mockUserClientHelper.setTableResponse('borrowing_records', []);
      mockUserClientHelper.setTableResponse('reservations', {
        id: 'res-ready-uuid',
        status: 'READY',
        hold_expires_at: '2026-10-12T15:00:00.000Z',
        queue_position: 1,
      });
      mockUserClientHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-patron-1' } },
        error: null,
      });

      const status = await getBookAvailabilityStatus('book-uuid-ready');

      expect(status.hasReservation).toBe(true);
      expect(status.isReady).toBe(true);
      expect(status.holdExpiresAt).toBe('2026-10-12T15:00:00.000Z');
      expect(status.nextAvailableDate).toBe('2026-10-12T15:00:00.000Z');
      expect(status.reservationId).toBe('res-ready-uuid');
    });

    it('resolves ACTIVE reservation with queue position for authenticated user', async () => {
      mockUserClientHelper.setTableResponse('borrowing_records', [
        { due_date: '2026-10-20T00:00:00.000Z' },
      ]);
      mockUserClientHelper.setTableResponse('reservations', {
        id: 'res-active-uuid',
        status: 'ACTIVE',
        hold_expires_at: null,
        queue_position: 4,
      });
      mockUserClientHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-patron-1' } },
        error: null,
      });

      const status = await getBookAvailabilityStatus('book-uuid-active');

      expect(status.hasReservation).toBe(true);
      expect(status.isReady).toBe(false);
      expect(status.queuePosition).toBe(4);
      expect(status.nextAvailableDate).toBe('2026-10-20T00:00:00.000Z');
      expect(status.reservationId).toBe('res-active-uuid');
    });

    it('handles unauthenticated visitors returning availability without personal reservation state', async () => {
      mockUserClientHelper.setTableResponse('borrowing_records', [
        { due_date: '2026-12-01T00:00:00.000Z' },
      ]);
      mockUserClientHelper.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const status = await getBookAvailabilityStatus('book-guest-view');

      expect(status.nextAvailableDate).toBe('2026-12-01T00:00:00.000Z');
      expect(status.hasReservation).toBe(false);
      expect(status.isReady).toBe(false);
      expect(status.reservationId).toBeNull();
      expect(status.queuePosition).toBeNull();
    });
  });

  describe('getMyReservations', () => {
    it('returns empty array when user is not authenticated', async () => {
      mockUserClientHelper.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const reservations = await getMyReservations();
      expect(reservations).toEqual([]);
    });

    it('returns list of reservations for current authenticated user', async () => {
      mockUserClientHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-patron-1' } },
        error: null,
      });

      const mockReservations = [
        {
          id: 'res-1',
          status: 'READY',
          queue_position: 1,
          hold_expires_at: '2026-10-15T00:00:00.000Z',
          books: { id: 'b-1', title: 'Calculus', author: 'Stewart', cover_url: null },
        },
      ];
      mockUserClientHelper.setTableResponse('reservations', mockReservations);

      const reservations = await getMyReservations();
      expect(reservations).toEqual(mockReservations);
    });

    it('throws error when database query fails', async () => {
      mockUserClientHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-patron-1' } },
        error: null,
      });
      mockUserClientHelper.setTableResponse('reservations', null, { message: 'Network timeout' });

      await expect(getMyReservations()).rejects.toThrow('Network timeout');
    });
  });
});
