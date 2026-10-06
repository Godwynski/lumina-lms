import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveScan, checkoutBook, returnBook } from '@/lib/actions/circulation';
import { createSafeAction } from '@/lib/actions/action-utils';
import { getMe } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAuditActivity } from '@/lib/audit';
import { sendNotification } from '@/lib/notifications';
import { revalidatePath } from 'next/cache';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';
import { ZodError } from 'zod';
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

describe('Adversarial Stress Test: Circulation & Action-Utils Security & Robustness', () => {
  let mockUserClientHelper: MockSupabaseClientHelper;
  let mockAdminClientHelper: MockSupabaseClientHelper;

  const createMockStaff = (overrides?: Partial<{
    id: string;
    role: UserRole;
    status: string;
    isDeactivatedSA: boolean;
    hasPermission: (perm: string) => boolean;
  }>) => {
    const role: UserRole = overrides?.role ?? 'librarian';
    const id = overrides?.id ?? 'staff-admin-1';
    const status = overrides?.status ?? 'ACTIVE';
    const isDeactivatedSA = overrides?.isDeactivatedSA ?? (role === 'student_assistant' && status !== 'ACTIVE');

    return {
      user: {
        id,
        email: 'staff@university.edu',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
      profile: {
        id,
        email: 'staff@university.edu',
        role,
        status,
        full_name: 'Staff Administrator',
        permissions: { manage_circulation: true },
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
      isDeactivatedSA,
      hasPermission: overrides?.hasPermission ?? vi.fn().mockReturnValue(true),
      supabase: mockUserClientHelper.client,
    } as unknown as Awaited<ReturnType<typeof getMe>>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserClientHelper = createMockSupabaseClient();
    mockAdminClientHelper = createMockSupabaseClient();

    vi.mocked(getMe).mockResolvedValue(createMockStaff());
    vi.mocked(createAdminClient).mockReturnValue(
      mockAdminClientHelper.client as unknown as ReturnType<typeof createAdminClient>
    );
    vi.mocked(sendNotification).mockResolvedValue({ success: true });
    vi.mocked(logAuditActivity).mockResolvedValue(undefined);
  });

  // =========================================================================
  // 1. DEACTIVATED STAFF & RBAC ATTACK SURFACE
  // =========================================================================
  describe('1. Adversarial Deactivated Staff & RBAC Boundary Enforcement', () => {
    const deactivatedStatuses = ['INACTIVE', 'SUSPENDED', 'PENDING', 'ARCHIVED', 'DEACTIVATED', 'DISABLED', 'REVOKED'];

    deactivatedStatuses.forEach((deactivatedStatus) => {
      it(`strictly blocks student_assistant with status "${deactivatedStatus}" from resolveScan`, async () => {
        vi.mocked(getMe).mockResolvedValue(
          createMockStaff({
            role: 'student_assistant',
            status: deactivatedStatus,
            isDeactivatedSA: true,
          })
        );

        const result = await resolveScan({ scanValue: 'VALID-CARD-001' });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Access denied: Staff account is currently deactivated.');
        }
        expect(mockUserClientHelper.from).not.toHaveBeenCalled();
      });

      it(`strictly blocks student_assistant with status "${deactivatedStatus}" from checkoutBook`, async () => {
        vi.mocked(getMe).mockResolvedValue(
          createMockStaff({
            role: 'student_assistant',
            status: deactivatedStatus,
            isDeactivatedSA: true,
          })
        );

        const result = await checkoutBook({
          studentCardQr: 'CARD-123',
          bookQr: 'BOOK-456',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Access denied: Staff account is currently deactivated.');
        }
        expect(mockAdminClientHelper.rpc).not.toHaveBeenCalled();
      });

      it(`strictly blocks student_assistant with status "${deactivatedStatus}" from returnBook`, async () => {
        vi.mocked(getMe).mockResolvedValue(
          createMockStaff({
            role: 'student_assistant',
            status: deactivatedStatus,
            isDeactivatedSA: true,
          })
        );

        const result = await returnBook({ bookQr: 'BOOK-456' });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Access denied: Staff account is currently deactivated.');
        }
        expect(mockAdminClientHelper.rpc).not.toHaveBeenCalled();
      });
    });

    it('blocks student assistant when isDeactivatedSA is true even if status string is empty or unusual', async () => {
      vi.mocked(getMe).mockResolvedValue(
        createMockStaff({
          role: 'student_assistant',
          status: '',
          isDeactivatedSA: true,
        })
      );

      const result = await checkoutBook({
        studentCardQr: 'CARD-123',
        bookQr: 'BOOK-456',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Access denied: Staff account is currently deactivated.');
      }
    });

    it('blocks student assistant when manage_circulation permission is missing', async () => {
      const hasPerm = vi.fn().mockImplementation((perm: string) => perm !== 'manage_circulation');
      vi.mocked(getMe).mockResolvedValue(
        createMockStaff({
          role: 'student_assistant',
          status: 'ACTIVE',
          isDeactivatedSA: false,
          hasPermission: hasPerm,
        })
      );

      const result = await checkoutBook({
        studentCardQr: 'CARD-123',
        bookQr: 'BOOK-456',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Access denied: Missing required permission.');
      }
      expect(mockAdminClientHelper.rpc).not.toHaveBeenCalled();
    });

    it('blocks unauthorized patron role ("student") from circulation actions', async () => {
      vi.mocked(getMe).mockResolvedValue(
        createMockStaff({
          role: 'student',
          status: 'ACTIVE',
          isDeactivatedSA: false,
        })
      );

      const result = await checkoutBook({
        studentCardQr: 'CARD-123',
        bookQr: 'BOOK-456',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized access');
      }
    });

    it('blocks unauthenticated user (null session) from circulation actions', async () => {
      vi.mocked(getMe).mockResolvedValue(null);

      const result = await returnBook({ bookQr: 'BOOK-123' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Authentication required');
      }
    });
  });

  // =========================================================================
  // 2. ADVERSARIAL SCAN STRINGS & INJECTION ATTEMPTS
  // =========================================================================
  describe('2. Malformed Scan Inputs & Injection Resilience', () => {
    it('rejects empty scan strings with Zod validation errors', async () => {
      const scanRes = await resolveScan({ scanValue: '' });
      expect(scanRes.success).toBe(false);
      if (!scanRes.success) {
        expect(scanRes.error).toBe('Validation failed');
        expect(scanRes.validationErrors?.scanValue).toBeDefined();
      }

      const checkoutRes = await checkoutBook({ studentCardQr: '', bookQr: '' });
      expect(checkoutRes.success).toBe(false);
      if (!checkoutRes.success) {
        expect(checkoutRes.error).toBe('Validation failed');
        expect(checkoutRes.validationErrors?.studentCardQr).toBeDefined();
        expect(checkoutRes.validationErrors?.bookQr).toBeDefined();
      }

      const returnRes = await returnBook({ bookQr: '' });
      expect(returnRes.success).toBe(false);
      if (!returnRes.success) {
        expect(returnRes.error).toBe('Validation failed');
        expect(returnRes.validationErrors?.bookQr).toBeDefined();
      }
    });

    it('handles whitespace-only scan value gracefully without unhandled exceptions', async () => {
      mockUserClientHelper.setTableResponse('library_cards', null);
      mockUserClientHelper.setTableResponse('profiles', null);
      mockUserClientHelper.setTableResponse('book_copies', null);

      const res = await resolveScan({ scanValue: '    ' });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Scanned QR is not recognized by the circulation system.');
      }
    });

    it('trims leading and trailing whitespace from valid scan barcodes', async () => {
      mockUserClientHelper.setTableResponse('library_cards', {
        card_number: 'CARD-TRIM-ME',
        status: 'ACTIVE',
        user_id: 'user-trim-1',
        profiles: { full_name: 'Trim Student', student_id: 'STU-TRIM', status: 'ACTIVE' },
      });

      const res = await resolveScan({ scanValue: '   CARD-TRIM-ME   \n' });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.data.cardNumber).toBe('CARD-TRIM-ME');
      }
    });

    it('safely handles adversarial SQL/PostgREST injection strings in scan queries', async () => {
      const injectionPayloads = [
        "'; DROP TABLE library_cards; --",
        "' OR '1'='1",
        "*) or (1=1",
        "eq.123;delete from users;",
        "admin'--",
        "\\\\'' OR 1=1",
      ];

      for (const payload of injectionPayloads) {
        mockUserClientHelper.setTableResponse('library_cards', null);
        mockUserClientHelper.setTableResponse('profiles', null);
        mockUserClientHelper.setTableResponse('book_copies', null);

        const res = await resolveScan({ scanValue: payload });
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.error).toBe('Scanned QR is not recognized by the circulation system.');
        }
      }
    });

    it('safely handles unicode, surrogate pairs, emojis, and control characters in scan barcode', async () => {
      const exoticPayload = '📚-QR-\u0000-\uFFFF-🚀-999';
      mockUserClientHelper.setTableResponse('library_cards', null);
      mockUserClientHelper.setTableResponse('profiles', null);
      mockUserClientHelper.setTableResponse('book_copies', {
        id: 'copy-unicode',
        qr_string: exoticPayload,
        status: 'AVAILABLE',
        book_id: 'b-unicode',
        books: { title: 'Unicode In Real World' },
      });

      const res = await resolveScan({ scanValue: exoticPayload });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.data.qrString).toBe(exoticPayload);
      }
    });

    it('safely processes extremely large barcode strings (10,000 chars) without buffer overflow', async () => {
      const hugeQr = 'BOOK-'.repeat(2000);
      mockUserClientHelper.setTableResponse('library_cards', null);
      mockUserClientHelper.setTableResponse('profiles', null);
      mockUserClientHelper.setTableResponse('book_copies', null);

      const res = await resolveScan({ scanValue: hugeQr });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Scanned QR is not recognized by the circulation system.');
      }
    });

    it('rejects invalid expectedType enum values', async () => {
      const res = await resolveScan({ scanValue: 'VALID', expectedType: 'invalid_type' as unknown as 'auto' });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toBe('Validation failed');
        expect(res.validationErrors?.expectedType).toBeDefined();
      }
    });
  });

  // =========================================================================
  // 3. OVERDUE BOOK BLOCKS & PATRON RESTRICTIONS
  // =========================================================================
  describe('3. Overdue Books & Patron Eligibility Verification', () => {
    it('blocks checkout when patron has exactly 1 overdue book', async () => {
      mockUserClientHelper.setTableResponse('library_cards', { user_id: 'user-overdue-1' });
      mockUserClientHelper.setTableResponse('profiles', { status: 'ACTIVE', full_name: 'Overdue Once' });
      mockUserClientHelper.setTableResponse('borrowing_records', [{ id: 'overdue-rec-1' }], null, 1);

      const result = await checkoutBook({
        studentCardQr: 'CARD-1',
        bookQr: 'BOOK-1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('User has 1 overdue book(s). Please return them before borrowing more.');
      }
      expect(mockAdminClientHelper.rpc).not.toHaveBeenCalled();
    });

    it('blocks checkout when patron has multiple overdue books', async () => {
      mockUserClientHelper.setTableResponse('library_cards', { user_id: 'user-overdue-multi' });
      mockUserClientHelper.setTableResponse('profiles', { status: 'ACTIVE', full_name: 'Overdue Multi' });
      mockUserClientHelper.setTableResponse(
        'borrowing_records',
        [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }],
        null,
        4
      );

      const result = await checkoutBook({
        studentCardQr: 'CARD-MULTI',
        bookQr: 'BOOK-1',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('User has 4 overdue book(s). Please return them before borrowing more.');
      }
      expect(mockAdminClientHelper.rpc).not.toHaveBeenCalled();
    });

    const restrictedProfileStatuses = ['INACTIVE', 'SUSPENDED', 'BLOCKED', 'GRADUATED', 'WITHDRAWN', 'EXPELLED'];
    restrictedProfileStatuses.forEach((status) => {
      it(`blocks checkout when patron profile status is "${status}"`, async () => {
        mockUserClientHelper.setTableResponse('library_cards', { user_id: `user-${status}` });
        mockUserClientHelper.setTableResponse('profiles', {
          status,
          full_name: `Patron ${status}`,
        });

        const result = await checkoutBook({
          studentCardQr: 'CARD-STATUS',
          bookQr: 'BOOK-STATUS',
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe(`Account is ${status.toLowerCase()}. Borrowing is restricted.`);
        }
        expect(mockAdminClientHelper.rpc).not.toHaveBeenCalled();
      });
    });

    it('blocks checkout when patron profile record is missing in database', async () => {
      mockUserClientHelper.setTableResponse('library_cards', { user_id: 'ghost-user' });
      mockUserClientHelper.setTableResponse('profiles', null);

      const result = await checkoutBook({
        studentCardQr: 'CARD-GHOST',
        bookQr: 'BOOK-GHOST',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('User profile not found.');
      }
    });

    it('blocks checkout when database error occurs during overdue check query', async () => {
      mockUserClientHelper.setTableResponse('library_cards', { user_id: 'user-db-fail' });
      mockUserClientHelper.setTableResponse('profiles', { status: 'ACTIVE', full_name: 'Test Patron' });
      mockUserClientHelper.setTableResponse('borrowing_records', null, { message: 'Connection terminated' });

      const result = await checkoutBook({
        studentCardQr: 'CARD-FAIL',
        bookQr: 'BOOK-FAIL',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Failed to verify borrowing history.');
      }
    });

    it('bypasses overdue eligibility check when previewOnly is true', async () => {
      mockAdminClientHelper.setRpcResponse(
        {
          ok: true,
          book_title: 'Preview Book Title',
          student_name: 'Preview Student',
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
      expect(mockUserClientHelper.from).not.toHaveBeenCalledWith('library_cards');
      expect(mockUserClientHelper.from).not.toHaveBeenCalledWith('profiles');
      expect(mockUserClientHelper.from).not.toHaveBeenCalledWith('borrowing_records');
      expect(mockAdminClientHelper.rpc).toHaveBeenCalledWith(
        'process_qr_checkout',
        expect.objectContaining({ p_preview_only: true })
      );
    });
  });

  // =========================================================================
  // 4. RPC FAILURE CODES & ERROR MAPPING
  // =========================================================================
  describe('4. RPC Failure Codes & Context-Aware Error Mapping', () => {
    const rpcFailureCodes = [
      { code: 'LIMIT_EXCEEDED', message: 'Maximum active checkout limit exceeded' },
      { code: 'COPY_NOT_FOUND', message: 'Book copy not found for QR' },
      { code: 'ALREADY_BORROWED', message: 'Book copy is currently on loan' },
      { code: 'RESERVATION_RESTRICTED', message: 'Book copy is reserved by another patron' },
      { code: 'ACCOUNT_BLOCKED', message: 'Student account has active disciplinary hold' },
      { code: 'NOT_BORROWED', message: 'This book copy is not marked as borrowed' },
    ];

    rpcFailureCodes.forEach(({ code, message }) => {
      it(`surfaces RPC failure code "${code}" error message accurately during checkout`, async () => {
        mockUserClientHelper.setTableResponse('library_cards', { user_id: 'user-rpc' });
        mockUserClientHelper.setTableResponse('profiles', { status: 'ACTIVE', full_name: 'Alice' });
        mockUserClientHelper.setTableResponse('borrowing_records', [], null, 0);

        mockAdminClientHelper.setRpcResponse(
          { ok: false, code, message },
          null,
          'process_qr_checkout'
        );

        const result = await checkoutBook({
          studentCardQr: 'CARD-RPC',
          bookQr: 'BOOK-RPC',
          isManual: false,
        });

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe(message);
        }
      });
    });

    it('maps "not found" messages to identifier error when isManual is true during checkout', async () => {
      mockUserClientHelper.setTableResponse('library_cards', { user_id: 'user-rpc' });
      mockUserClientHelper.setTableResponse('profiles', { status: 'ACTIVE', full_name: 'Alice' });
      mockUserClientHelper.setTableResponse('borrowing_records', [], null, 0);

      mockAdminClientHelper.setRpcResponse(
        { ok: false, code: 'COPY_NOT_FOUND', message: 'Book copy not found for QR.' },
        null,
        'process_qr_checkout'
      );

      const result = await checkoutBook({
        studentCardQr: 'CARD-RPC',
        bookQr: 'MANUAL-INPUT-123',
        isManual: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('The identifier is not recognized by the circulation system.');
      }
    });

    it('maps "not found" messages to identifier error when isManual is true during return', async () => {
      mockAdminClientHelper.setRpcResponse(
        { ok: false, code: 'COPY_NOT_FOUND', message: 'Book copy not found for QR.' },
        null,
        'process_qr_return'
      );

      const result = await returnBook({
        bookQr: 'MANUAL-RETURN-123',
        isManual: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('The identifier is not recognized by the circulation system.');
      }
    });

    it('retains original error message when isManual is true but message does not contain "not found"', async () => {
      mockAdminClientHelper.setRpcResponse(
        { ok: false, code: 'NOT_BORROWED', message: 'This book copy is already Available.' },
        null,
        'process_qr_return'
      );

      const result = await returnBook({
        bookQr: 'MANUAL-RETURN-123',
        isManual: true,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('This book copy is already Available.');
      }
    });

    it('falls back to default error message when RPC response has ok: false but empty message', async () => {
      mockUserClientHelper.setTableResponse('library_cards', { user_id: 'user-rpc' });
      mockUserClientHelper.setTableResponse('profiles', { status: 'ACTIVE', full_name: 'Alice' });
      mockUserClientHelper.setTableResponse('borrowing_records', [], null, 0);

      mockAdminClientHelper.setRpcResponse(
        { ok: false },
        null,
        'process_qr_checkout'
      );

      const result = await checkoutBook({
        studentCardQr: 'CARD-RPC',
        bookQr: 'BOOK-RPC',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Checkout failed.');
      }
    });

    it('handles Supabase RPC network/transport level error during returnBook', async () => {
      mockAdminClientHelper.setRpcResponse(
        null,
        { message: 'RPC execution failed: connection terminated' },
        'process_qr_return'
      );

      const result = await returnBook({ bookQr: 'BOOK-FAIL' });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('RPC execution failed: connection terminated');
      }
    });
  });

  // =========================================================================
  // 5. UNHANDLED EXCEPTIONS & ACTION-UTILS DEFENSIVE ENVELOPE
  // =========================================================================
  describe('5. Unhandled Exceptions & Error Boundary Resilience', () => {
    it('handles handler throwing primitive string error', async () => {
      const action = createSafeAction(null, async () => {
        throw 'Raw string exception';
      });

      const result = await action({});
      expect(result.success).toBe(false);
      expect(result.error).toBe('An unexpected error occurred. Please try again.');
    });

    it('handles handler throwing non-Error object with message property', async () => {
      const action = createSafeAction(null, async () => {
        throw { message: 'Custom object error' };
      });

      const result = await action({});
      expect(result.success).toBe(false);
      expect(result.error).toBe('Custom object error');
    });

    it('correctly handles card.profiles when returned as an array or null', async () => {
      // 1. Array profile
      mockUserClientHelper.setTableResponse('library_cards', {
        card_number: 'CARD-ARRAY',
        status: 'ACTIVE',
        user_id: 'u-array',
        profiles: [{ full_name: 'Array Patron', student_id: 'STU-ARR', status: 'ACTIVE' }],
      });

      const resArray = await resolveScan({ scanValue: 'CARD-ARRAY' });
      expect(resArray.success).toBe(true);
      if (resArray.success) {
        expect(resArray.data.data.fullName).toBe('Array Patron');
      }

      // 2. Null profile
      mockUserClientHelper.setTableResponse('library_cards', {
        card_number: 'CARD-NOPROFILE',
        status: 'ACTIVE',
        user_id: 'u-noprofile',
        profiles: null,
      });

      const resNull = await resolveScan({ scanValue: 'CARD-NOPROFILE' });
      expect(resNull.success).toBe(false);
      if (!resNull.success) {
        expect(resNull.error).toBe('Student account is inactive.');
      }
    });

    it('accepts lowercase "active" profile status in eligibility check', async () => {
      mockUserClientHelper.setTableResponse('library_cards', { user_id: 'user-lower-active' });
      mockUserClientHelper.setTableResponse('profiles', { status: 'active', full_name: 'Lowercase Active' });
      mockUserClientHelper.setTableResponse('borrowing_records', [], null, 0);

      mockAdminClientHelper.setRpcResponse(
        { ok: true, borrowing_id: 'b-low', book_title: 'Lower Book', student_name: 'Lowercase Active' },
        null,
        'process_qr_checkout'
      );

      const res = await checkoutBook({
        studentCardQr: 'CARD-LOWER',
        bookQr: 'BOOK-LOWER',
      });

      expect(res.success).toBe(true);
    });

    it('permits checkout when patron has exactly 0 overdue books', async () => {
      mockUserClientHelper.setTableResponse('library_cards', { user_id: 'user-zero-overdue' });
      mockUserClientHelper.setTableResponse('profiles', { status: 'ACTIVE', full_name: 'Clean Record' });
      mockUserClientHelper.setTableResponse('borrowing_records', [], null, 0);

      mockAdminClientHelper.setRpcResponse(
        { ok: true, borrowing_id: 'b-clean', book_title: 'Clean Book', student_name: 'Clean Record' },
        null,
        'process_qr_checkout'
      );

      const res = await checkoutBook({
        studentCardQr: 'CARD-CLEAN',
        bookQr: 'BOOK-CLEAN',
      });

      expect(res.success).toBe(true);
    });

    it('traps unexpected Error thrown in action execution and wraps in ActionResult', async () => {
      const action = createSafeAction(null, async () => {
        throw new Error('Fatal database deadlock');
      });

      const result = await action({});
      expect(result).toEqual({
        success: false,
        error: 'Fatal database deadlock',
      });
    });

    it('traps ZodError thrown dynamically during action execution and returns "Input validation error"', async () => {
      const action = createSafeAction(null, async () => {
        throw new ZodError([
          {
            code: 'custom',
            message: 'Dynamic constraint failed',
            path: ['scanValue'],
          },
        ]);
      });

      const result = await action({});
      expect(result).toEqual({
        success: false,
        error: 'Input validation error',
      });
    });

    it('handles empty Error message with fallback message', async () => {
      const action = createSafeAction(null, async () => {
        throw new Error('');
      });

      const result = await action({});
      expect(result).toEqual({
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      });
    });

    it('survives when notification service throws during checkout', async () => {
      mockUserClientHelper.setTableResponse('library_cards', { user_id: 'user-notif-fail' });
      mockUserClientHelper.setTableResponse('profiles', { status: 'ACTIVE', full_name: 'Alice' });
      mockUserClientHelper.setTableResponse('borrowing_records', [], null, 0);

      mockAdminClientHelper.setRpcResponse(
        {
          ok: true,
          borrowing_id: 'borrow-1',
          book_title: 'Dune',
          student_name: 'Alice',
          due_date: '2026-11-01',
        },
        null,
        'process_qr_checkout'
      );

      vi.mocked(sendNotification).mockRejectedValueOnce(new Error('Notification service unreachable'));

      const result = await checkoutBook({
        studentCardQr: 'CARD-NOTIF',
        bookQr: 'BOOK-NOTIF',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Notification service unreachable');
      }
    });

    it('survives when audit logger throws during checkout', async () => {
      mockUserClientHelper.setTableResponse('library_cards', { user_id: 'user-audit-fail' });
      mockUserClientHelper.setTableResponse('profiles', { status: 'ACTIVE', full_name: 'Alice' });
      mockUserClientHelper.setTableResponse('borrowing_records', [], null, 0);

      mockAdminClientHelper.setRpcResponse(
        {
          ok: true,
          borrowing_id: 'borrow-2',
          book_title: 'Dune',
          student_name: 'Alice',
          due_date: '2026-11-01',
        },
        null,
        'process_qr_checkout'
      );

      vi.mocked(logAuditActivity).mockRejectedValueOnce(new Error('Audit log storage full'));

      const result = await checkoutBook({
        studentCardQr: 'CARD-AUDIT',
        bookQr: 'BOOK-AUDIT',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Audit log storage full');
      }
    });

    it('survives when cache revalidation throws during circulation action', async () => {
      mockUserClientHelper.setTableResponse('library_cards', { user_id: 'user-cache-fail' });
      mockUserClientHelper.setTableResponse('profiles', { status: 'ACTIVE', full_name: 'Alice' });
      mockUserClientHelper.setTableResponse('borrowing_records', [], null, 0);

      mockAdminClientHelper.setRpcResponse(
        {
          ok: true,
          borrowing_id: 'borrow-3',
          book_title: 'Dune',
          student_name: 'Alice',
        },
        null,
        'process_qr_checkout'
      );

      vi.mocked(revalidatePath).mockImplementationOnce(() => {
        throw new Error('Next.js cache revalidation aborted');
      });

      const result = await checkoutBook({
        studentCardQr: 'CARD-CACHE',
        bookQr: 'BOOK-CACHE',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Next.js cache revalidation aborted');
      }
    });
  });

  // =========================================================================
  // 6. HERMETICITY INTEGRITY VERIFICATION
  // =========================================================================
  describe('6. Hermeticity Isolation Verification', () => {
    it('executes without any external network access or live Supabase instance', async () => {
      // Intentionally verify that global fetch is not touched
      const fetchSpy = vi.fn();
      globalThis.fetch = fetchSpy;

      mockUserClientHelper.setTableResponse('library_cards', {
        card_number: 'HERMETIC-CARD',
        status: 'ACTIVE',
        user_id: 'u-hermetic',
        profiles: { full_name: 'Hermetic User', student_id: 'STU-HERMETIC', status: 'ACTIVE' },
      });

      const scanResult = await resolveScan({ scanValue: 'HERMETIC-CARD' });
      expect(scanResult.success).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
