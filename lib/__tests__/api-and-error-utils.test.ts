import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z, ZodError } from 'zod';
import type { User, SupabaseClient } from '@supabase/supabase-js';

const mockGetMe = vi.fn();
const mockLogAuditActivity = vi.fn();

vi.mock('@/lib/auth-helpers', () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
}));

vi.mock('@/lib/audit', () => ({
  logAuditActivity: (...args: unknown[]) => mockLogAuditActivity(...args),
}));

import { apiSuccess, apiError, withAuthApi } from '@/lib/api-utils';
import { isAbortError } from '@/lib/error-utils';
import { safeCompare } from '@/lib/server-utils';
import { createSafeAction } from '@/lib/actions/action-utils';
import {
  DEFAULT_POLICIES,
  DEFAULT_STUDENT_FAQS,
  isValidPolicyValue,
} from '@/lib/actions/policy-constants';
import {
  UserCreateSchema,
  UserPatchSchema,
  CategoryCreateSchema,
  CategoryUpdateSchema,
  BulkNotificationSchema,
  ReservationCreateSchema,
} from '@/lib/validations/api';
import { BookSchema } from '@/lib/validations/catalog';

function makeMe(
  role: 'student' | 'student_assistant' | 'librarian' | 'super_admin',
  opts: {
    status?: string;
    permissions?: Record<string, boolean> | null;
    isDeactivatedSA?: boolean;
  } = {}
) {
  const status = opts.status ?? 'ACTIVE';
  const permissions = opts.permissions ?? null;
  const isDeactivatedSA =
    opts.isDeactivatedSA ?? (role === 'student_assistant' && status.toUpperCase() !== 'ACTIVE');

  return {
    user: { id: `uid-${role}`, email: `${role}@sti.edu.ph` } as unknown as User,
    profile: {
      id: `uid-${role}`,
      email: `${role}@sti.edu.ph`,
      full_name: 'Test User',
      role,
      status,
      student_id: 'STU-001',
      department: 'IT',
      avatar_url: null,
      address: null,
      phone: null,
      permissions,
    },
    role,
    isStaff: ['super_admin', 'librarian', 'student_assistant'].includes(role),
    isAdmin: role === 'super_admin',
    isDeactivatedSA,
    hasPermission: (p: string) => {
      if (role === 'super_admin' || role === 'librarian') return true;
      return Boolean(permissions?.[p]);
    },
    supabase: {} as SupabaseClient,
  };
}

