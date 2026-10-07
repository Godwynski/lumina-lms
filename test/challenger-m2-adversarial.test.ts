import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { getUsers, inviteUser } from '@/lib/actions/users';
import { GET as getCategory, PUT as putCategory, DELETE as deleteCategory } from '@/app/api/admin/categories/[id]/route';
import { GET as cronHandler } from '@/app/api/cron/route';
import { safeCompare } from '@/lib/server-utils';
import { getMe } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { runMaintenanceTasks } from '@/lib/notifications';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';
import type { ProfileData, UserRole } from '@/lib/types';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

// Mock dependencies
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

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/notifications', () => ({
  runMaintenanceTasks: vi.fn(),
}));

describe('Milestone 2 Empirical Challenger Adversarial Verification', () => {
  let mockClientHelper: MockSupabaseClientHelper;

  type MeSession = NonNullable<Awaited<ReturnType<typeof getMe>>>;

  const createMockSession = (role: UserRole = 'super_admin', id = 'caller-admin-id'): MeSession => ({
    user: {
      id,
      email: `${role}@university.edu`,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id,
      email: `${role}@university.edu`,
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

  // =========================================================================
  // SECTION 1: lib/actions/users.ts Schema, Hierarchy & Sanitization Tests
  // =========================================================================
  describe('Challenge 2: lib/actions/users.ts Security & Boundary Stress', () => {
    describe('Schema Validation & Attack Payloads in inviteUser', () => {
      it('rejects malicious/malformed emails including injection and script attacks', async () => {
        vi.mocked(getMe).mockResolvedValue(createMockSession('super_admin'));

        const adversarialEmails = [
          '',
          '   ',
          'not-an-email',
          'missing-domain@',
          '@missing-user.com',
          '<script>alert("xss")</script>@test.com',
          'user@domain..com',
          'user@domain .com',
          'user@domain,com',
          'null\0byte@test.com',
          'SELECT * FROM users@test.com',
        ];

        for (const email of adversarialEmails) {
          const result = await inviteUser({ email, role: 'student' });
          expect(result.success, `Expected email "${email}" to fail validation`).toBe(false);
          if (!result.success) {
            expect(result.error).toBe('Validation failed');
            expect(result.validationErrors?.email).toBeDefined();
          }
        }
      });

      it('normalizes uppercase and padded emails correctly', async () => {
        vi.mocked(getMe).mockResolvedValue(createMockSession('super_admin'));

        const tableBuilder = mockClientHelper.getTableBuilder('profiles');
        tableBuilder.maybeSingle.mockResolvedValueOnce({
          data: { id: 'p-1', email: 'test.student@school.edu', role: 'student', status: 'ACTIVE', department: 'CS' },
          error: null,
        });
        tableBuilder.single.mockResolvedValueOnce({
          data: { id: 'p-1', email: 'test.student@school.edu', role: 'student', status: 'PENDING', department: 'CS' },
          error: null,
        });

        const result = await inviteUser({
          email: '  TEST.STUDENT@SCHOOL.EDU  ',
          role: 'student',
          department: '  CS  ',
        });

        expect(result.success).toBe(true);
        expect(tableBuilder.eq).toHaveBeenCalledWith('email', 'test.student@school.edu');
        expect(tableBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            department: 'CS',
          })
        );
      });

      it('defaults missing department to "General"', async () => {
        vi.mocked(getMe).mockResolvedValue(createMockSession('super_admin'));

        const tableBuilder = mockClientHelper.getTableBuilder('profiles');
        tableBuilder.maybeSingle.mockResolvedValueOnce({
          data: { id: 'p-2', email: 'patron@school.edu', role: 'student', status: 'ACTIVE' },
          error: null,
        });
        tableBuilder.single.mockResolvedValueOnce({
          data: { id: 'p-2', email: 'patron@school.edu', role: 'student', status: 'PENDING', department: 'General' },
          error: null,
        });

        const result = await inviteUser({
          email: 'patron@school.edu',
          role: 'student',
        });

        expect(result.success).toBe(true);
        expect(tableBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            department: 'General',
          })
        );
      });
    });

    describe('Role Hierarchy & Privilege Escalation Defenses in inviteUser', () => {
      it('blocks unauthenticated callers immediately', async () => {
        vi.mocked(getMe).mockResolvedValue(null);

        const res = await inviteUser({ email: 'target@school.edu', role: 'student' });
        expect(res.success).toBe(false);
        expect(res.error).toBe('Authentication required');
      });

      it('blocks student and student_assistant roles from executing inviteUser', async () => {
        for (const unauthorizedRole of ['student', 'student_assistant'] as UserRole[]) {
          vi.mocked(getMe).mockResolvedValue(createMockSession(unauthorizedRole));

          const res = await inviteUser({ email: 'target@school.edu', role: 'student' });
          expect(res.success, `Role ${unauthorizedRole} should be rejected`).toBe(false);
          expect(res.error).toBe('Unauthorized access');
        }
      });

      it('blocks librarian from escalating privileges to librarian, super_admin, or student_assistant', async () => {
        vi.mocked(getMe).mockResolvedValue(createMockSession('librarian'));

        const forbiddenRolesToAssign = ['librarian', 'super_admin', 'student_assistant'];

        for (const role of forbiddenRolesToAssign) {
          const res = await inviteUser({ email: 'target@school.edu', role });
          expect(res.success, `Librarian assigning role "${role}" must be blocked`).toBe(false);
          expect(res.error).toBe('Librarians are not allowed to assign roles');
        }
      });

      it('allows librarian to invite users strictly with role "student"', async () => {
        vi.mocked(getMe).mockResolvedValue(createMockSession('librarian'));

        const tableBuilder = mockClientHelper.getTableBuilder('profiles');
        tableBuilder.maybeSingle.mockResolvedValueOnce({
          data: { id: 'target-1', email: 'student@school.edu', role: 'student', status: 'ACTIVE' },
          error: null,
        });
        tableBuilder.single.mockResolvedValueOnce({
          data: { id: 'target-1', email: 'student@school.edu', role: 'student', status: 'PENDING', department: 'General' },
          error: null,
        });

        const res = await inviteUser({ email: 'student@school.edu', role: 'student' });
        expect(res.success).toBe(true);
        expect(res.data?.user.role).toBe('student');
        expect(tableBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({
            role: 'student',
            status: 'PENDING',
          })
        );
      });

      it('explicitly triggers line 98: blocks non-super_admin from assigning super_admin if requester bypasses earlier checks', async () => {
        vi.mocked(getMe).mockResolvedValue(createMockSession('librarian'));

        const res = await inviteUser({ email: 'target@school.edu', role: 'super_admin' });
        expect(res.success).toBe(false);
        expect(res.error).toBe('Librarians are not allowed to assign roles');
      });

      it('ADVERSARIAL ATTACK MITIGATED: librarian attempting to demote a super_admin is rejected', async () => {
        vi.mocked(getMe).mockResolvedValue(createMockSession('librarian'));

        const tableBuilder = mockClientHelper.getTableBuilder('profiles');
        tableBuilder.maybeSingle.mockResolvedValueOnce({
          data: { id: 'super-admin-target-id', email: 'chief@school.edu', role: 'super_admin', status: 'ACTIVE' },
          error: null,
        });

        const res = await inviteUser({ email: 'chief@school.edu', role: 'student' });
        
        expect(res.success).toBe(false);
        expect(res.error).toBe('Only super administrators can modify a super administrator account');
        expect(tableBuilder.update).not.toHaveBeenCalled();
      });

      it('safely handles extreme payloads (e.g. 10,000 char department) without crashing', async () => {
        vi.mocked(getMe).mockResolvedValue(createMockSession('super_admin'));

        const giantDept = 'A'.repeat(10000);
        const tableBuilder = mockClientHelper.getTableBuilder('profiles');
        tableBuilder.maybeSingle.mockResolvedValueOnce({
          data: { id: 'p-giant', email: 'giant@school.edu', role: 'student', status: 'ACTIVE' },
          error: null,
        });
        tableBuilder.single.mockResolvedValueOnce({
          data: { id: 'p-giant', email: 'giant@school.edu', role: 'student', status: 'PENDING', department: giantDept },
          error: null,
        });

        const res = await inviteUser({ email: 'giant@school.edu', role: 'student', department: giantDept });
        expect(res.success).toBe(true);
        expect(tableBuilder.update).toHaveBeenCalledWith(
          expect.objectContaining({ department: giantDept })
        );
      });

      it('allows super_admin to assign super_admin, librarian, student_assistant, or student', async () => {
        const assignableRoles: UserRole[] = ['super_admin', 'librarian', 'student_assistant', 'student'];

        for (const targetRole of assignableRoles) {
          vi.mocked(getMe).mockResolvedValue(createMockSession('super_admin'));

          const tableBuilder = mockClientHelper.getTableBuilder('profiles');
          tableBuilder.maybeSingle.mockResolvedValueOnce({
            data: { id: `id-${targetRole}`, email: `user-${targetRole}@school.edu`, role: 'student', status: 'ACTIVE' },
            error: null,
          });
          tableBuilder.single.mockResolvedValueOnce({
            data: { id: `id-${targetRole}`, email: `user-${targetRole}@school.edu`, role: targetRole, status: 'PENDING', department: 'General' },
            error: null,
          });

          const res = await inviteUser({ email: `user-${targetRole}@school.edu`, role: targetRole });
          expect(res.success, `super_admin assigning "${targetRole}" should succeed`).toBe(true);
          expect(res.data?.user.role).toBe(targetRole);
        }
      });

      it('fails with clear message when email has no registered profile', async () => {
        vi.mocked(getMe).mockResolvedValue(createMockSession('super_admin'));

        const tableBuilder = mockClientHelper.getTableBuilder('profiles');
        tableBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

        const res = await inviteUser({ email: 'unregistered@school.edu', role: 'student' });
        expect(res.success).toBe(false);
        expect(res.error).toBe('No account found for that email. They must sign in first.');
      });
    });

    describe('getUsers Boundary & Query Sanitization Tests', () => {
      it('rejects unauthorized roles from calling getUsers', async () => {
        vi.mocked(getMe).mockResolvedValue(null);
        await expect(getUsers()).rejects.toThrow('Unauthorized');

        vi.mocked(getMe).mockResolvedValue(createMockSession('student'));
        await expect(getUsers()).rejects.toThrow('Forbidden');

        vi.mocked(getMe).mockResolvedValue(createMockSession('student_assistant'));
        await expect(getUsers()).rejects.toThrow('Forbidden');
      });

      it('librarian querying tab="super_admin" still enforces role !== super_admin', async () => {
        vi.mocked(getMe).mockResolvedValue(createMockSession('librarian'));

        const tableBuilder = mockClientHelper.getTableBuilder('profiles');
        tableBuilder.setResolveValue([], null, 0);

        await getUsers({ tab: 'super_admin' });

        // Must still have called neq('role', 'super_admin')
        const neqCalls = tableBuilder.neq.mock.calls;
        const hidesSuperAdmin = neqCalls.some(([col, val]) => col === 'role' && val === 'super_admin');
        expect(hidesSuperAdmin).toBe(true);
      });

      it('sanitizes aggressive PostgREST injection syntax in search parameter', async () => {
        vi.mocked(getMe).mockResolvedValue(createMockSession('super_admin'));

        const tableBuilder = mockClientHelper.getTableBuilder('profiles');
        tableBuilder.setResolveValue([], null, 0);

        const maliciousPayload = `Robert'); DROP TABLE profiles; --,role.eq.super_admin,status.eq.ARCHIVED`;
        await getUsers({ search: maliciousPayload });

        expect(tableBuilder.or).toHaveBeenCalled();
        const orCallArg = tableBuilder.or!.mock.calls[0][0];

        // Should not permit unescaped comma injections breaking the ilike clause
        expect(orCallArg).not.toContain(',role.eq.super_admin');
        expect(orCallArg).not.toContain(',status.eq.ARCHIVED');
      });

      it('handles pagination boundary cases: negative page and 0 gracefully', async () => {
        vi.mocked(getMe).mockResolvedValue(createMockSession('super_admin'));

        const tableBuilder = mockClientHelper.getTableBuilder('profiles');
        tableBuilder.setResolveValue([], null, 10);

        await getUsers({ page: -5, pageSize: 10 });
        // Math.max(1, -5) = 1 -> range(0, 9)
        expect(tableBuilder.range).toHaveBeenCalledWith(0, 9);

        await getUsers({ page: 0, pageSize: 20 });
        // Math.max(1, 0) = 1 -> range(0, 19)
        expect(tableBuilder.range).toHaveBeenCalledWith(0, 19);
      });
    });
  });

  // =========================================================================
  // SECTION 2: app/api/admin/categories/[id]/route.ts super_admin & RBAC Tests
  // =========================================================================
  describe('Challenge 3: app/api/admin/categories/[id]/route.ts super_admin Authorization', () => {
    let mockSupabase: {
      auth: { getUser: Mock };
      from: Mock;
    };

    const setupAuthAndProfile = (role: string | null, userId: string = 'test-caller-id') => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: role ? { user: { id: userId, email: `${role}@test.com` } } : { user: null },
      });

      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: role ? { id: userId, role } : null,
              error: role ? null : new Error('Profile not found'),
            }),
          }),
        }),
      };
    };

    beforeEach(() => {
      mockSupabase = {
        auth: { getUser: vi.fn() },
        from: vi.fn(),
      };
      (createClient as Mock).mockResolvedValue(mockSupabase);
    });

    it('EMPIRICAL PROOF: super_admin GET category succeeds with 200 (NOT 403 Forbidden)', async () => {
      const profileQuery = setupAuthAndProfile('super_admin');
      const categoryData = { id: 'c-100', name: 'Philosophy', slug: 'philosophy', is_active: true };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery;
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: categoryData, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/admin/categories/c-100');
      const res = await getCategory(req, { params: Promise.resolve({ id: 'c-100' }) });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('Philosophy');
      expect(body.slug).toBe('philosophy');
    });

    it('EMPIRICAL PROOF: super_admin PUT category succeeds with 200 (NOT 403 Forbidden)', async () => {
      const profileQuery = setupAuthAndProfile('super_admin');
      const existingCategory = { id: 'c-100', name: 'Philosophy', slug: 'philosophy', description: null, is_active: true };
      const updatedCategory = { id: 'c-100', name: 'Modern Philosophy', slug: 'modern-philosophy', description: 'Updated', is_active: true };

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedCategory, error: null }),
          }),
        }),
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery;
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: existingCategory, error: null }),
              }),
            }),
            update: updateMock,
          };
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/admin/categories/c-100', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Modern Philosophy', slug: 'modern-philosophy', description: 'Updated' }),
      });
      const res = await putCategory(req, { params: Promise.resolve({ id: 'c-100' }) });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.name).toBe('Modern Philosophy');
      expect(body.slug).toBe('modern-philosophy');
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Modern Philosophy',
        slug: 'modern-philosophy',
      }));
    });

    it('EMPIRICAL PROOF: super_admin DELETE category succeeds with 200 (NOT 403 Forbidden)', async () => {
      const profileQuery = setupAuthAndProfile('super_admin');
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery;
        if (table === 'categories') {
          return { update: updateMock };
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/admin/categories/c-100', { method: 'DELETE' });
      const res = await deleteCategory(req, { params: Promise.resolve({ id: 'c-100' }) });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(updateMock).toHaveBeenCalledWith({ is_active: false });
    });

    it('confirms librarian has GET and PUT access, but is 403 FORBIDDEN on DELETE', async () => {
      const profileQuery = setupAuthAndProfile('librarian');

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') return profileQuery;
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'c-1', name: 'Art' }, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: 'c-1', name: 'Fine Art' }, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      // GET should be 200
      const getRes = await getCategory(new NextRequest('http://localhost:3000/api/admin/categories/c-1'), {
        params: Promise.resolve({ id: 'c-1' }),
      });
      expect(getRes.status).toBe(200);

      // PUT should be 200
      const putRes = await putCategory(
        new NextRequest('http://localhost:3000/api/admin/categories/c-1', {
          method: 'PUT',
          body: JSON.stringify({ name: 'Fine Art' }),
        }),
        { params: Promise.resolve({ id: 'c-1' }) }
      );
      expect(putRes.status).toBe(200);

      // DELETE should be 403 Forbidden for librarian
      const delRes = await deleteCategory(
        new NextRequest('http://localhost:3000/api/admin/categories/c-1', { method: 'DELETE' }),
        { params: Promise.resolve({ id: 'c-1' }) }
      );
      expect(delRes.status).toBe(403);
    });

    it('rejects student and student_assistant across all verbs (GET, PUT, DELETE)', async () => {
      for (const nonAdminRole of ['student', 'student_assistant']) {
        const profileQuery = setupAuthAndProfile(nonAdminRole);
        mockSupabase.from.mockReturnValue(profileQuery);

        const getRes = await getCategory(new NextRequest('http://localhost:3000/api/admin/categories/c-1'), {
          params: Promise.resolve({ id: 'c-1' }),
        });
        expect(getRes.status, `GET should be 403 for ${nonAdminRole}`).toBe(403);

        const putRes = await putCategory(
          new NextRequest('http://localhost:3000/api/admin/categories/c-1', {
            method: 'PUT',
            body: JSON.stringify({ name: 'Hacked' }),
          }),
          { params: Promise.resolve({ id: 'c-1' }) }
        );
        expect(putRes.status, `PUT should be 403 for ${nonAdminRole}`).toBe(403);

        const delRes = await deleteCategory(
          new NextRequest('http://localhost:3000/api/admin/categories/c-1', { method: 'DELETE' }),
          { params: Promise.resolve({ id: 'c-1' }) }
        );
        expect(delRes.status, `DELETE should be 403 for ${nonAdminRole}`).toBe(403);
      }
    });
  });

  // =========================================================================
  // SECTION 3: Timing Attack Resilience & safeCompare in app/api/cron/route.ts
  // =========================================================================
  describe('Challenge 4: Timing-Safe Comparison & Cron Route Protection', () => {
    describe('safeCompare In-Depth Analysis', () => {
      it('executes crypto.timingSafeEqual for equal strings', () => {
        const spy = vi.spyOn(crypto, 'timingSafeEqual');
        const tokenA = 'Bearer cron-secret-key-super-safe-12345';
        const tokenB = 'Bearer cron-secret-key-super-safe-12345';

        const result = safeCompare(tokenA, tokenB);
        expect(result).toBe(true);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
      });

      it('returns false for equal length strings with single byte difference anywhere', () => {
        const base = 'Bearer cron-secret-key-super-safe-12345';
        // Differ at first char
        const diffFirst = 'Xearer cron-secret-key-super-safe-12345';
        // Differ at middle char
        const diffMid = 'Bearer cron-secret-Xey-super-safe-12345';
        // Differ at last char
        const diffLast = 'Bearer cron-secret-key-super-safe-12346';

        expect(safeCompare(base, diffFirst)).toBe(false);
        expect(safeCompare(base, diffMid)).toBe(false);
        expect(safeCompare(base, diffLast)).toBe(false);
      });

      it('prevents timing leak on different lengths by executing dummy timingSafeEqual before returning false', () => {
        const spy = vi.spyOn(crypto, 'timingSafeEqual');
        const tokenA = 'Bearer short';
        const tokenB = 'Bearer very-very-long-secret-key';

        const result = safeCompare(tokenA, tokenB);
        expect(result).toBe(false);
        // Dummy timingSafeEqual call executes to burn cycles
        expect(spy).toHaveBeenCalledWith(Buffer.from(tokenA), Buffer.from(tokenA));
        spy.mockRestore();
      });

      it('handles Unicode, emoji, and non-ASCII characters without throwing', () => {
        const unicodeSecretA = 'Bearer 🔑-secret-token-π-2026';
        const unicodeSecretB = 'Bearer 🔑-secret-token-π-2026';
        const unicodeSecretC = 'Bearer 🔒-secret-token-π-2026';

        expect(safeCompare(unicodeSecretA, unicodeSecretB)).toBe(true);
        expect(safeCompare(unicodeSecretA, unicodeSecretC)).toBe(false);
      });
    });

    describe('Cron Route Endpoint Protection', () => {
      const originalEnv = process.env;

      beforeEach(() => {
        process.env = { ...originalEnv };
      });

      afterEach(() => {
        process.env = originalEnv;
      });

      it('rejects authorization token that is a substring of CRON_SECRET', async () => {
        process.env.CRON_SECRET = 'my-long-cron-secret-123456789';

        const req = new Request('http://localhost:3000/api/cron', {
          headers: {
            authorization: 'Bearer my-long-cron-secret',
          },
        });

        const res = await cronHandler(req);
        expect(res.status).toBe(401);
        expect(runMaintenanceTasks).not.toHaveBeenCalled();
      });

      it('rejects authorization token that has CRON_SECRET as a prefix with extra characters', async () => {
        process.env.CRON_SECRET = 'my-long-cron-secret-123456789';

        const req = new Request('http://localhost:3000/api/cron', {
          headers: {
            authorization: 'Bearer my-long-cron-secret-123456789-extra',
          },
        });

        const res = await cronHandler(req);
        expect(res.status).toBe(401);
        expect(runMaintenanceTasks).not.toHaveBeenCalled();
      });

      it('accepts exact authorization token matching "Bearer <CRON_SECRET>"', async () => {
        process.env.CRON_SECRET = 'ultra-secure-cron-token-987';
        vi.mocked(runMaintenanceTasks).mockResolvedValueOnce({
          tasks: 'completed',
        } as unknown as Awaited<ReturnType<typeof runMaintenanceTasks>>);

        const req = new Request('http://localhost:3000/api/cron', {
          headers: {
            authorization: 'Bearer ultra-secure-cron-token-987',
          },
        });

        const res = await cronHandler(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(runMaintenanceTasks).toHaveBeenCalledTimes(1);
      });
    });
  });
});
