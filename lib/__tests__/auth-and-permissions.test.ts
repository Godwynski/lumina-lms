import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createMockSupabaseClient } from '@/test/mocks/supabase';

const mockCreateClient = vi.fn();
const mockCreateServerClient = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

import { hasPermission, isStaff, isAccessBlocked, ROLE_RANKS, type NavItem } from '@/lib/auth/permissions';
import { normalizeUserRole, getMe, getPreferences, getUserRole, assertRole } from '@/lib/auth-helpers';
import { isDemoModeEnabled, findDemoAccount, DEMO_ACCOUNTS } from '@/lib/demo/config';
import { DEMO_ACCOUNTS as DIRECT_DEMO_ACCOUNTS } from '@/lib/demo/accounts';
import { proxy, config as proxyConfig } from '@/proxy';

describe('lib/auth/permissions', () => {
  it('defines monotonically increasing ROLE_RANKS', () => {
    expect(ROLE_RANKS).toEqual({
      student: 1,
      student_assistant: 2,
      librarian: 3,
      super_admin: 4,
    });
  });

  describe('hasPermission', () => {
    const baseItem: NavItem = { href: '/x', label: 'X' };

    it('denies null roles when exactRoles is not matched', () => {
      expect(hasPermission(null, { ...baseItem, minRole: 'student' })).toBe(false);
      expect(hasPermission(null, baseItem)).toBe(false);
    });

    it('enforces excludeRoles before exactRoles or minRole', () => {
      expect(
        hasPermission('student', {
          ...baseItem,
          minRole: 'student',
          excludeRoles: ['student'],
        })
      ).toBe(false);

      expect(
        hasPermission('super_admin', {
          ...baseItem,
          exactRoles: ['super_admin'],
          excludeRoles: ['super_admin'],
        })
      ).toBe(false);
    });

    it('enforces exactRoles and optional minRole fallback', () => {
      expect(hasPermission('librarian', { ...baseItem, exactRoles: ['librarian'] })).toBe(true);
      expect(hasPermission('super_admin', { ...baseItem, exactRoles: ['librarian'] })).toBe(false);
      expect(
        hasPermission('super_admin', { ...baseItem, exactRoles: ['librarian'], minRole: 'librarian' })
      ).toBe(true);
    });

    it('checks minRole ranks accurately', () => {
      expect(hasPermission('student', { ...baseItem, minRole: 'student' })).toBe(true);
      expect(hasPermission('student', { ...baseItem, minRole: 'student_assistant' })).toBe(false);
      expect(hasPermission('librarian', { ...baseItem, minRole: 'student_assistant' })).toBe(true);
      expect(hasPermission('super_admin', { ...baseItem, minRole: 'super_admin' })).toBe(true);
    });

    it('requires permissionKey for student_assistant while bypassing for librarian and super_admin', () => {
      const circItem: NavItem = {
        ...baseItem,
        minRole: 'student_assistant',
        permissionKey: 'manage_circulation',
      };

      expect(hasPermission('super_admin', circItem, null)).toBe(true);
      expect(hasPermission('librarian', circItem, null)).toBe(true);
      expect(
        hasPermission('student_assistant', circItem, {
          status: 'ACTIVE',
          permissions: { manage_circulation: true },
        })
      ).toBe(true);
      expect(
        hasPermission('student_assistant', circItem, {
          status: 'ACTIVE',
          permissions: { manage_circulation: false },
        })
      ).toBe(false);
      expect(hasPermission('student_assistant', circItem, { status: 'ACTIVE', permissions: null })).toBe(false);
    });

    it('blocks deactivated student assistants from staff routes while allowing student routes', () => {
      const inactiveSA = {
        status: 'INACTIVE',
        permissions: { manage_circulation: true, manage_attendance: true },
      };

      expect(hasPermission('student_assistant', { ...baseItem, minRole: 'student' }, inactiveSA)).toBe(true);
      expect(hasPermission('student_assistant', { ...baseItem, minRole: 'student_assistant' }, inactiveSA)).toBe(false);
      expect(
        hasPermission(
          'student_assistant',
          { ...baseItem, minRole: 'student', permissionKey: 'manage_attendance' },
          inactiveSA
        )
      ).toBe(false);
    });
  });

  describe('isStaff and isAccessBlocked', () => {
    it('identifies staff roles and active student assistants only', () => {
      expect(isStaff('super_admin')).toBe(true);
      expect(isStaff('librarian')).toBe(true);
      expect(isStaff('student_assistant', { status: 'active' })).toBe(true);
      expect(isStaff('student_assistant', { status: 'INACTIVE' })).toBe(false);
      expect(isStaff('student_assistant', null)).toBe(false);
      expect(isStaff('student', { status: 'ACTIVE' })).toBe(false);
      expect(isStaff(null)).toBe(false);
    });

    it('identifies blocked profile statuses', () => {
      expect(isAccessBlocked({ status: 'PENDING' })).toBe(true);
      expect(isAccessBlocked({ status: 'SUSPENDED' })).toBe(true);
      expect(isAccessBlocked({ status: 'INACTIVE' })).toBe(true);
      expect(isAccessBlocked({ status: 'ACTIVE' })).toBe(false);
      expect(isAccessBlocked(null)).toBe(false);
      expect(isAccessBlocked(undefined)).toBe(false);
    });
  });
});