describe('lib/api-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('apiSuccess and apiError format standardized JSON payloads and HTTP statuses', async () => {
    const okRes = apiSuccess({ count: 3 }, 201);
    expect(okRes.status).toBe(201);
    expect(await okRes.json()).toEqual({ ok: true, count: 3 });

    const errRes = apiError('Bad input', 'INVALID_INPUT', 400, { field: 'email' });
    expect(errRes.status).toBe(400);
    expect(await errRes.json()).toEqual({
      ok: false,
      message: 'Bad input',
      error: 'Bad input',
      code: 'INVALID_INPUT',
      details: { field: 'email' },
    });

    const defaultErr = apiError('Boom');
    expect(defaultErr.status).toBe(500);
    expect(await defaultErr.json()).toMatchObject({ ok: false, code: 'ERROR', error: 'Boom' });
  });

  describe('withAuthApi', () => {
    it('returns 401 when unauthenticated', async () => {
      mockGetMe.mockResolvedValueOnce(null);
      const handler = vi.fn();
      const wrapped = withAuthApi(handler);

      const res = await wrapped(new Request('https://lumina.test/api/test'));
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
      expect(handler).not.toHaveBeenCalled();
    });

    it('returns 403 when profile status is ARCHIVED', async () => {
      mockGetMe.mockResolvedValueOnce(makeMe('librarian', { status: 'archived' }));
      const wrapped = withAuthApi(vi.fn());

      const res = await wrapped(new Request('https://lumina.test/api/test'));
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ message: 'Account archived. Please contact administration.' });
    });

    it('enforces requireStaff for students and deactivated student assistants', async () => {
      const wrapped = withAuthApi(async () => apiSuccess({ ok: true }), { requireStaff: true });

      mockGetMe.mockResolvedValueOnce(makeMe('student'));
      expect((await wrapped(new Request('https://lumina.test/api/x'))).status).toBe(403);

      mockGetMe.mockResolvedValueOnce(makeMe('student_assistant', { status: 'INACTIVE' }));
      expect((await wrapped(new Request('https://lumina.test/api/x'))).status).toBe(403);

      mockGetMe.mockResolvedValueOnce(makeMe('student_assistant', { status: 'ACTIVE' }));
      expect((await wrapped(new Request('https://lumina.test/api/x'))).status).toBe(200);

      mockGetMe.mockResolvedValueOnce(makeMe('librarian'));
      expect((await wrapped(new Request('https://lumina.test/api/x'))).status).toBe(200);

      mockGetMe.mockResolvedValueOnce(makeMe('super_admin'));
      expect((await wrapped(new Request('https://lumina.test/api/x'))).status).toBe(200);
    });

    it('enforces allowedRoles including deactivated SA fallback to student only', async () => {
      const staffOnly = withAuthApi(async () => apiSuccess({ pass: true }), {
        allowedRoles: ['librarian', 'student_assistant'],
      });

      mockGetMe.mockResolvedValueOnce(makeMe('student_assistant', { status: 'SUSPENDED' }));
      expect((await staffOnly(new Request('https://lumina.test/api/x'))).status).toBe(403);

      const includesStudent = withAuthApi(async () => apiSuccess({ pass: true }), {
        allowedRoles: ['student', 'student_assistant'],
      });
      mockGetMe.mockResolvedValueOnce(makeMe('student_assistant', { status: 'SUSPENDED' }));
      expect((await includesStudent(new Request('https://lumina.test/api/x'))).status).toBe(200);

      mockGetMe.mockResolvedValueOnce(makeMe('student'));
      expect((await staffOnly(new Request('https://lumina.test/api/x'))).status).toBe(403);
    });

    it('enforces allowedPermissions for student assistants and bypasses for librarian/super_admin', async () => {
      const wrapped = withAuthApi(async () => apiSuccess({ ok: true }), {
        allowedPermissions: ['manage_circulation', 'manage_attendance'],
      });

      mockGetMe.mockResolvedValueOnce(makeMe('student_assistant', { status: 'INACTIVE', permissions: { manage_circulation: true } }));
      expect((await wrapped(new Request('https://lumina.test/api/x'))).status).toBe(403);

      mockGetMe.mockResolvedValueOnce(makeMe('student_assistant', { status: 'ACTIVE', permissions: { manage_circulation: false } }));
      const deniedRes = await wrapped(new Request('https://lumina.test/api/x'));
      expect(deniedRes.status).toBe(403);
      expect(await deniedRes.json()).toMatchObject({ code: 'PERMISSION_DENIED' });

      mockGetMe.mockResolvedValueOnce(makeMe('student_assistant', { status: 'ACTIVE', permissions: { manage_attendance: true } }));
      expect((await wrapped(new Request('https://lumina.test/api/x'))).status).toBe(200);

      mockGetMe.mockResolvedValueOnce(makeMe('librarian', { permissions: null }));
      expect((await wrapped(new Request('https://lumina.test/api/x'))).status).toBe(200);
    });

    it('passes resolved context and params to handler', async () => {
      mockGetMe.mockResolvedValueOnce(makeMe('super_admin'));
      const wrapped = withAuthApi(async (_req, ctx) => {
        const params = await ctx.params;
        return apiSuccess({ role: ctx.role, id: params.id });
      });

      const res = await wrapped(new Request('https://lumina.test/api/books/123'), {
        params: Promise.resolve({ id: '123' }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, role: 'super_admin', id: '123' });
    });

    it('returns 499 on AbortError and 500 on malformed JSON or thrown errors', async () => {
      mockGetMe.mockResolvedValueOnce(makeMe('librarian'));
      const abortWrapped = withAuthApi(async () => {
        throw new DOMException('Aborted', 'AbortError');
      });
      const abortRes = await abortWrapped(new Request('https://lumina.test/api/x'));
      expect(abortRes.status).toBe(499);

      mockGetMe.mockResolvedValueOnce(makeMe('librarian'));
      const jsonWrapped = withAuthApi(async (req) => {
        await req.json();
        return apiSuccess({});
      });
      const badJsonReq = new Request('https://lumina.test/api/x', {
        method: 'POST',
        body: '{bad-json',
        headers: { 'content-type': 'application/json' },
      });
      const badJsonRes = await jsonWrapped(badJsonReq);
      expect(badJsonRes.status).toBe(500);
      expect(await badJsonRes.json()).toMatchObject({
        ok: false,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal server error occurred',
      });

      vi.stubEnv('NODE_ENV', 'development');
      mockGetMe.mockResolvedValueOnce(makeMe('librarian'));
      const supaObjWrapped = withAuthApi(async () => {
        throw { message: 'Supabase RPC crashed' };
      });
      const devRes = await supaObjWrapped(new Request('https://lumina.test/api/x'));
      expect(devRes.status).toBe(500);
      expect(await devRes.json()).toMatchObject({ message: 'Supabase RPC crashed' });
    });
  });
});

