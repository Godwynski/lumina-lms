import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabaseClient, createMockQueryBuilder } from '@/test/mocks/supabase';

const mockGetMe = vi.fn();
const mockCreateAdminClient = vi.fn();
const mockLogAuditActivity = vi.fn();
const mockSendNotification = vi.fn();
const mockRevalidatePath = vi.fn();
const mockRevalidateTag = vi.fn();

vi.mock('@/lib/auth-helpers', () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock('@/lib/audit', () => ({
  logAuditActivity: (...args: unknown[]) => mockLogAuditActivity(...args),
}));

vi.mock('@/lib/notifications', () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
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

import { resolveScan, checkoutBook, returnBook } from '@/lib/actions/circulation';

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

describe('circulation server actions', () => {
  let supaMock: ReturnType<typeof createMockSupabaseClient>;
  let adminMock: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    supaMock = createMockSupabaseClient();
    adminMock = createMockSupabaseClient();
    mockGetMe.mockResolvedValue(makeStaffContext(supaMock.client));
    mockCreateAdminClient.mockReturnValue(adminMock.client);
    mockLogAuditActivity.mockResolvedValue(undefined);
    mockSendNotification.mockResolvedValue(undefined);
  });

  describe('RBAC and validation', () => {
    it('rejects unauthenticated callers', async () => {
      mockGetMe.mockResolvedValue(null);

      const res = await resolveScan({ scanValue: 'LIB-001' });
      expect(res).toEqual({ success: false, error: 'Authentication required' });
    });

    it('rejects student role on resolveScan, checkoutBook, and returnBook', async () => {
      mockGetMe.mockResolvedValue(makeStaffContext(supaMock.client, { role: 'student' }));

      expect(await resolveScan({ scanValue: 'LIB-001' })).toEqual({
        success: false,
        error: 'Unauthorized access',
      });
      expect(await checkoutBook({ studentCardQr: 'LIB-001', bookQr: 'BK-001' })).toEqual({
        success: false,
        error: 'Unauthorized access',
      });
      expect(await returnBook({ bookQr: 'BK-001' })).toEqual({
        success: false,
        error: 'Unauthorized access',
      });
    });

    it('rejects deactivated student assistants', async () => {
      mockGetMe.mockResolvedValue(
        makeStaffContext(supaMock.client, { role: 'student_assistant', isDeactivatedSA: true })
      );

      const res = await checkoutBook({ studentCardQr: 'LIB-001', bookQr: 'BK-001' });
      expect(res).toEqual({
        success: false,
        error: 'Access denied: Staff account is currently deactivated.',
      });
    });

    it('rejects active student assistants lacking manage_circulation permission', async () => {
      mockGetMe.mockResolvedValue(
        makeStaffContext(supaMock.client, {
          role: 'student_assistant',
          isDeactivatedSA: false,
          hasCirculationPerm: false,
        })
      );

      const res = await returnBook({ bookQr: 'BK-001' });
      expect(res).toEqual({
        success: false,
        error: 'Access denied: Missing required permission.',
      });
    });

    it('validates non-empty scan inputs', async () => {
      const res = await resolveScan({ scanValue: '' });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Validation failed');
        expect(res.validationErrors?.scanValue).toBeDefined();
      }
    });
  });

  describe('resolveScan', () => {
    it('resolves an active library card and active student profile', async () => {
      supaMock.setTableResponse('library_cards', {
        card_number: 'LIB-1001',
        status: 'ACTIVE',
        user_id: 'student-1',
        profiles: {
          full_name: 'Maria Clara',
          student_id: '2024-0001',
          status: 'ACTIVE',
        },
      });

      const res = await resolveScan({ scanValue: '  LIB-1001  ', expectedType: 'auto' });

      expect(res).toEqual({
        success: true,
        data: {
          type: 'student',
          data: {
            cardNumber: 'LIB-1001',
            status: 'ACTIVE',
            userId: 'student-1',
            fullName: 'Maria Clara',
            studentId: '2024-0001',
          },
        },
      });
      expect(supaMock.getTableBuilder('library_cards').eq).toHaveBeenCalledWith('card_number', 'LIB-1001');
    });

    it('falls back to student_id lookup when card_number is not found', async () => {
      const firstCardBuilder = createMockQueryBuilder(null, null);
      const secondCardBuilder = createMockQueryBuilder({
        card_number: 'LIB-9999',
        status: 'ACTIVE',
        user_id: 'student-2',
        profiles: [
          {
            full_name: 'Jose Rizal',
            student_id: '2024-0002',
            status: 'active',
          },
        ],
      });
      const profileBuilder = createMockQueryBuilder({ id: 'student-2' });

      let cardCalls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'library_cards') {
          cardCalls += 1;
          return cardCalls === 1 ? firstCardBuilder : secondCardBuilder;
        }
        if (table === 'profiles') return profileBuilder;
        return supaMock.getTableBuilder(table);
      });

      const res = await resolveScan({ scanValue: '2024-0002', expectedType: 'student' });

      expect(res).toEqual({
        success: true,
        data: {
          type: 'student',
          data: {
            cardNumber: 'LIB-9999',
            status: 'ACTIVE',
            userId: 'student-2',
            fullName: 'Jose Rizal',
            studentId: '2024-0002',
          },
        },
      });
      expect(profileBuilder.eq).toHaveBeenCalledWith('student_id', '2024-0002');
      expect(secondCardBuilder.eq).toHaveBeenCalledWith('user_id', 'student-2');
    });

    it('rejects inactive library card and inactive student account', async () => {
      supaMock.setTableResponse('library_cards', {
        card_number: 'LIB-INACTIVE',
        status: 'SUSPENDED',
        user_id: 'student-3',
        profiles: { full_name: 'Inactive Card', student_id: '2024-0003', status: 'ACTIVE' },
      });

      expect(await resolveScan({ scanValue: 'LIB-INACTIVE' })).toEqual({
        success: false,
        error: 'Library card is not active.',
      });

      supaMock.setTableResponse('library_cards', {
        card_number: 'LIB-ACTIVE',
        status: 'ACTIVE',
        user_id: 'student-4',
        profiles: { full_name: 'Suspended Student', student_id: '2024-0004', status: 'SUSPENDED' },
      });

      expect(await resolveScan({ scanValue: 'LIB-ACTIVE' })).toEqual({
        success: false,
        error: 'Student account is suspended.',
      });
    });

    it('resolves a book copy QR and respects expectedType: book', async () => {
      supaMock.setTableResponse('book_copies', {
        id: 'copy-1',
        qr_string: 'COPY-001',
        status: 'AVAILABLE',
        book_id: 'book-1',
        books: { title: 'Clean Code' },
      });

      const res = await resolveScan({ scanValue: 'COPY-001', expectedType: 'book' });

      expect(res).toEqual({
        success: true,
        data: {
          type: 'book',
          data: {
            copyId: 'copy-1',
            qrString: 'COPY-001',
            status: 'AVAILABLE',
            bookId: 'book-1',
            bookTitle: 'Clean Code',
          },
        },
      });
      expect(supaMock.from).not.toHaveBeenCalledWith('library_cards');
    });

    it('returns distinct not-found messages for scanned QR vs manual entry', async () => {
      supaMock.setTableResponse('library_cards', null);
      supaMock.setTableResponse('profiles', null);
      supaMock.setTableResponse('book_copies', null);

      const scanRes = await resolveScan({ scanValue: 'UNKNOWN', isManual: false });
      expect(scanRes).toEqual({
        success: false,
        error: 'Scanned QR is not recognized by the circulation system.',
      });

      const manualRes = await resolveScan({ scanValue: 'UNKNOWN', isManual: true });
      expect(manualRes).toEqual({
        success: false,
        error: 'The identifier is not recognized by the circulation system.',
      });
    });
  });

  describe('checkoutBook', () => {
    it('supports previewOnly without eligibility pre-check, audit log, notification, or revalidation', async () => {
      adminMock.setRpcResponse(
        {
          ok: true,
          book_title: 'Clean Code',
          student_name: 'Maria Clara',
          due_date: '2026-12-01T00:00:00Z',
        },
        null,
        'process_qr_checkout'
      );

      const res = await checkoutBook({
        studentCardQr: ' LIB-1001 ',
        bookQr: ' COPY-001 ',
        previewOnly: true,
      });

      expect(res.success).toBe(true);
      expect(supaMock.from).not.toHaveBeenCalled();
      expect(adminMock.rpc).toHaveBeenCalledWith('process_qr_checkout', {
        p_librarian_id: 'staff-1',
        p_card_qr: 'LIB-1001',
        p_book_qr: 'COPY-001',
        p_idempotency_key: null,
        p_preview_only: true,
      });
      expect(mockLogAuditActivity).not.toHaveBeenCalled();
      expect(mockSendNotification).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
      expect(mockRevalidateTag).not.toHaveBeenCalled();
    });

    it('commits checkout, checks eligibility, logs audit, notifies student, and revalidates paths/tags', async () => {
      supaMock.setTableResponse('library_cards', { user_id: 'student-1' });
      supaMock.setTableResponse('profiles', { status: 'ACTIVE', full_name: 'Maria Clara' });
      supaMock.setTableResponse('borrowing_records', null, null, 0);

      adminMock.setRpcResponse(
        {
          ok: true,
          borrowing_id: 'borrow-1',
          book_title: 'Clean Code',
          student_name: 'Maria Clara',
          due_date: '2026-12-01T00:00:00.000Z',
        },
        null,
        'process_qr_checkout'
      );

      const res = await checkoutBook({
        studentCardQr: 'LIB-1001',
        bookQr: 'COPY-001',
        idempotencyKey: 'idem-1',
        previewOnly: false,
      });

      expect(res).toEqual({
        success: true,
        data: {
          ok: true,
          borrowing_id: 'borrow-1',
          book_title: 'Clean Code',
          student_name: 'Maria Clara',
          due_date: '2026-12-01T00:00:00.000Z',
        },
      });
      expect(adminMock.rpc).toHaveBeenCalledWith('process_qr_checkout', {
        p_librarian_id: 'staff-1',
        p_card_qr: 'LIB-1001',
        p_book_qr: 'COPY-001',
        p_idempotency_key: 'idem-1',
        p_preview_only: false,
      });
      expect(mockLogAuditActivity).toHaveBeenCalledWith(
        'staff-1',
        'borrowing_record',
        'borrow-1',
        'checkout',
        "Checked out book 'Clean Code' to Maria Clara (QR: COPY-001)",
        {
          studentCardQr: 'LIB-1001',
          bookQr: 'COPY-001',
          student_user_id: 'student-1',
          studentName: 'Maria Clara',
          bookTitle: 'Clean Code',
        },
        null,
        { status: 'ACTIVE', book_qr: 'COPY-001' }
      );
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'student-1',
          title: 'Book Borrowed',
          type: 'CIRCULATION',
          priority: 'medium',
          metadata: {
            borrowingId: 'borrow-1',
            bookTitle: 'Clean Code',
            dueDate: '2026-12-01T00:00:00.000Z',
          },
        })
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/circulation', 'page');
      expect(mockRevalidateTag).toHaveBeenCalledWith('catalog', 'max');
      expect(mockRevalidateTag).toHaveBeenCalledWith('public-books', 'max');
    });

    it('blocks checkout when student account is inactive or has overdue books', async () => {
      supaMock.setTableResponse('library_cards', { user_id: 'student-1' });
      supaMock.setTableResponse('profiles', { status: 'SUSPENDED', full_name: 'Maria Clara' });

      const inactiveRes = await checkoutBook({
        studentCardQr: 'LIB-1001',
        bookQr: 'COPY-001',
      });
      expect(inactiveRes).toEqual({
        success: false,
        error: 'Account is suspended. Borrowing is restricted.',
      });
      expect(adminMock.rpc).not.toHaveBeenCalled();

      supaMock.setTableResponse('profiles', { status: 'ACTIVE', full_name: 'Maria Clara' });
      supaMock.setTableResponse('borrowing_records', null, null, 2);

      const overdueRes = await checkoutBook({
        studentCardQr: 'LIB-1001',
        bookQr: 'COPY-001',
      });
      expect(overdueRes).toEqual({
        success: false,
        error: 'User has 2 overdue book(s). Please return them before borrowing more.',
      });
      expect(adminMock.rpc).not.toHaveBeenCalled();
    });

    it('propagates RPC error and maps manual not-found RPC failure', async () => {
      supaMock.setTableResponse('library_cards', null);

      adminMock.setRpcResponse(null, { message: 'RPC timeout' }, 'process_qr_checkout');
      const errRes = await checkoutBook({ studentCardQr: 'LIB-1001', bookQr: 'COPY-001' });
      expect(errRes).toEqual({ success: false, error: 'RPC timeout' });

      adminMock.setRpcResponse(
        { ok: false, code: 'NOT_FOUND', message: 'Book copy not found' },
        null,
        'process_qr_checkout'
      );
      const manualFail = await checkoutBook({
        studentCardQr: 'LIB-1001',
        bookQr: 'COPY-404',
        isManual: true,
      });
      expect(manualFail).toEqual({
        success: false,
        error: 'The identifier is not recognized by the circulation system.',
      });
    });
  });

  describe('returnBook', () => {
    it('supports previewOnly with exact 4 RPC args and no side effects', async () => {
      adminMock.setRpcResponse(
        {
          ok: true,
          borrowing_id: 'borrow-1',
          book_title: 'Clean Code',
          student_name: 'Maria Clara',
          fine_amount: 15,
          overdue_days: 3,
        },
        null,
        'process_qr_return'
      );

      const res = await returnBook({ bookQr: ' COPY-001 ', previewOnly: true });

      expect(res.success).toBe(true);
      expect(supaMock.from).not.toHaveBeenCalled();
      expect(adminMock.rpc).toHaveBeenCalledWith('process_qr_return', {
        p_librarian_id: 'staff-1',
        p_book_qr: 'COPY-001',
        p_idempotency_key: null,
        p_preview_only: true,
      });
      expect(mockLogAuditActivity).not.toHaveBeenCalled();
      expect(mockSendNotification).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('commits return with settleFine: false, handles reservation_ready, and revalidates /circulation and /history', async () => {
      supaMock.setTableResponse('book_copies', { id: 'copy-1', book_id: 'book-1' });
      supaMock.setTableResponse('borrowing_records', { user_id: 'student-1' });

      adminMock.setRpcResponse(
        {
          ok: true,
          borrowing_id: 'borrow-1',
          book_title: 'Clean Code',
          student_name: 'Maria Clara',
          reservation_ready: true,
          reserved_for: 'Juan Dela Cruz',
          fine_amount: 10,
          overdue_days: 2,
        },
        null,
        'process_qr_return'
      );

      const res = await returnBook({
        bookQr: 'COPY-001',
        idempotencyKey: 'ret-1',
        settleFine: false,
      });

      expect(res.success).toBe(true);
      expect(adminMock.rpc).toHaveBeenCalledWith('process_qr_return', {
        p_librarian_id: 'staff-1',
        p_book_qr: 'COPY-001',
        p_idempotency_key: 'ret-1',
        p_preview_only: false,
      });
      expect(adminMock.from).not.toHaveBeenCalledWith('borrowing_records');
      expect(mockLogAuditActivity).toHaveBeenCalledWith(
        'staff-1',
        'book_copy',
        'copy-1',
        'return',
        "Returned book 'Clean Code' from Maria Clara (QR: COPY-001) — reserved for Juan Dela Cruz",
        {
          bookQr: 'COPY-001',
          book_id: 'book-1',
          book_copy_id: 'copy-1',
          student_user_id: 'student-1',
          studentName: 'Maria Clara',
          bookTitle: 'Clean Code',
          reservationReady: true,
          fineAmount: 10,
          fineSettled: false,
        },
        { status: 'BORROWED' },
        { status: 'RETURNED' }
      );
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'student-1',
          title: 'Book Returned',
          type: 'CIRCULATION',
        })
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/circulation', 'page');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/history');
      expect(mockRevalidateTag).toHaveBeenCalledWith('catalog', 'max');
      expect(mockRevalidateTag).toHaveBeenCalledWith('public-books', 'max');
    });

    it('updates fine_settled_at and audit trail when settleFine: true and fine_amount > 0', async () => {
      supaMock.setTableResponse('book_copies', { id: 'copy-1', book_id: 'book-2' });
      supaMock.setTableResponse('borrowing_records', { user_id: 'student-1' });
      adminMock.setTableResponse('borrowing_records', null, null);

      adminMock.setRpcResponse(
        {
          ok: true,
          borrowing_id: 'borrow-2',
          book_title: 'Design Patterns',
          student_name: 'Maria Clara',
          reservation_ready: false,
          fine_amount: 25,
          overdue_days: 5,
        },
        null,
        'process_qr_return'
      );

      const res = await returnBook({ bookQr: 'COPY-002', settleFine: true });

      expect(res.success).toBe(true);
      const borrowBuilder = adminMock.getTableBuilder('borrowing_records');
      expect(adminMock.from).toHaveBeenCalledWith('borrowing_records');
      expect(borrowBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          fine_settled_at: expect.any(String),
          updated_at: expect.any(String),
        })
      );
      expect(borrowBuilder.eq).toHaveBeenCalledWith('id', 'borrow-2');
      expect(mockLogAuditActivity).toHaveBeenCalledWith(
        'staff-1',
        'book_copy',
        'copy-1',
        'return',
        "Returned book 'Design Patterns' from Maria Clara (QR: COPY-002) — settled PHP 25.00 fine",
        expect.objectContaining({
          book_id: 'book-2',
          book_copy_id: 'copy-1',
          student_user_id: 'student-1',
          fineAmount: 25,
          fineSettled: true,
        }),
        { status: 'BORROWED' },
        { status: 'RETURNED' }
      );
    });

    it('does not log audit, notify, or settle again on an idempotent replayed return', async () => {
      supaMock.setTableResponse('book_copies', { id: 'copy-2', book_id: 'book-2' });
      supaMock.setTableResponse('borrowing_records', { user_id: 'next-borrower' });
      adminMock.setRpcResponse(
        {
          ok: true,
          idempotent: true,
          borrowing_id: 'borrow-2',
          book_title: 'Design Patterns',
          student_name: 'Maria Clara',
          fine_amount: 25,
        },
        null,
        'process_qr_return'
      );

      const res = await returnBook({
        bookQr: 'COPY-002',
        idempotencyKey: '00000000-0000-4000-8000-000000000001',
        settleFine: true,
      });

      expect(res.success).toBe(true);
      expect(adminMock.from).not.toHaveBeenCalledWith('borrowing_records');
      expect(mockLogAuditActivity).not.toHaveBeenCalled();
      expect(mockSendNotification).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('fails if settling fine update errors after return RPC succeeds', async () => {
      supaMock.setTableResponse('book_copies', { id: 'copy-1' });
      supaMock.setTableResponse('borrowing_records', { user_id: 'student-1' });
      adminMock.setTableResponse('borrowing_records', null, { message: 'Update failed' });

      adminMock.setRpcResponse(
        {
          ok: true,
          borrowing_id: 'borrow-3',
          book_title: 'Refactoring',
          student_name: 'Maria Clara',
          fine_amount: 15,
        },
        null,
        'process_qr_return'
      );

      const res = await returnBook({ bookQr: 'COPY-003', settleFine: true });
      expect(res).toEqual({ success: false, error: 'Update failed' });
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it('propagates RPC error and maps manual not-found return error', async () => {
      supaMock.setTableResponse('book_copies', null);

      adminMock.setRpcResponse(null, { message: 'Return RPC crashed' }, 'process_qr_return');
      expect(await returnBook({ bookQr: 'COPY-001' })).toEqual({
        success: false,
        error: 'Return RPC crashed',
      });

      adminMock.setRpcResponse(
        { ok: false, code: 'NOT_FOUND', message: 'Copy not found' },
        null,
        'process_qr_return'
      );
      expect(await returnBook({ bookQr: 'COPY-404', isManual: true })).toEqual({
        success: false,
        error: 'The identifier is not recognized by the circulation system.',
      });
    });
  });
});