describe('lib/auth-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeUserRole', () => {
    it('normalizes valid roles and rejects unknown or non-string values', () => {
      expect(normalizeUserRole('  SUPER_ADMIN ')).toBe('super_admin');
      expect(normalizeUserRole('Librarian')).toBe('librarian');
      expect(normalizeUserRole('student_assistant')).toBe('student_assistant');
      expect(normalizeUserRole('student')).toBe('student');
      expect(normalizeUserRole('staff')).toBeNull();
      expect(normalizeUserRole('')).toBeNull();
      expect(normalizeUserRole(null)).toBeNull();
      expect(normalizeUserRole(123)).toBeNull();
    });
  });

  describe('getMe', () => {
    it('returns null when auth.getUser returns an error or no user', async () => {
      const supaErr = createMockSupabaseClient();
      supaErr.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'refresh_token_not_found' } });
      mockCreateClient.mockResolvedValueOnce(supaErr.client);
      expect(await getMe()).toBeNull();

      const supaNoUser = createMockSupabaseClient();
      supaNoUser.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      mockCreateClient.mockResolvedValueOnce(supaNoUser.client);
      expect(await getMe()).toBeNull();
    });

    it('returns null when profile query fails or returns null', async () => {
      const supaMissing = createMockSupabaseClient();
      supaMissing.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', app_metadata: {} } }, error: null });
      supaMissing.setTableResponse('profiles', null, null);
      mockCreateClient.mockResolvedValueOnce(supaMissing.client);
      expect(await getMe()).toBeNull();

      const supaError = createMockSupabaseClient();
      supaError.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', app_metadata: {} } }, error: null });
      supaError.setTableResponse('profiles', null, { message: 'DB error' });
      mockCreateClient.mockResolvedValueOnce(supaError.client);
      expect(await getMe()).toBeNull();
    });

    it('returns null cleanly when createClient throws', async () => {
      mockCreateClient.mockRejectedValueOnce(new Error('cookie failure'));
      expect(await getMe()).toBeNull();
    });

    it.each([
      {
        role: 'student' as const,
        status: 'ACTIVE',
        permissions: { manage_circulation: true },
        expectedStaff: false,
        expectedAdmin: false,
        expectedDeactivatedSA: false,
        expectedPerm: true,
      },
      {
        role: 'student_assistant' as const,
        status: 'ACTIVE',
        permissions: { manage_circulation: true, manage_attendance: false },
        expectedStaff: true,
        expectedAdmin: false,
        expectedDeactivatedSA: false,
        expectedPerm: true,
      },
      {
        role: 'student_assistant' as const,
        status: 'INACTIVE',
        permissions: { manage_circulation: false },
        expectedStaff: true,
        expectedAdmin: false,
        expectedDeactivatedSA: true,
        expectedPerm: false,
      },
      {
        role: 'librarian' as const,
        status: 'ACTIVE',
        permissions: null,
        expectedStaff: true,
        expectedAdmin: false,
        expectedDeactivatedSA: false,
        expectedPerm: true,
      },
      {
        role: 'super_admin' as const,
        status: 'ACTIVE',
        permissions: null,
        expectedStaff: true,
        expectedAdmin: true,
        expectedDeactivatedSA: false,
        expectedPerm: true,
      },
    ])(
      'returns computed role flags and permission helper for $role ($status)',
      async ({ role, status, permissions, expectedStaff, expectedAdmin, expectedDeactivatedSA, expectedPerm }) => {
        const supa = createMockSupabaseClient();
        supa.auth.getUser.mockResolvedValue({
          data: { user: { id: `user-${role}`, email: `${role}@sti.edu.ph`, app_metadata: {} } },
          error: null,
        });
        supa.setTableResponse('profiles', {
          id: `user-${role}`,
          email: `${role}@sti.edu.ph`,
          role,
          status,
          permissions,
        });
        mockCreateClient.mockResolvedValueOnce(supa.client);

        const me = await getMe();
        expect(me).not.toBeNull();
        expect(me!.role).toBe(role);
        expect(me!.isStaff).toBe(expectedStaff);
        expect(me!.isAdmin).toBe(expectedAdmin);
        expect(me!.isDeactivatedSA).toBe(expectedDeactivatedSA);
        expect(me!.hasPermission('manage_circulation')).toBe(expectedPerm);
      }
    );

    it('falls back to user.app_metadata.role or student when profile role is invalid', async () => {
      const supaMeta = createMockSupabaseClient();
      supaMeta.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u-meta', app_metadata: { role: 'librarian' } } },
        error: null,
      });
      supaMeta.setTableResponse('profiles', { id: 'u-meta', role: 'invalid', status: 'ACTIVE', permissions: null });
      mockCreateClient.mockResolvedValueOnce(supaMeta.client);

      const meMeta = await getMe();
      expect(meMeta?.role).toBe('librarian');

      const supaFallback = createMockSupabaseClient();
      supaFallback.auth.getUser.mockResolvedValue({
        data: { user: { id: 'u-fallback', app_metadata: {} } },
        error: null,
      });
      supaFallback.setTableResponse('profiles', { id: 'u-fallback', role: null, status: 'ACTIVE', permissions: null });
      mockCreateClient.mockResolvedValueOnce(supaFallback.client);

      const meFallback = await getMe();
      expect(meFallback?.role).toBe('student');
    });
  });

  describe('getPreferences, getUserRole, assertRole', () => {
    it('getPreferences returns {} when unauthenticated or query fails, and returns stored preferences', async () => {
      const unauth = createMockSupabaseClient();
      unauth.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      mockCreateClient.mockResolvedValueOnce(unauth.client);
      expect(await getPreferences()).toEqual({});

      const errSupa = createMockSupabaseClient();
      errSupa.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', app_metadata: {} } }, error: null });
      errSupa.setTableResponse('profiles', { id: 'u1', role: 'student', status: 'ACTIVE' });
      errSupa.setTableResponse('ui_preferences', null, { message: 'prefs fail' });
      mockCreateClient.mockResolvedValueOnce(errSupa.client);
      expect(await getPreferences()).toEqual({});

      const okSupa = createMockSupabaseClient();
      okSupa.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', app_metadata: {} } }, error: null });
      okSupa.setTableResponse('profiles', { id: 'u1', role: 'student', status: 'ACTIVE' });
      okSupa.setTableResponse('ui_preferences', { preferences: { sidebarCollapsed: true } });
      mockCreateClient.mockResolvedValueOnce(okSupa.client);
      expect(await getPreferences()).toEqual({ sidebarCollapsed: true });
    });

    it('getUserRole returns current role or null', async () => {
      const supa = createMockSupabaseClient();
      supa.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', app_metadata: {} } }, error: null });
      supa.setTableResponse('profiles', { id: 'u1', role: 'super_admin', status: 'ACTIVE' });
      mockCreateClient.mockResolvedValueOnce(supa.client);
      expect(await getUserRole()).toBe('super_admin');

      const unauth = createMockSupabaseClient();
      unauth.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      mockCreateClient.mockResolvedValueOnce(unauth.client);
      expect(await getUserRole()).toBeNull();
    });

    it('assertRole throws Unauthorized, Forbidden, or returns me', async () => {
      const unauth = createMockSupabaseClient();
      unauth.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      mockCreateClient.mockResolvedValueOnce(unauth.client);
      await expect(assertRole(['librarian'])).rejects.toThrow('Unauthorized');

      const studentSupa = createMockSupabaseClient();
      studentSupa.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', app_metadata: {} } }, error: null });
      studentSupa.setTableResponse('profiles', { id: 'u1', role: 'student', status: 'ACTIVE' });
      mockCreateClient.mockResolvedValueOnce(studentSupa.client);
      await expect(assertRole(['librarian', 'super_admin'])).rejects.toThrow('Forbidden');

      const libSupa = createMockSupabaseClient();
      libSupa.auth.getUser.mockResolvedValue({ data: { user: { id: 'u2', app_metadata: {} } }, error: null });
      libSupa.setTableResponse('profiles', { id: 'u2', role: 'librarian', status: 'ACTIVE' });
      mockCreateClient.mockResolvedValueOnce(libSupa.client);
      const me = await assertRole(['librarian', 'super_admin']);
      expect(me.role).toBe('librarian');
    });
  });
});