describe('lib/error-utils', () => {
  it('detects AbortError, CanceledError, ECONNRESET, and abort message strings', () => {
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
    expect(isAbortError(new Error('Validation failed'))).toBe(false);
    expect(isAbortError({ message: 'Permission denied' })).toBe(false);

    const abortErr = new Error('The operation was canceled');
    abortErr.name = 'AbortError';
    expect(isAbortError(abortErr)).toBe(true);

    const canceledErr = new Error('Canceled');
    canceledErr.name = 'CanceledError';
    expect(isAbortError(canceledErr)).toBe(true);

    const code20 = Object.assign(new Error('dom'), { code: 20 });
    expect(isAbortError(code20)).toBe(true);

    const econnreset = Object.assign(new Error('reset'), { code: 'ECONNRESET' });
    expect(isAbortError(econnreset)).toBe(true);

    expect(isAbortError({ name: 'AbortError' })).toBe(true);
    expect(isAbortError({ message: 'FetchError: request to ... aborted' })).toBe(true);
    expect(isAbortError('ABORT_ERR occurred')).toBe(true);
  });
});

describe('lib/server-utils', () => {
  it('safeCompare compares strings in constant time and rejects mismatched or non-string inputs', () => {
    expect(safeCompare('secret-token-123', 'secret-token-123')).toBe(true);
    expect(safeCompare('', '')).toBe(true);
    expect(safeCompare('secret-token-123', 'secret-token-124')).toBe(false);
    expect(safeCompare('short', 'much-longer-string')).toBe(false);
    expect(safeCompare(null as unknown as string, 'abc')).toBe(false);
    expect(safeCompare('abc', undefined as unknown as string)).toBe(false);
  });
});

