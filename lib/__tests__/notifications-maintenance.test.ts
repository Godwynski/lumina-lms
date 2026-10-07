import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runMaintenanceTasks,
  sendNotification,
  sendBulkNotifications,
} from '../notifications';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOverdueEmail, sendDueSoonEmail } from '../mail';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('../mail', () => ({
  sendOverdueEmail: vi.fn(),
  sendDueSoonEmail: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Notifications Service & Maintenance Tasks', () => {
  let mockAdminHelper: MockSupabaseClientHelper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminHelper = createMockSupabaseClient();
    vi.mocked(createAdminClient).mockReturnValue(
      mockAdminHelper.client as unknown as ReturnType<typeof createAdminClient>
    );
    vi.mocked(sendOverdueEmail).mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof sendOverdueEmail>>);
    vi.mocked(sendDueSoonEmail).mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof sendDueSoonEmail>>);
  });

  describe('runMaintenanceTasks', () => {
    it('executes due soon sweep, sends notifications and emails, and marks reminder_sent', async () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // System settings with 2 days reminder
      mockAdminHelper.setTableResponse('system_settings', [
        { key: 'due_soon_reminder_days', value: '2' },
      ]);

      const dueSoonRecord = {
        id: 'borrow-1',
        user_id: 'user-001',
        due_date: tomorrow.toISOString(),
        status: 'ACTIVE',
        reminder_sent: false,
        profiles: {
          full_name: 'Alice Student',
          email: 'alice@school.edu',
        },
        book_copy: {
          book_id: 'book-100',
          book: {
            title: 'Introduction to Algorithms',
            author: 'CLRS',
            cover_url: 'https://example.com/algo.jpg',
          },
        },
      };

      // Mock notifications insert success
      const notifBuilder = mockAdminHelper.getTableBuilder('notifications');
      notifBuilder.insert.mockReturnValue({
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ error: null }).then(resolve),
      });

      // Set responses
      mockAdminHelper.setTableResponse('borrowing_records', [dueSoonRecord]);
      mockAdminHelper.setTableResponse('reservations', []);

      const results = await runMaintenanceTasks();

      expect(results.remindersSent).toBe(1);
      expect(results.errors).toHaveLength(0);

      // Verify email dispatched
      expect(sendDueSoonEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'alice@school.edu',
          userName: 'Alice Student',
          bookTitle: 'Introduction to Algorithms',
        })
      );

      // Verify borrowing record was updated with reminder_sent: true
      const borrowBuilder = mockAdminHelper.getTableBuilder('borrowing_records');
      expect(borrowBuilder.update).toHaveBeenCalledWith({ reminder_sent: true });
    });

    it('transitions active overdue borrowings to OVERDUE status and sends urgent notices', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

      mockAdminHelper.setTableResponse('system_settings', []);

      const overdueRecord = {
        id: 'borrow-overdue-1',
        user_id: 'user-002',
        due_date: threeDaysAgo.toISOString(),
        status: 'ACTIVE',
        reminder_sent: true,
        profiles: {
          full_name: 'Bob Reader',
          email: 'bob@school.edu',
        },
        book_copy: {
          book_id: 'book-200',
          book: {
            title: 'Clean Code',
            author: 'Robert C. Martin',
            cover_url: null,
          },
        },
      };

      const notifBuilder = mockAdminHelper.getTableBuilder('notifications');
      notifBuilder.insert.mockReturnValue({
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ error: null }).then(resolve),
      });

      mockAdminHelper.setTableResponse('borrowing_records', [overdueRecord]);
      mockAdminHelper.setTableResponse('reservations', []);

      const results = await runMaintenanceTasks();

      expect(results.overdueTagged).toBe(1);

      // Verify record status transitioned to OVERDUE
      const borrowBuilder = mockAdminHelper.getTableBuilder('borrowing_records');
      expect(borrowBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'OVERDUE',
          updated_at: expect.any(String),
        })
      );

      // Verify overdue email sent
      expect(sendOverdueEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'bob@school.edu',
          userName: 'Bob Reader',
          bookTitle: 'Clean Code',
          overdueDays: expect.any(Number),
        })
      );
    });

    it('does not re-tag or re-notify borrowings that are already in OVERDUE status', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);

      mockAdminHelper.setTableResponse('system_settings', []);

      const alreadyOverdueRecord = {
        id: 'borrow-already-overdue',
        user_id: 'user-003',
        due_date: pastDate.toISOString(),
        status: 'OVERDUE', // Already OVERDUE
        reminder_sent: true,
        profiles: { full_name: 'Charlie', email: 'charlie@school.edu' },
        book_copy: {
          book_id: 'book-300',
          book: { title: 'Compilers', author: 'Aho', cover_url: null },
        },
      };

      mockAdminHelper.setTableResponse('borrowing_records', [alreadyOverdueRecord]);
      mockAdminHelper.setTableResponse('reservations', []);

      const results = await runMaintenanceTasks();

      // Should not tag again
      expect(results.overdueTagged).toBe(0);
      expect(sendOverdueEmail).not.toHaveBeenCalled();
    });

    it('cancels expired reservations in READY status past 3 days and notifies patron', async () => {
      mockAdminHelper.setTableResponse('system_settings', []);
      mockAdminHelper.setTableResponse('borrowing_records', []);

      const expiredReservation = {
        id: 'res-99',
        user_id: 'user-patron-9',
        status: 'READY',
        updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        books: {
          title: 'Design Patterns',
        },
      };

      mockAdminHelper.setTableResponse('reservations', [expiredReservation]);

      const notifBuilder = mockAdminHelper.getTableBuilder('notifications');
      notifBuilder.insert.mockReturnValue({
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ error: null }).then(resolve),
      });

      const resBuilder = mockAdminHelper.getTableBuilder('reservations');
      resBuilder.update.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const results = await runMaintenanceTasks();

      expect(results.reservationsExpired).toBe(1);
      expect(resBuilder.update).toHaveBeenCalledWith({ status: 'CANCELLED' });
      expect(notifBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-patron-9',
          title: 'Reservation Expired',
          type: 'RESERVATION_EXPIRED',
          priority: 'low',
        })
      );
    });

    it('captures errors per maintenance section without aborting subsequent tasks', async () => {
      mockAdminHelper.setTableResponse('system_settings', []);

      // Force due soon query to throw
      const borrowBuilder = mockAdminHelper.getTableBuilder('borrowing_records');
      borrowBuilder.select.mockImplementation(() => {
        throw new Error('Database disk full');
      });

      const results = await runMaintenanceTasks();

      expect(results.errors.length).toBeGreaterThan(0);
      expect(results.errors[0]).toContain('Database disk full');
    });
  });

  describe('sendNotification', () => {
    it('successfully inserts notification with default type SYSTEM and priority medium', async () => {
      const notifBuilder = mockAdminHelper.getTableBuilder('notifications');
      notifBuilder.insert.mockResolvedValue({ error: null });

      const result = await sendNotification({
        userId: 'user-single-1',
        title: 'System Notice',
        content: 'System will undergo maintenance tonight.',
      });

      expect(result).toEqual({ success: true });
      expect(mockAdminHelper.from).toHaveBeenCalledWith('notifications');
      expect(notifBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-single-1',
        title: 'System Notice',
        content: 'System will undergo maintenance tonight.',
        type: 'SYSTEM',
        priority: 'medium',
        metadata: {},
      });
    });

    it('correctly maps custom type, priority, and metadata payload', async () => {
      const notifBuilder = mockAdminHelper.getTableBuilder('notifications');
      notifBuilder.insert.mockResolvedValue({ error: null });

      const result = await sendNotification({
        userId: 'user-custom-1',
        title: 'Hold Ready',
        content: 'Your book is ready for pickup at circulation desk.',
        type: 'RESERVATION',
        priority: 'high',
        metadata: { bookId: 'b-999', holdId: 'h-111' },
      });

      expect(result).toEqual({ success: true });
      expect(notifBuilder.insert).toHaveBeenCalledWith({
        user_id: 'user-custom-1',
        title: 'Hold Ready',
        content: 'Your book is ready for pickup at circulation desk.',
        type: 'RESERVATION',
        priority: 'high',
        metadata: { bookId: 'b-999', holdId: 'h-111' },
      });
    });

    it('returns error failure object when insertion error occurs', async () => {
      const notifBuilder = mockAdminHelper.getTableBuilder('notifications');
      notifBuilder.insert.mockResolvedValue({
        error: { message: 'Foreign key constraint violated' },
      });

      const result = await sendNotification({
        userId: 'invalid-user',
        title: 'Test',
        content: 'Content',
      });

      expect(result).toEqual({
        success: false,
        error: 'Foreign key constraint violated',
      });
    });

    it('handles unexpected exceptions cleanly', async () => {
      const notifBuilder = mockAdminHelper.getTableBuilder('notifications');
      notifBuilder.insert.mockRejectedValue(new Error('Connection terminated'));

      const result = await sendNotification({
        userId: 'user-err',
        title: 'Test',
        content: 'Content',
      });

      expect(result).toEqual({
        success: false,
        error: 'Connection terminated',
      });
    });
  });

  describe('sendBulkNotifications', () => {
    it('creates batch notification entries for multiple user IDs', async () => {
      const notifBuilder = mockAdminHelper.getTableBuilder('notifications');
      notifBuilder.insert.mockResolvedValue({ error: null });

      const targetUsers = ['user-1', 'user-2', 'user-3'];
      const result = await sendBulkNotifications(targetUsers, {
        title: 'Library Announcement',
        content: 'Library hours extended during finals week.',
        type: 'SYSTEM',
        priority: 'medium',
        metadata: { event: 'finals_week' },
      });

      expect(result).toEqual({ success: true });
      expect(notifBuilder.insert).toHaveBeenCalledWith([
        {
          user_id: 'user-1',
          title: 'Library Announcement',
          content: 'Library hours extended during finals week.',
          type: 'SYSTEM',
          priority: 'medium',
          metadata: { event: 'finals_week' },
        },
        {
          user_id: 'user-2',
          title: 'Library Announcement',
          content: 'Library hours extended during finals week.',
          type: 'SYSTEM',
          priority: 'medium',
          metadata: { event: 'finals_week' },
        },
        {
          user_id: 'user-3',
          title: 'Library Announcement',
          content: 'Library hours extended during finals week.',
          type: 'SYSTEM',
          priority: 'medium',
          metadata: { event: 'finals_week' },
        },
      ]);
    });

    it('returns error object when bulk insert fails', async () => {
      const notifBuilder = mockAdminHelper.getTableBuilder('notifications');
      notifBuilder.insert.mockResolvedValue({
        error: { message: 'Payload size exceeded' },
      });

      const result = await sendBulkNotifications(['u-1'], {
        title: 'Title',
        content: 'Content',
      });

      expect(result).toEqual({
        success: false,
        error: 'Payload size exceeded',
      });
    });

    it('handles unexpected exceptions in bulk notifications', async () => {
      const notifBuilder = mockAdminHelper.getTableBuilder('notifications');
      notifBuilder.insert.mockRejectedValue(new Error('Network disconnect'));

      const result = await sendBulkNotifications(['u-1'], {
        title: 'Title',
        content: 'Content',
      });

      expect(result).toEqual({
        success: false,
        error: 'Network disconnect',
      });
    });
  });
});