describe('lib/demo/config and lib/demo/accounts', () => {
  it('exposes demo mode and all 4 evaluation accounts', () => {
    expect(isDemoModeEnabled()).toBe(true);
    expect(DEMO_ACCOUNTS).toBe(DIRECT_DEMO_ACCOUNTS);
    expect(DEMO_ACCOUNTS).toHaveLength(4);
    expect(DEMO_ACCOUNTS.map((a) => a.role)).toEqual([
      'super_admin',
      'librarian',
      'student_assistant',
      'student',
    ]);
  });

  it('finds demo accounts case-insensitively with whitespace trimming', () => {
    const admin = findDemoAccount('  DEMO.AQUINO@ALABANG.STI.EDU.PH ');
    expect(admin?.role).toBe('super_admin');
    expect(admin?.cardNumber).toBe('DEMO-ADM-001');

    const student = findDemoAccount('demo.bautista.20220271@alabang.sti.edu.ph');
    expect(student?.permissions).toEqual({
      manage_circulation: false,
      manage_attendance: false,
      view_admin_dashboard: false,
    });

    expect(findDemoAccount('unknown@example.com')).toBeUndefined();
  });

  it('uses school emails and complete biodata with IDs matching the email convention', () => {
    for (const account of DEMO_ACCOUNTS) {
      expect(account.email).toMatch(/@alabang\.sti\.edu\.ph$/);
      const data = account as unknown as Record<string, unknown>;
      for (const key of ['fullName', 'studentId', 'department', 'phone', 'address', 'cardNumber']) {
        expect(data[key], `${account.role}: ${key}`).toBeTruthy();
      }
      const local = account.email.split('@')[0];
      const digits = local.match(/\d{6,}/)?.[0];
      expect(data.studentId).toBe(digits ? `STU-${digits}` : `FAC-${local.toUpperCase()}`);
      expect(account.cardNumber).not.toBe(data.studentId);
    }
  });

  it('gives the student assistant the permissions required by staff navigation', () => {
    const account = DEMO_ACCOUNTS.find((a) => a.role === 'student_assistant')!;
    for (const permissionKey of ['manage_circulation', 'manage_attendance', 'view_admin_dashboard'] as const) {
      expect(
        hasPermission(
          account.role,
          { href: '/', label: 'Staff', minRole: 'student_assistant', permissionKey },
          { status: 'ACTIVE', permissions: account.permissions }
        )
      ).toBe(true);
    }
  });
});