describe('lib/actions/action-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestSchema = z.object({
    title: z.string().min(2, 'Title too short'),
    nested: z.object({ count: z.number().int() }).optional(),
  });

  it('returns Authentication required when getMe() returns null', async () => {
    mockGetMe.mockResolvedValueOnce(null);
    const action = createSafeAction(TestSchema, async () => ({ id: '1' }));
    expect(await action({ title: 'Ok' })).toEqual({
      success: false,
      error: 'Authentication required',
    });
  });

  it('rejects disallowed roles, deactivated SAs on staff actions, and missing permissions', async () => {
    const action = createSafeAction(TestSchema, async () => ({ ok: true }), {
      allowedRoles: ['librarian', 'student_assistant'],
      allowedPermissions: ['manage_circulation'],
    });

    mockGetMe.mockResolvedValueOnce(makeMe('student'));
    expect(await action({ title: 'Book' })).toEqual({ success: false, error: 'Unauthorized access' });

    mockGetMe.mockResolvedValueOnce(makeMe('student_assistant', { status: 'INACTIVE', isDeactivatedSA: true }));
    expect(await action({ title: 'Book' })).toEqual({
      success: false,
      error: 'Access denied: Staff account is currently deactivated.',
    });

    mockGetMe.mockResolvedValueOnce(
      makeMe('student_assistant', { status: 'ACTIVE', permissions: { manage_circulation: false } })
    );
    expect(await action({ title: 'Book' })).toEqual({
      success: false,
      error: 'Access denied: Missing required permission.',
    });
  });

  it('allows deactivated SA when student role is also permitted', async () => {
    mockGetMe.mockResolvedValueOnce(
      makeMe('student_assistant', { status: 'INACTIVE', isDeactivatedSA: true })
    );
    const action = createSafeAction(null, async (input: { ok: boolean }) => input, {
      allowedRoles: ['student', 'student_assistant'],
    });
    expect(await action({ ok: true })).toEqual({ success: true, data: { ok: true } });
  });

  it('maps Zod validation issues into validationErrors keyed by dotted path', async () => {
    mockGetMe.mockResolvedValueOnce(makeMe('librarian'));
    const action = createSafeAction(TestSchema, async () => ({ id: '1' }));

    const result = await action({ title: 'A', nested: { count: 'not-a-number' } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Validation failed');
      expect(result.validationErrors?.title).toContain('Title too short');
      expect(result.validationErrors?.['nested.count']?.length).toBeGreaterThan(0);
    }
  });

  it('supports tuple [output, auditMeta] and triggers logAuditActivity', async () => {
    mockGetMe.mockResolvedValueOnce(makeMe('super_admin'));
    const action = createSafeAction(
      TestSchema,
      async (input) => [
        { id: 'book-99', title: input.title },
        {
          entityId: 'book-99',
          reason: 'Catalog import',
          details: { source: 'manual' },
          oldValue: null,
          newValue: { title: input.title },
        },
      ],
      { auditAction: 'create_book', auditEntity: 'book' }
    );

    const res = await action({ title: 'Clean Architecture' });
    expect(res).toEqual({ success: true, data: { id: 'book-99', title: 'Clean Architecture' } });
    expect(mockLogAuditActivity).toHaveBeenCalledWith(
      'uid-super_admin',
      'book',
      'book-99',
      'create_book',
      'Catalog import',
      { source: 'manual' },
      null,
      { title: 'Clean Architecture' }
    );
  });

  it('handles handler throwing ZodError and generic Error', async () => {
    mockGetMe.mockResolvedValueOnce(makeMe('librarian'));
    const zodThrowAction = createSafeAction(null, async () => {
      throw new ZodError([]);
    });
    expect(await zodThrowAction({})).toEqual({ success: false, error: 'Input validation error' });

    mockGetMe.mockResolvedValueOnce(makeMe('librarian'));
    const errThrowAction = createSafeAction(null, async () => {
      throw new Error('Database timeout');
    });
    expect(await errThrowAction({})).toEqual({ success: false, error: 'Database timeout' });
  });
});

describe('lib/actions/policy-constants', () => {
  it('defines all 8 core policy keys including overdue_fine_per_day and valid defaults', () => {
    const keys = Object.keys(DEFAULT_POLICIES);
    expect(keys).toEqual([
      'loan_period_days',
      'max_borrow_limit',
      'overdue_fine_per_day',
      'hold_expiry_days',
      'max_reservations_per_student',
      'student_faq_list',
      'academic_programs',
      'due_soon_reminder_days',
    ]);

    for (const [key, config] of Object.entries(DEFAULT_POLICIES)) {
      expect(isValidPolicyValue(key, config.value)).toBe(true);
    }

    expect(Array.isArray(DEFAULT_STUDENT_FAQS)).toBe(true);
    expect(DEFAULT_STUDENT_FAQS.length).toBe(4);
  });

  it('validates numeric bounds, rejects decimals/non-digits, and validates JSON keys', () => {
    expect(isValidPolicyValue('unknown_key', '10')).toBe(false);

    // overdue_fine_per_day: 0..500 integer
    expect(isValidPolicyValue('overdue_fine_per_day', '0')).toBe(true);
    expect(isValidPolicyValue('overdue_fine_per_day', '5')).toBe(true);
    expect(isValidPolicyValue('overdue_fine_per_day', '500')).toBe(true);
    expect(isValidPolicyValue('overdue_fine_per_day', '-1')).toBe(false);
    expect(isValidPolicyValue('overdue_fine_per_day', '501')).toBe(false);
    expect(isValidPolicyValue('overdue_fine_per_day', '5.5')).toBe(false);
    expect(isValidPolicyValue('overdue_fine_per_day', 'abc')).toBe(false);

    // loan_period_days: 1..90
    expect(isValidPolicyValue('loan_period_days', '0')).toBe(false);
    expect(isValidPolicyValue('loan_period_days', '1')).toBe(true);
    expect(isValidPolicyValue('loan_period_days', '90')).toBe(true);
    expect(isValidPolicyValue('loan_period_days', '91')).toBe(false);
    expect(isValidPolicyValue('loan_period_days', '1.5')).toBe(false);

    // JSON policies
    expect(isValidPolicyValue('academic_programs', '["BSCS","BSIT"]')).toBe(true);
    expect(isValidPolicyValue('academic_programs', '{bad json')).toBe(false);
    expect(isValidPolicyValue('student_faq_list', '[]')).toBe(true);
    expect(isValidPolicyValue('student_faq_list', 'not-json')).toBe(false);
  });
});

