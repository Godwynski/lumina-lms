import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUsers, inviteUser } from '../users';
import { getMe } from '@/lib/auth-helpers';
import { logAuditActivity } from '@/lib/audit';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';
import type { ProfileData, UserRole } from '@/lib/types';

vi.mock('@/lib/auth-helpers', () => ({
  getMe: vi.fn(),
  normalizeUserRole: (value: unknown): UserRole | null => {
    if (typeof value !== 'string') return null;
    const role = value.trim().toLowerCase();
    if (role === 'super_admin' || role === 'librarian' || role === 'student_assistant' || role === 'student') {
      return role as UserRole;
    }
    return null;
  },
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

describe('Users Server Actions - Adversarial & Boundary Tests', () => {
  let mockClientHelper: MockSupabaseClientHelper;

  type MeSession = NonNullable<Awaited<ReturnType<typeof getMe>>>;

  const mockUserSession = (role: UserRole = 'super_admin', id = 'admin-user-id'): MeSession => ({
    user: {
      id,
      email: `${role}@school.edu`,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id,
      email: `${role}@school.edu`,
      role,
      status: 'ACTIVE',
      full_name: `${role} User`,
      permissions: {},
    } as unknown as ProfileData & {
      id: string;
      email: string | null;
      role: string;
      status: string;
      permissions: unknown;
    },
    role,
    isStaff: ['super_admin', 'librarian', 'student_assistant'].includes(role),
    isAdmin: role === 'super_admin',
    isDeactivatedSA: false,
    hasPermission: () => true,
    supabase: mockClientHelper.client,
  } as unknown as MeSession);

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientHelper = createMockSupabaseClient();
  });

  describe('getUsers', () => {
    it('rejects unauthenticated callers with Unauthorized error', async () => {
      vi.mocked(getMe).mockResolvedValue(null);

      await expect(getUsers()).rejects.toThrow('Unauthorized');
    });

    it('rejects student role with Forbidden error', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('student'));

      await expect(getUsers()).rejects.toThrow('Forbidden');
    });

    it('rejects student_assistant role with Forbidden error', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('student_assistant'));

      await expect(getUsers()).rejects.toThrow('Forbidden');
    });

    it('enforces librarian restriction by filtering out super_admins', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('librarian'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.setResolveValue([{ id: 'p1', full_name: 'Student One', role: 'student' }], null, 1);

      const result = await getUsers();

      expect(tableBuilder.neq).toHaveBeenCalledWith('role', 'super_admin');
      expect(result.users).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('allows super_admin to view all users without excluding super_admins', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('super_admin'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.setResolveValue([{ id: 'p1', full_name: 'Super Admin', role: 'super_admin' }], null, 1);

      const result = await getUsers();

      const neqCalls = tableBuilder.neq.mock.calls;
      const filteredOutSuperAdmin = neqCalls.some(([col, val]) => col === 'role' && val === 'super_admin');
      expect(filteredOutSuperAdmin).toBe(false);
      expect(result.users).toHaveLength(1);
    });

    it('filters correctly for "review" tab (status: PENDING)', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('super_admin'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.setResolveValue([], null, 0);

      await getUsers({ tab: 'review' });

      expect(tableBuilder.eq).toHaveBeenCalledWith('status', 'PENDING');
    });

    it('filters correctly for "archived" tab (status: ARCHIVED)', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('super_admin'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.setResolveValue([], null, 0);

      await getUsers({ tab: 'archived' });

      expect(tableBuilder.eq).toHaveBeenCalledWith('status', 'ARCHIVED');
    });

    it('filters correctly for specific role tab (e.g. librarian)', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('super_admin'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.setResolveValue([], null, 0);

      await getUsers({ tab: 'librarian' });

      expect(tableBuilder.eq).toHaveBeenCalledWith('role', 'librarian');
      expect(tableBuilder.neq).toHaveBeenCalledWith('status', 'ARCHIVED');
    });

    it('sanitizes malicious search input against PostgREST injection', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('super_admin'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.setResolveValue([], null, 0);

      const maliciousSearch = "john,status.eq.ACTIVE,id.neq.'bad'";
      await getUsers({ search: maliciousSearch });

      expect(tableBuilder.or).toBeDefined();
      expect(tableBuilder.or).toHaveBeenCalled();
      const orArg = tableBuilder.or!.mock.calls[0][0];
      // PostgREST special chars (commas, quotes, dots in injection) must be sanitized
      expect(orArg).not.toContain(',status.eq.ACTIVE');
      expect(orArg).toContain('full_name.ilike.');
      expect(orArg).toContain('email.ilike.');
    });

    it('applies pagination correctly', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('super_admin'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.setResolveValue([], null, 50);

      await getUsers({ page: 3, pageSize: 10 });

      // from = (3 - 1) * 10 = 20, to = 20 + 10 - 1 = 29
      expect(tableBuilder.range).toHaveBeenCalledWith(20, 29);
    });

    it('throws error when database query encounters an error', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('super_admin'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.setResolveValue(null, new Error('Database connection failed'));

      await expect(getUsers()).rejects.toThrow('Database connection failed');
    });
  });

  describe('inviteUser', () => {
    it('fails schema validation on empty or invalid email', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('super_admin'));

      const invalidEmails = ['', 'notanemail', 'test@', '@domain.com', 'user @domain.com'];

      for (const email of invalidEmails) {
        const result = await inviteUser({ email, role: 'student' });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toBe('Validation failed');
          expect(result.validationErrors?.email).toBeDefined();
        }
      }
    });

    it('rejects unauthenticated caller', async () => {
      vi.mocked(getMe).mockResolvedValue(null);

      const result = await inviteUser({ email: 'valid@school.edu', role: 'student' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Authentication required');
    });

    it('rejects student role caller from inviting users', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('student'));

      const result = await inviteUser({ email: 'valid@school.edu', role: 'student' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized access');
    });

    it('rejects student_assistant caller from inviting users', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('student_assistant'));

      const result = await inviteUser({ email: 'valid@school.edu', role: 'student' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unauthorized access');
    });

    it('prevents librarian from assigning roles other than student', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('librarian'));

      const disallowedRoles = ['librarian', 'super_admin', 'student_assistant'];

      for (const role of disallowedRoles) {
        const result = await inviteUser({ email: 'user@school.edu', role });
        expect(result.success).toBe(false);
        expect(result.error).toBe('Librarians are not allowed to assign roles');
      }
    });

    it('allows librarian to invite user with student role', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('librarian'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'u-1', email: 'user@school.edu', role: 'student', status: 'PENDING', department: 'Arts' },
        error: null,
      });
      tableBuilder.single.mockResolvedValueOnce({
        data: { id: 'u-1', email: 'user@school.edu', role: 'student', status: 'PENDING', department: 'General' },
        error: null,
      });

      const result = await inviteUser({ email: 'user@school.edu', role: 'student' });
      expect(result.success).toBe(true);
      expect(result.data?.user.role).toBe('student');
    });

    it('prevents librarian from modifying or demoting an existing super_admin account', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('librarian'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'sa-target', email: 'boss@school.edu', role: 'super_admin', status: 'ACTIVE', department: 'Leadership' },
        error: null,
      });

      const result = await inviteUser({ email: 'boss@school.edu', role: 'student' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Only super administrators can modify a super administrator account');
      expect(tableBuilder.update).not.toHaveBeenCalled();
    });

    it('prevents librarian from modifying existing staff accounts', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('librarian'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'colleague-id', email: 'colleague@school.edu', role: 'librarian', status: 'ACTIVE', department: 'Library' },
        error: null,
      });

      const result = await inviteUser({ email: 'colleague@school.edu', role: 'student' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Librarians cannot modify accounts with staff or admin roles');
      expect(tableBuilder.update).not.toHaveBeenCalled();
    });

    it('fails when target user account does not exist in profiles', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('super_admin'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      const result = await inviteUser({ email: 'nonexistent@school.edu', role: 'librarian' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('No account found for that email. They must sign in first.');
    });

    it('allows super_admin to upgrade user to super_admin', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('super_admin'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'u-target', email: 'target@school.edu', role: 'student', status: 'ACTIVE', department: 'Science' },
        error: null,
      });
      tableBuilder.single.mockResolvedValueOnce({
        data: { id: 'u-target', email: 'target@school.edu', role: 'super_admin', status: 'PENDING', department: 'AdminDept' },
        error: null,
      });

      const result = await inviteUser({
        email: 'TARGET@SCHOOL.EDU ',
        role: 'super_admin',
        department: 'AdminDept',
      });

      expect(result.success).toBe(true);
      expect(result.data?.user.role).toBe('super_admin');
      expect(tableBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'super_admin',
          status: 'PENDING',
          department: 'AdminDept',
        })
      );
      expect(logAuditActivity).toHaveBeenCalledWith(
        'admin-user-id',
        'profile',
        'u-target',
        'role_updated',
        expect.stringContaining('Invited/Upgraded user target@school.edu to super_admin'),
        null,
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('allows super_admin to invite user with librarian role', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('super_admin'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'u-lib', email: 'lib@school.edu', role: 'student', status: 'ACTIVE', department: 'Library' },
        error: null,
      });
      tableBuilder.single.mockResolvedValueOnce({
        data: { id: 'u-lib', email: 'lib@school.edu', role: 'librarian', status: 'PENDING', department: 'Library' },
        error: null,
      });

      const result = await inviteUser({ email: 'lib@school.edu', role: 'librarian' });
      expect(result.success).toBe(true);
      expect(result.data?.user.role).toBe('librarian');
    });

    it('defaults invalid role to student and sets status to PENDING', async () => {
      vi.mocked(getMe).mockResolvedValue(mockUserSession('super_admin'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'u-def', email: 'def@school.edu', role: 'student', status: 'ACTIVE', department: 'General' },
        error: null,
      });
      tableBuilder.single.mockResolvedValueOnce({
        data: { id: 'u-def', email: 'def@school.edu', role: 'student', status: 'PENDING', department: 'General' },
        error: null,
      });

      const result = await inviteUser({ email: 'def@school.edu', role: 'unknown_role_xyz' });
      expect(result.success).toBe(true);
      expect(tableBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'student',
          status: 'PENDING',
        })
      );
    });
  });
});