describe('proxy.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates Supabase server client, forwards/refreshes cookies via setAll, and calls getClaims()', async () => {
    const getClaims = vi.fn().mockResolvedValue({ data: { claims: { sub: 'u1' } }, error: null });

    mockCreateServerClient.mockImplementation((_url, _key, options) => {
      // Simulate Supabase refreshing session cookies inside getClaims
      return {
        auth: {
          getClaims: async () => {
            const incoming = options.cookies.getAll();
            expect(incoming).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'sb-old', value: 'v1' })]));
            options.cookies.setAll([
              { name: 'sb-access-token', value: 'fresh-jwt', options: { httpOnly: true, path: '/' } },
            ]);
            return getClaims();
          },
        },
      };
    });

    const req = new NextRequest('https://lumina.test/dashboard', {
      headers: { cookie: 'sb-old=v1' },
    });

    const res = await proxy(req);

    expect(mockCreateServerClient).toHaveBeenCalledTimes(1);
    expect(getClaims).toHaveBeenCalledTimes(1);
    expect(req.cookies.get('sb-access-token')?.value).toBe('fresh-jwt');
    expect(res.cookies.get('sb-access-token')?.value).toBe('fresh-jwt');
  });

  it('exports a matcher excluding static and image assets', () => {
    expect(proxyConfig.matcher).toHaveLength(1);
    const regex = new RegExp(`^${proxyConfig.matcher[0]}$`);
    expect(regex.test('/dashboard')).toBe(true);
    expect(regex.test('/api/books')).toBe(true);
    expect(regex.test('/_next/static/chunk.js')).toBe(false);
    expect(regex.test('/_next/image?url=x')).toBe(false);
    expect(regex.test('/favicon.ico')).toBe(false);
    expect(regex.test('/logo.png')).toBe(false);
  });
});