describe('lib/validations/api and lib/validations/catalog', () => {
  const validUuid = '550e8400-e29b-41d4-a716-446655440000';

  it('validates UserCreateSchema and UserPatchSchema', () => {
    expect(UserCreateSchema.safeParse({ email: '  alice@sti.edu.ph ' }).success).toBe(true);
    expect(UserCreateSchema.safeParse({ email: 'invalid-email' }).success).toBe(false);

    expect(
      UserPatchSchema.safeParse({ id: 'u1', permissions: { manage_circulation: true } }).success
    ).toBe(true);
    expect(UserPatchSchema.safeParse({ id: 'u1', permissions: ['manage_circulation'] }).success).toBe(true);
    expect(UserPatchSchema.safeParse({ id: '' }).success).toBe(false);
  });

  it('validates CategoryCreateSchema and CategoryUpdateSchema', () => {
    expect(CategoryCreateSchema.safeParse({ name: 'Science', description: null }).success).toBe(true);
    expect(CategoryCreateSchema.safeParse({ name: '' }).success).toBe(false);
    expect(CategoryUpdateSchema.safeParse({ is_active: false }).success).toBe(true);
    expect(CategoryUpdateSchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(false);
  });

  it('validates BulkNotificationSchema refinement and ReservationCreateSchema UUIDs', () => {
    expect(
      BulkNotificationSchema.safeParse({
        title: 'Notice',
        content: 'Library closes early',
      }).success
    ).toBe(false);

    expect(
      BulkNotificationSchema.safeParse({
        userIds: [],
        title: 'Notice',
        content: 'Body',
      }).success
    ).toBe(false);

    expect(
      BulkNotificationSchema.safeParse({
        target: 'students',
        title: 'Notice',
        content: 'Body',
        type: 'DUE_SOON',
        priority: 'high',
      }).success
    ).toBe(true);

    expect(
      BulkNotificationSchema.safeParse({
        userIds: [validUuid],
        title: 'Notice',
        content: 'Body',
      }).success
    ).toBe(true);

    expect(ReservationCreateSchema.safeParse({ bookId: validUuid }).success).toBe(true);
    expect(ReservationCreateSchema.safeParse({ bookId: 'not-a-uuid' }).success).toBe(false);
  });

  it('validates BookSchema ISBN, published_year, category_id, and is_active default', () => {
    const parsed = BookSchema.parse({
      title: 'Refactoring',
      author: 'Martin Fowler',
      isbn: '0-201-48567-X',
      category_id: validUuid,
      published_year: 1999,
    });
    expect(parsed.is_active).toBe(true);

    expect(
      BookSchema.safeParse({ title: '', author: 'Author' }).success
    ).toBe(false);
    expect(
      BookSchema.safeParse({ title: 'Book', author: 'Author', isbn: 'ISBN-INVALID!' }).success
    ).toBe(false);
    expect(
      BookSchema.safeParse({ title: 'Book', author: 'Author', published_year: 999 }).success
    ).toBe(false);
    expect(
      BookSchema.safeParse({ title: 'Book', author: 'Author', category_id: 'bad-uuid' }).success
    ).toBe(false);
  });
});
