import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSafeAction } from '../action-utils';
import { getMe } from '@/lib/auth-helpers';
import { logAuditActivity } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { z, ZodError } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileData, UserRole } from '@/lib/types';

vi.mock('@/lib/auth-helpers', () => ({
  getMe: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditActivity: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('createSafeAction', () => {
  const dummySupabase = {} as SupabaseClient;

  const createMockMe = (overrides?: Partial<{
    id: string;
    role: UserRole;
    status: string;
    isDeactivatedSA: boolean;
    hasPermission: (perm: string) => boolean;
  }>) => {
    const role: UserRole = overrides?.role ?? 'librarian';
    const id = overrides?.id ?? 'user-123';
    const status = overrides?.status ?? 'ACTIVE';
    const isDeactivatedSA = overrides?.isDeactivatedSA ?? (role === 'student_assistant' && status !== 'ACTIVE');

    return {
      user: {
        id,
        email: 'test@school.edu',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
      profile: {
        id,
        email: 'test@school.edu',
        role,
        status,
        full_name: 'Test User',
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
      isDeactivatedSA,
      hasPermission: overrides?.hasPermission ?? vi.fn().mockImplementation((_perm: string) => {
        if (role === 'super_admin' || role === 'librarian') return true;
        return false;
      }),
      supabase: dummySupabase,
    } as unknown as Awaited<ReturnType<typeof getMe>>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Authentication Check', () => {
    it('returns error when user is not authenticated (getMe returns null)', async () => {
      vi.mocked(getMe).mockResolvedValue(null);

      const action = createSafeAction(null, async () => 'result');
      const response = await action({});

      expect(response).toEqual({
        success: false,
        error: 'Authentication required',
      });
    });
  });

  describe('2. Role Authorization', () => {
    it('returns error when caller role is not in allowedRoles', async () => {
      vi.mocked(getMe).mockResolvedValue(createMockMe({ role: 'student' }));

      const action = createSafeAction(
        null,
        async () => 'ok',
        { allowedRoles: ['super_admin', 'librarian'] }
      );
      const response = await action({});

      expect(response).toEqual({
        success: false,
        error: 'Unauthorized access',
      });
    });

    it('permits execution when caller role is included in allowedRoles', async () => {
      vi.mocked(getMe).mockResolvedValue(createMockMe({ role: 'librarian' }));

      const action = createSafeAction(
        null,
        async () => ({ status: 'success' }),
        { allowedRoles: ['super_admin', 'librarian'] }
      );
      const response = await action({});

      expect(response).toEqual({
        success: true,
        data: { status: 'success' },
      });
    });
  });

  describe('3. Deactivated Staff Guard', () => {
    it('blocks deactivated student assistant on staff-only actions', async () => {
      vi.mocked(getMe).mockResolvedValue(
        createMockMe({
          role: 'student_assistant',
          status: 'SUSPENDED',
          isDeactivatedSA: true,
        })
      );

      const action = createSafeAction(
        null,
        async () => 'done',
        { allowedRoles: ['super_admin', 'librarian', 'student_assistant'] }
      );
      const response = await action({});

      expect(response).toEqual({
        success: false,
        error: 'Access denied: Staff account is currently deactivated.',
      });
    });

    it('does not block deactivated student assistant when student role is also allowed', async () => {
      vi.mocked(getMe).mockResolvedValue(
        createMockMe({
          role: 'student_assistant',
          status: 'SUSPENDED',
          isDeactivatedSA: true,
        })
      );

      const action = createSafeAction(
        null,
        async () => 'allowed-for-students-too',
        { allowedRoles: ['student', 'student_assistant'] }
      );
      const response = await action({});

      expect(response).toEqual({
        success: true,
        data: 'allowed-for-students-too',
      });
    });

    it('allows active student assistant on staff-only actions', async () => {
      const mockMe = createMockMe({
        role: 'student_assistant',
        status: 'ACTIVE',
        isDeactivatedSA: false,
      });
      vi.mocked(getMe).mockResolvedValue(mockMe);

      const action = createSafeAction(
        null,
        async () => 'active-sa-success',
        { allowedRoles: ['super_admin', 'librarian', 'student_assistant'] }
      );
      const response = await action({});

      expect(response).toEqual({
        success: true,
        data: 'active-sa-success',
      });
    });
  });

  describe('4. Granular Permission Checks', () => {
    it('returns error when user lacks required permission', async () => {
      const hasPermissionMock = vi.fn().mockReturnValue(false);
      vi.mocked(getMe).mockResolvedValue(
        createMockMe({
          role: 'student_assistant',
          status: 'ACTIVE',
          hasPermission: hasPermissionMock,
        })
      );

      const action = createSafeAction(
        null,
        async () => 'ok',
        {
          allowedRoles: ['student_assistant'],
          allowedPermissions: ['manage_circulation'],
        }
      );
      const response = await action({});

      expect(response).toEqual({
        success: false,
        error: 'Access denied: Missing required permission.',
      });
      expect(hasPermissionMock).toHaveBeenCalledWith('manage_circulation');
    });

    it('allows execution when user has at least one of allowedPermissions', async () => {
      const hasPermissionMock = vi.fn().mockImplementation((perm: string) => perm === 'manage_catalog');
      vi.mocked(getMe).mockResolvedValue(
        createMockMe({
          role: 'student_assistant',
          status: 'ACTIVE',
          hasPermission: hasPermissionMock,
        })
      );

      const action = createSafeAction(
        null,
        async () => 'permission-granted',
        {
          allowedRoles: ['student_assistant'],
          allowedPermissions: ['manage_circulation', 'manage_catalog'],
        }
      );
      const response = await action({});

      expect(response).toEqual({
        success: true,
        data: 'permission-granted',
      });
    });

    it('super_admin and librarian bypass permission checks via hasPermission logic', async () => {
      // super_admin bypass
      const adminMe = createMockMe({ role: 'super_admin' });
      vi.mocked(getMe).mockResolvedValue(adminMe);

      const action = createSafeAction(
        null,
        async () => 'admin-ok',
        {
          allowedRoles: ['super_admin', 'librarian'],
          allowedPermissions: ['manage_circulation'],
        }
      );

      const adminRes = await action({});
      expect(adminRes).toEqual({ success: true, data: 'admin-ok' });
      expect(adminMe!.hasPermission).toHaveBeenCalledWith('manage_circulation');

      // librarian bypass
      const libMe = createMockMe({ role: 'librarian' });
      vi.mocked(getMe).mockResolvedValue(libMe);

      const libRes = await action({});
      expect(libRes).toEqual({ success: true, data: 'admin-ok' });
      expect(libMe!.hasPermission).toHaveBeenCalledWith('manage_circulation');
    });
  });

  describe('5. Input Validation (Zod)', () => {
    const TestSchema = z.object({
      title: z.string().min(3, 'Title must be at least 3 characters'),
      count: z.number().int().positive('Count must be positive'),
    });

    it('returns validation errors with structured field paths on invalid input', async () => {
      vi.mocked(getMe).mockResolvedValue(createMockMe());

      const action = createSafeAction(TestSchema, async (input) => input);
      const response = await action({ title: 'ab', count: -5 });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error).toBe('Validation failed');
        expect(response.validationErrors).toBeDefined();
        expect(response.validationErrors?.title).toEqual(['Title must be at least 3 characters']);
        expect(response.validationErrors?.count).toEqual(['Count must be positive']);
      }
    });

    it('passes validated input directly to handler when input is valid', async () => {
      vi.mocked(getMe).mockResolvedValue(createMockMe());

      const handlerMock = vi.fn().mockImplementation(async (input) => ({ processed: input.title }));
      const action = createSafeAction(TestSchema, handlerMock);

      const response = await action({ title: 'Clean Code', count: 2 });

      expect(response).toEqual({
        success: true,
        data: { processed: 'Clean Code' },
      });
      expect(handlerMock).toHaveBeenCalledWith(
        { title: 'Clean Code', count: 2 },
        expect.objectContaining({
          userId: 'user-123',
          supabase: dummySupabase,
          role: 'librarian',
        })
      );
    });

    it('passes raw input directly when schema is null', async () => {
      vi.mocked(getMe).mockResolvedValue(createMockMe());

      const rawInput = { arbitrary: 123, anyKey: 'value' };
      const handlerMock = vi.fn().mockResolvedValue('passed-through');
      const action = createSafeAction(null, handlerMock);

      const response = await action(rawInput);

      expect(response).toEqual({ success: true, data: 'passed-through' });
      expect(handlerMock).toHaveBeenCalledWith(rawInput, expect.anything());
    });
  });

  describe('6. Audit Logging', () => {
    it('does not log audit activity when auditAction or auditEntity is missing', async () => {
      vi.mocked(getMe).mockResolvedValue(createMockMe({ id: 'staff-99' }));

      const action = createSafeAction(null, async () => ({ id: 'item-1' }));
      await action({});

      expect(logAuditActivity).not.toHaveBeenCalled();
    });

    it('logs audit activity with metadata returned in handler tuple', async () => {
      vi.mocked(getMe).mockResolvedValue(createMockMe({ id: 'staff-99' }));

      const action = createSafeAction(
        null,
        async () => [
          { id: 'book-1' },
          {
            entityId: 'book-1',
            reason: 'Created new library catalog entry',
            details: { title: 'Dune' },
            oldValue: null,
            newValue: { title: 'Dune' },
          },
        ],
        {
          auditAction: 'create',
          auditEntity: 'book',
        }
      );

      const response = await action({});

      expect(response).toEqual({
        success: true,
        data: { id: 'book-1' },
      });

      expect(logAuditActivity).toHaveBeenCalledWith(
        'staff-99',
        'book',
        'book-1',
        'create',
        'Created new library catalog entry',
        { title: 'Dune' },
        null,
        { title: 'Dune' }
      );
    });

    it('extracts entityId from data.id when auditMeta does not specify entityId', async () => {
      vi.mocked(getMe).mockResolvedValue(createMockMe({ id: 'staff-99' }));

      const action = createSafeAction(
        null,
        async () => ({ id: 'entity-888', name: 'Science' }),
        {
          auditAction: 'update',
          auditEntity: 'category',
        }
      );

      const response = await action({});

      expect(response).toEqual({
        success: true,
        data: { id: 'entity-888', name: 'Science' },
      });

      expect(logAuditActivity).toHaveBeenCalledWith(
        'staff-99',
        'category',
        'entity-888',
        'update',
        'Action update performed on category',
        null,
        null,
        null
      );
    });

    it('falls back entityId to "system" when data does not have an id field', async () => {
      vi.mocked(getMe).mockResolvedValue(createMockMe({ id: 'staff-99' }));

      const action = createSafeAction(
        null,
        async () => 'string-result',
        {
          auditAction: 'purge',
          auditEntity: 'cache',
        }
      );

      await action({});

      expect(logAuditActivity).toHaveBeenCalledWith(
        'staff-99',
        'cache',
        'system',
        'purge',
        'Action purge performed on cache',
        null,
        null,
        null
      );
    });
  });

  describe('7. Exception Trapping and Error Mapping', () => {
    it('traps generic Error thrown inside handler and returns error message', async () => {
      vi.mocked(getMe).mockResolvedValue(createMockMe());

      const action = createSafeAction(null, async () => {
        throw new Error('Database transaction deadlocked');
      });

      const response = await action({});

      expect(response).toEqual({
        success: false,
        error: 'Database transaction deadlocked',
      });
      expect(logger.error).toHaveBeenCalledWith(
        'action-utils',
        'Server action failed',
        expect.objectContaining({ error: 'Database transaction deadlocked' })
      );
    });

    it('traps ZodError thrown dynamically inside handler as "Input validation error"', async () => {
      vi.mocked(getMe).mockResolvedValue(createMockMe());

      const action = createSafeAction(null, async () => {
        throw new ZodError([
          {
            code: 'custom',
            message: 'Manual schema check failed',
            path: ['isbn'],
          },
        ]);
      });

      const response = await action({});

      expect(response).toEqual({
        success: false,
        error: 'Input validation error',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('returns default fallback message when error message is empty', async () => {
      vi.mocked(getMe).mockResolvedValue(createMockMe());

      const action = createSafeAction(null, async () => {
        throw new Error('');
      });

      const response = await action({});

      expect(response).toEqual({
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      });
    });
  });
});
