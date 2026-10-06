import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveScan, checkoutBook, returnBook } from '../circulation';
import { getMe } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAuditActivity } from '@/lib/audit';
import { sendNotification } from '@/lib/notifications';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';
import type { ProfileData, UserRole } from '@/lib/types';

vi.mock('@/lib/auth-helpers', () => ({
  getMe: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditActivity: vi.fn(),
}));

vi.mock('@/lib/notifications', () => ({
  sendNotification: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Circulation Server Actions', () => {
  let mockUserClientHelper: MockSupabaseClientHelper;
  let mockAdminClientHelper: MockSupabaseClientHelper;

  const mockStaffUser = (role: UserRole = 'librarian', id = 'staff-1') => ({
    user: {
      id,
      email: 'staff@school.edu',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id,
      email: 'staff@school.edu',
      role,
      status: 'ACTIVE',
      full_name: 'Staff Member',
      permissions: { manage_circulation: true },
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
    supabase: mockUserClientHelper.client,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserClientHelper = createMockSupabaseClient();
    mockAdminClientHelper = createMockSupabaseClient();

    vi.mocked(getMe).mockResolvedValue(
      mockStaffUser() as unknown as Awaited<ReturnType<typeof getMe>>
    );
    vi.mocked(createAdminClient).mockReturnValue(
      mockAdminClientHelper.client as unknown as ReturnType<typeof createAdminClient>
    );
    vi.mocked(sendNotification).mockResolvedValue({ success: true });
    vi.mocked(logAuditActivity).mockResolvedValue(undefined);
  });

  describe('resolveScan', () => {
    it('resolves active student library card by card_number', async () => {
      mockUserClientHelper.setTableResponse('library_cards', {
        card_number: 'CARD-12345',
        status: 'ACTIVE',
        user_id: 'student-uuid-1',
        profiles: {
          full_name: 'Alice Johnson',
          student_id: 'STU-2026-001',
          status: 'ACTIVE',
        },
      });

      const result = await resolveScan({
        scanValue: 'CARD-12345',
        expectedType: 'auto',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          type: 'student',
          data: {
            cardNumber: 'CARD-12345',
            status: 'ACTIVE',
            userId: 'student-uuid-1',
            fullName: 'Alice Johnson',
            studentId: 'STU-2026-001',
          },
        });
      }
    });

    it('falls back to resolving student by student_id in profiles when card is not found', async () => {
      mockUserClientHelper.setTableResponse('library_cards', null);
      mockUserClientHelper.setTableResponse('profiles', {
        id: 'student-uuid-2',
        full_name: 'Bob Smith',
        student_id: 'STU-2026-002',
        status: 'ACTIVE',
      });

      const result = await resolveScan({
        scanValue: 'STU-2026-002',
        expectedType: 'auto',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          type: 'student',
          data: {
            cardNumber: 'STU-2026-002',
            status: 'ACTIVE',
            userId: 'student-uuid-2',
            fullName: 'Bob Smith',
            studentId: 'STU-2026-002',
          },
        });
      }
    });

    it('rejects inactive library card with descriptive error', async () => {
      mockUserClientHelper.setTableResponse('library_cards', {
        card_number: 'CARD-INACTIVE',
        status: 'SUSPENDED',
        user_id: 'student-uuid-3',
        profiles: {
          full_name: 'Charlie Brown',
          student_id: 'STU-2026-003',
          status: 'ACTIVE',
        },
      });

      const result = await resolveScan({ scanValue: 'CARD-INACTIVE' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Library card is not active.');
      }
    });

    it('rejects student profile that is inactive or suspended', async () => {
      mockUserClientHelper.setTableResponse('library_cards', {
        card_number: 'CARD-SUSPENDED-USER',
        status: 'ACTIVE',
        user_id: 'student-uuid-4',
        profiles: {
          full_name: 'David Miller',
          student_id: 'STU-2026-004',
          status: 'SUSPENDED',
        },
      });

      const result = await resolveScan({ scanValue: 'CARD-SUSPENDED-USER' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Student account is suspended.');
      }
    });

    it('resolves active book copy by qr_string', async () => {
      mockUserClientHelper.setTableResponse('library_cards', null);
      mockUserClientHelper.setTableResponse('profiles', null);
      mockUserClientHelper.setTableResponse('book_copies', {
        id: 'copy-uuid-1',
        qr_string: 'BOOK-QR-999',
        status: 'AVAILABLE',
        book_id: 'book-uuid-1',
        books: {
          title: 'Structure and Interpretation of Computer Programs',
        },
      });

      const result = await resolveScan({
        scanValue: 'BOOK-QR-999',
        expectedType: 'auto',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          type: 'book',
          data: {
            copyId: 'copy-uuid-1',
            qrString: 'BOOK-QR-999',
            status: 'AVAILABLE',
            bookId: 'book-uuid-1',
            bookTitle: 'Structure and Interpretation of Computer Programs',
          },
        });
      }
    });

    it('skips student lookup when expectedType is "book"', async () => {
      mockUserClientHelper.setTableResponse('book_copies', {
        id: 'copy-uuid-2',
        qr_string: 'BOOK-EXPLICIT',
        status: 'AVAILABLE',
        book_id: 'book-uuid-2',
        books: { title: 'Clean Architecture' },
      });

      const result = await resolveScan({
        scanValue: 'BOOK-EXPLICIT',
        expectedType: 'book',
      });

      expect(result.success).toBe(true);
      expect(mockUserClientHelper.from).not.toHaveBeenCalledWith('library_cards');
    });

    it('returns context-aware error message for camera vs manual scan failure', async () => {
      mockUserClientHelper.setTableResponse('library_cards', null);
      mockUserClientHelper.setTableResponse('profiles', null);
      mockUserClientHelper.setTableResponse('book_copies', null);

      // Camera scan error
      const cameraResult = await resolveScan({
        scanValue: 'UNKNOWN-QR',
        isManual: false,
      });
      expect(cameraResult.success).toBe(false);
      if (!cameraResult.success) {
        expect(cameraResult.error).toBe('Scanned QR is not recognized by the circulation system.');
      }

      // Manual scan error
      const manualResult = await resolveScan({
        scanValue: 'UNKNOWN-ID',
        isManual: true,
      });
      expect(manualResult.success).toBe(false);
      if (!manualResult.success) {
        expect(manualResult.error).toBe('The identifier is not recognized by the circulation system.');
      }
    });

    it('propagates database error when query fails', async () => {
      mockUserClientHelper.setTableResponse('library_cards', null, { message: 'Database connection reset' });

      const result = await resolveScan({ scanValue: 'ANYTHING' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Database connection reset');
      }
    });
  });

  describe('checkUserBorrowingEligibility (via checkoutBook)', () => {
    it('blocks checkout when student profile is not ACTIVE', async () => {
      mockUserClientHelper.setTableResponse('library_cards', {
        user_id: 'student-inactive',
      });
      mockUserClientHelper.setTableResponse('profiles', {
        status: 'SUSPENDED',
        full_name: 'Suspended Student',
      });

      const result = await checkoutBook({
        studentCardQr: 'CARD-SUSPENDED',
        bookQr: 'BOOK-101',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Account is suspended. Borrowing is restricted.');
      }
      expect(mockAdminClientHelper.rpc).not.toHaveBeenCalled();
    });

    it('blocks checkout when student profile is not found', async () => {
      mockUserClientHelper.setTableResponse('library_cards', {
        user_id: 'student-missing',
      });
      mockUserClientHelper.setTableResponse('profiles', null);

      const result = await checkoutBook({
        studentCardQr: 'CARD-GHOST',
        bookQr: 'BOOK-101',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('User profile not found.');
      }
      expect(mockAdminClientHelper.rpc).not.toHaveBeenCalled();
    });

    it('blocks checkout when patron has 1 or more overdue books', async () => {
      mockUserClientHelper.setTableResponse('library_cards', {
        user_id: 'student-overdue',
      });
      mockUserClientHelper.setTableResponse('profiles', {
        status: 'ACTIVE',
        full_name: 'Overdue Patron',
      });
      mockUserClientHelper.setTableResponse(
        'borrowing_records',
        [{ id: 'rec-1' }, { id: 'rec-2' }],
        null,
        2
      );

      const result = await checkoutBook({
        studentCardQr: 'CARD-OVERDUE',
        bookQr: 'BOOK-101',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('User has 2 overdue book(s). Please return them before borrowing more.');
      }
      expect(mockAdminClientHelper.rpc).not.toHaveBeenCalled();
    });

    it('blocks checkout when checking borrowing history fails with database error', async () => {
      mockUserClientHelper.setTableResponse('library_cards', {
        user_id: 'student-db-err',
      });
      mockUserClientHelper.setTableResponse('profiles', {
        status: 'ACTIVE',
        full_name: 'Good Patron',
      });
      mockUserClientHelper.setTableResponse('borrowing_records', null, { message: 'Query timeout' });

      const result = await checkoutBook({
        studentCardQr: 'CARD-OK',
        bookQr: 'BOOK-101',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Failed to verify borrowing history.');
      }
    });
  });

  describe('checkoutBook', () => {
    it('validates required inputs using Zod schema', async () => {
      const result = await checkoutBook({
        studentCardQr: '',
        bookQr: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Validation failed');
        expect(result.validationErrors?.studentCardQr).toBeDefined();
        expect(result.validationErrors?.bookQr).toBeDefined();
      }
    });

    it('successfully processes checkout, dispatches notification and logs audit trail', async () => {
      // 1. Patron is eligible
      mockUserClientHelper.setTableResponse('library_cards', {
        user_id: 'student-uuid-valid',
      });
      mockUserClientHelper.setTableResponse('profiles', {
        status: 'ACTIVE',
        full_name: 'Alice Johnson',
      });
      mockUserClientHelper.setTableResponse('borrowing_records', [], null, 0);

      // 2. RPC succeeds
      mockAdminClientHelper.setRpcResponse(
        {
          ok: true,
          borrowing_id: 'borrow-uuid-1',
          book_title: 'The Pragmatic Programmer',
          student_name: 'Alice Johnson',
          due_date: '2026-10-25T12:00:00.000Z',
        },
        null,
        'process_qr_checkout'
      );

      const result = await checkoutBook({
        studentCardQr: 'CARD-12345',
        bookQr: 'BOOK-QR-001',
        idempotencyKey: 'idem-key-1',
        previewOnly: false,
      });

      expect(result.success).toBe(true);
      expect(mockAdminClientHelper.rpc).toHaveBeenCalledWith('process_qr_checkout', {
        p_librarian_id: 'staff-1',
        p_card_qr: 'CARD-12345',
        p_book_qr: 'BOOK-QR-001',
        p_idempotency_key: 'idem-key-1',
        p_preview_only: false,
      });

      // Notification sent to student
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'student-uuid-valid',
          title: 'Book Borrowed',
          type: 'CIRCULATION',
          metadata: expect.objectContaining({
            borrowingId: 'borrow-uuid-1',
            bookTitle: 'The Pragmatic Programmer',
          }),
        })
      );

      // Audit log created
      expect(logAuditActivity).toHaveBeenCalledWith(
        'staff-1',
        'borrowing_record',
        'borrow-uuid-1',
        'checkout',
        expect.stringContaining("Checked out book 'The Pragmatic Programmer' to Alice Johnson"),
        expect.objectContaining({ bookQr: 'BOOK-QR-001', studentCardQr: 'CARD-12345' }),
        null,
        expect.objectContaining({ status: 'ACTIVE', book_qr: 'BOOK-QR-001' })
      );

      // Cache revalidated
      expect(revalidatePath).toHaveBeenCalledWith('/circulation', 'page');
      expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
      expect(revalidateTag).toHaveBeenCalledWith('public-books', 'max');
    });

    it('handles RPC failure with specific error code (e.g. LIMIT_EXCEEDED)', async () => {
      mockUserClientHelper.setTableResponse('library_cards', { user_id: 'student-limit' });
      mockUserClientHelper.setTableResponse('profiles', { status: 'ACTIVE', full_name: 'Alice' });
      mockUserClientHelper.setTableResponse('borrowing_records', [], null, 0);

      mockAdminClientHelper.setRpcResponse(
        {
          ok: false,
          code: 'LIMIT_EXCEEDED',
          message: 'Student has reached maximum active borrowing limit (5 books).',
        },
        null,
        'process_qr_checkout'
      );

      const result = await checkoutBook({
        studentCardQr: 'CARD-LIMIT',
        bookQr: 'BOOK-QR-002',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Student has reached maximum active borrowing limit (5 books).');
      }
      expect(sendNotification).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('handles manual scan error message mapping when book copy is not found', async () => {
      mockUserClientHelper.setTableResponse('library_cards', { user_id: 'student-manual' });
      mockUserClientHelper.setTableResponse('profiles', { status: 'ACTIVE', full_name: 'Alice' });
      mockUserClientHelper.setTableResponse('borrowing_records', [], null, 0);

      mockAdminClientHelper.setRpcResponse(
        {
          ok: false,
          code: 'COPY_NOT_FOUND',
          message: 'Book copy not found for QR.',
        },
        null,
        'process_qr_checkout'
      );

      const result = await checkoutBook({
        studentCardQr: 'CARD-VALID',
        bookQr: 'NONEXISTENT-BOOK',
        isManual: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('The identifier is not recognized by the circulation system.');
      }
    });

    it('handles idempotency replay cleanly without sending duplicate notifications', async () => {
      mockUserClientHelper.setTableResponse('library_cards', { user_id: 'student-replay' });
      mockUserClientHelper.setTableResponse('profiles', { status: 'ACTIVE', full_name: 'Bob' });
      mockUserClientHelper.setTableResponse('borrowing_records', [], null, 0);

      mockAdminClientHelper.setRpcResponse(
        {
          ok: true,
          idempotent: true,
          borrowing_id: 'existing-borrow-id',
          book_title: 'Refactoring',
          student_name: 'Bob',
          due_date: '2026-10-30T00:00:00.000Z',
        },
        null,
        'process_qr_checkout'
      );

      const result = await checkoutBook({
        studentCardQr: 'CARD-REPLAY',
        bookQr: 'BOOK-REPLAY',
        idempotencyKey: 'replay-key-123',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(
          expect.objectContaining({
            ok: true,
            idempotent: true,
            borrowing_id: 'existing-borrow-id',
          })
        );
      }
    });

    it('previewOnly mode skips eligibility check, notification and audit logging', async () => {
      mockAdminClientHelper.setRpcResponse(
        {
          ok: true,
          book_title: 'Design Patterns',
          student_name: 'Charlie',
        },
        null,
        'process_qr_checkout'
      );

      const result = await checkoutBook({
        studentCardQr: 'CARD-PREVIEW',
        bookQr: 'BOOK-PREVIEW',
        previewOnly: true,
      });

      expect(result.success).toBe(true);
      // Pre-validation skipped
      expect(mockUserClientHelper.from).not.toHaveBeenCalledWith('library_cards');
      // No notification sent, no cache revalidation, and manual circulation audit log is skipped
      expect(sendNotification).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(logAuditActivity).not.toHaveBeenCalledWith(
        expect.anything(),
        'borrowing_record',
        expect.anything(),
        'checkout',
        expect.stringContaining('Checked out book'),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('returnBook', () => {
    it('validates required bookQr input', async () => {
      const result = await returnBook({ bookQr: '' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Validation failed');
        expect(result.validationErrors?.bookQr).toBeDefined();
      }
    });

    it('successfully returns book, notifies student borrower and logs audit trail', async () => {
      // 1. Borrower resolution for notification
      mockUserClientHelper.setTableResponse('book_copies', { id: 'copy-id-100' });
      mockUserClientHelper.setTableResponse('borrowing_records', { user_id: 'borrower-student-id' });

      // 2. RPC response
      mockAdminClientHelper.setRpcResponse(
        {
          ok: true,
          book_title: 'Clean Code',
          student_name: 'Emily Davis',
          reservation_ready: false,
        },
        null,
        'process_qr_return'
      );

      const result = await returnBook({
        bookQr: 'BOOK-QR-RETURN-1',
        previewOnly: false,
      });

      expect(result.success).toBe(true);
      expect(mockAdminClientHelper.rpc).toHaveBeenCalledWith('process_qr_return', {
        p_librarian_id: 'staff-1',
        p_book_qr: 'BOOK-QR-RETURN-1',
        p_idempotency_key: null,
        p_preview_only: false,
      });

      // Notifies borrower
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'borrower-student-id',
          title: 'Book Returned',
          type: 'CIRCULATION',
        })
      );

      // Audit logged
      expect(logAuditActivity).toHaveBeenCalledWith(
        'staff-1',
        'book_copy',
        null,
        'return',
        expect.stringContaining("Returned book 'Clean Code' from Emily Davis"),
        expect.anything(),
        { status: 'BORROWED' },
        { status: 'RETURNED' }
      );

      // Cache revalidated
      expect(revalidatePath).toHaveBeenCalledWith('/circulation', 'page');
      expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
    });

    it('handles reservation hold promotion with hold metadata in audit log', async () => {
      mockUserClientHelper.setTableResponse('book_copies', { id: 'copy-id-200' });
      mockUserClientHelper.setTableResponse('borrowing_records', { user_id: 'prev-borrower' });

      mockAdminClientHelper.setRpcResponse(
        {
          ok: true,
          book_title: 'Operating Systems',
          student_name: 'Frank Miller',
          reservation_ready: true,
          reserved_for: 'Grace Hopper',
        },
        null,
        'process_qr_return'
      );

      const result = await returnBook({ bookQr: 'BOOK-OS-1' });

      expect(result.success).toBe(true);
      expect(logAuditActivity).toHaveBeenCalledWith(
        'staff-1',
        'book_copy',
        null,
        'return',
        expect.stringContaining('— reserved for Grace Hopper'),
        expect.objectContaining({ reservationReady: true }),
        { status: 'BORROWED' },
        { status: 'RETURNED' }
      );
    });

    it('handles NOT_BORROWED error when book is already on shelf', async () => {
      mockUserClientHelper.setTableResponse('book_copies', { id: 'copy-avail' });
      mockUserClientHelper.setTableResponse('borrowing_records', null);

      mockAdminClientHelper.setRpcResponse(
        {
          ok: false,
          code: 'NOT_BORROWED',
          message: 'This book copy is already Available.',
        },
        null,
        'process_qr_return'
      );

      const result = await returnBook({ bookQr: 'BOOK-ALREADY-RETURNED' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('This book copy is already Available.');
      }
      expect(sendNotification).not.toHaveBeenCalled();
    });

    it('tests orphaned borrow recovery where RPC succeeds but no active borrow record exists', async () => {
      // Copy exists, but borrowing_records returns null (orphaned borrow)
      mockUserClientHelper.setTableResponse('book_copies', { id: 'copy-orphaned' });
      mockUserClientHelper.setTableResponse('borrowing_records', null);

      mockAdminClientHelper.setRpcResponse(
        {
          ok: true,
          book_title: 'Orphaned Title',
          student_name: 'Unknown Patron',
          reservation_ready: false,
        },
        null,
        'process_qr_return'
      );

      const result = await returnBook({ bookQr: 'BOOK-ORPHANED' });

      expect(result.success).toBe(true);
      // Returned successfully without crashing and without sending notification to null user
      expect(sendNotification).not.toHaveBeenCalled();
      expect(logAuditActivity).toHaveBeenCalled();
    });

    it('handles previewOnly mode without borrower lookup or notifications', async () => {
      mockAdminClientHelper.setRpcResponse(
        {
          ok: true,
          book_title: 'Preview Book',
          student_name: 'Student Preview',
        },
        null,
        'process_qr_return'
      );

      const result = await returnBook({
        bookQr: 'BOOK-PREVIEW-RETURN',
        previewOnly: true,
      });

      expect(result.success).toBe(true);
      expect(mockUserClientHelper.from).not.toHaveBeenCalledWith('book_copies');
      expect(sendNotification).not.toHaveBeenCalled();
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(logAuditActivity).not.toHaveBeenCalledWith(
        expect.anything(),
        'book_copy',
        null,
        'return',
        expect.stringContaining('Returned book'),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );
    });
  });
});
