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
      patron: 1,
      library_staff: 2,
      librarian: 3,
      super_admin: 4,
    });
  });

  describe('hasPermission', () => {
    const baseItem: NavItem = { href: '/x', label: 'X' };

    it('denies null roles when exactRoles is not matched', () => {
      expect(hasPermission(null, { ...baseItem, minRole: 'patron' })).toBe(false);
      expect(hasPermission(null, baseItem)).toBe(false);
    });

    it('enforces excludeRoles before exactRoles or minRole', () => {
      expect(
        hasPermission('patron', {
          ...baseItem,
          minRole: 'patron',
          excludeRoles: ['patron'],
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
      expect(hasPermission('patron', { ...baseItem, minRole: 'patron' })).toBe(true);
      expect(hasPermission('patron', { ...baseItem, minRole: 'library_staff' })).toBe(false);
      expect(hasPermission('librarian', { ...baseItem, minRole: 'library_staff' })).toBe(true);
      expect(hasPermission('super_admin', { ...baseItem, minRole: 'super_admin' })).toBe(true);
    });

    it('requires permissionKey for library_staff while bypassing for librarian and super_admin', () => {
      const circItem: NavItem = {
        ...baseItem,
        minRole: 'library_staff',
        permissionKey: 'manage_circulation',
      };
      const invItem: NavItem = {
        ...baseItem,
        minRole: 'library_staff',
        permissionKey: 'manage_inventory',
      };

      expect(hasPermission('super_admin', circItem, null)).toBe(true);
      expect(hasPermission('librarian', circItem, null)).toBe(true);
      expect(hasPermission('super_admin', invItem, null)).toBe(true);
      expect(hasPermission('librarian', invItem, null)).toBe(true);
      expect(
        hasPermission('library_staff', invItem, {
          status: 'ACTIVE',
          permissions: { manage_circulation: true, manage_inventory: false },
        })
      ).toBe(false);
      expect(
        hasPermission('library_staff', invItem, {
          status: 'ACTIVE',
          permissions: { manage_inventory: true },
        })
      ).toBe(true);
      expect(
        hasPermission('library_staff', circItem, {
          status: 'ACTIVE',
          permissions: { manage_circulation: true },
        })
      ).toBe(true);
      expect(
        hasPermission('library_staff', circItem, {
          status: 'ACTIVE',
          permissions: { manage_circulation: false },
        })
      ).toBe(false);
      expect(hasPermission('library_staff', circItem, { status: 'ACTIVE', permissions: null })).toBe(false);
    });

    it('blocks deactivated student assistants from staff routes while allowing student routes', () => {
      const inactiveSA = {
        status: 'INACTIVE',
        permissions: { manage_circulation: true, manage_attendance: true },
      };

      expect(hasPermission('library_staff', { ...baseItem, minRole: 'patron' }, inactiveSA)).toBe(true);
      expect(hasPermission('library_staff', { ...baseItem, minRole: 'library_staff' }, inactiveSA)).toBe(false);
      expect(
        hasPermission(
          'library_staff',
          { ...baseItem, minRole: 'patron', permissionKey: 'manage_attendance' },
          inactiveSA
        )
      ).toBe(false);
    });
  });

  describe('isStaff and isAccessBlocked', () => {
    it('identifies staff roles and active student assistants only', () => {
      expect(isStaff('super_admin')).toBe(true);
      expect(isStaff('librarian')).toBe(true);
      expect(isStaff('library_staff', { status: 'active' })).toBe(true);
      expect(isStaff('library_staff', { status: 'INACTIVE' })).toBe(false);
      expect(isStaff('library_staff', null)).toBe(false);
      expect(isStaff('patron', { status: 'ACTIVE' })).toBe(false);
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
      expect(normalizeUserRole('student_assistant')).toBe('library_staff');
      expect(normalizeUserRole('library_staff')).toBe('library_staff');
      expect(normalizeUserRole('student')).toBe('patron');
      expect(normalizeUserRole('patron')).toBe('patron');
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
        role: 'patron' as const,
        status: 'ACTIVE',
        permissions: { manage_circulation: true },
        expectedStaff: false,
        expectedAdmin: false,
        expectedDeactivatedSA: false,
        expectedPerm: true,
      },
      {
        role: 'library_staff' as const,
        status: 'ACTIVE',
        permissions: { manage_circulation: true, manage_attendance: false },
        expectedStaff: true,
        expectedAdmin: false,
        expectedDeactivatedSA: false,
        expectedPerm: true,
      },
      {
        role: 'library_staff' as const,
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
      expect(meFallback?.role).toBe('patron');
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
      errSupa.setTableResponse('profiles', { id: 'u1', role: 'patron', status: 'ACTIVE' });
      errSupa.setTableResponse('ui_preferences', null, { message: 'prefs fail' });
      mockCreateClient.mockResolvedValueOnce(errSupa.client);
      expect(await getPreferences()).toEqual({});

      const okSupa = createMockSupabaseClient();
      okSupa.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', app_metadata: {} } }, error: null });
      okSupa.setTableResponse('profiles', { id: 'u1', role: 'patron', status: 'ACTIVE' });
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
      studentSupa.setTableResponse('profiles', { id: 'u1', role: 'patron', status: 'ACTIVE' });
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
      'library_staff',
      'patron',
    ]);
  });

  it('finds demo accounts case-insensitively with whitespace trimming', () => {
    const admin = findDemoAccount('  DEMO.AQUINO@ALABANG.STI.EDU.PH ');
    expect(admin?.role).toBe('super_admin');
    expect(admin?.cardNumber).toBe('DEMO-ADM-001');

    const student = findDemoAccount('demo.bautista.20220271@alabang.sti.edu.ph');
    expect(student?.label).toBe('Patron');
    expect(student?.permissions).toEqual({
      manage_circulation: false,
      manage_attendance: false,
      view_admin_dashboard: false,
      manage_inventory: false,
    });

    const assistant = findDemoAccount('demo.marasigan.20230148@alabang.sti.edu.ph');
    expect(assistant?.label).toBe('Library Staff');
    expect(assistant?.permissions.manage_inventory).toBe(false);

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
    const account = DEMO_ACCOUNTS.find((a) => a.role === 'library_staff')!;
    for (const permissionKey of ['manage_circulation', 'manage_attendance', 'view_admin_dashboard'] as const) {
      expect(
        hasPermission(
          account.role,
          { href: '/', label: 'Staff', minRole: 'library_staff', permissionKey },
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

  it('deletes cleared/expired cookies from request forwarding while propagating clearing Set-Cookie on response', async () => {
    mockCreateServerClient.mockImplementation((_url, _key, options) => ({
      auth: {
        getClaims: async () => {
          options.cookies.setAll([
            { name: 'sb-old', value: '', options: { maxAge: 0, path: '/' } },
          ]);
          return { data: null, error: { code: 'refresh_token_not_found', message: 'Invalid Refresh Token: Refresh Token Not Found' } };
        },
      },
    }));

    const req = new NextRequest('https://lumina.test/dashboard', {
      headers: { cookie: 'sb-old=stale-token' },
    });

    const res = await proxy(req);

    expect(req.cookies.get('sb-old')).toBeUndefined();
    const resCookie = res.cookies.get('sb-old');
    expect(resCookie?.value).toBe('');
    expect(resCookie?.maxAge).toBe(0);
  });

  it('resolves cleanly without throwing when getClaims() returns refresh_token_not_found or rejects', async () => {
    mockCreateServerClient.mockImplementationOnce((_url, _key, options) => ({
      auth: {
        getClaims: async () => {
          options.cookies.setAll([
            { name: 'sb-old', value: '', options: { maxAge: 0, path: '/' } },
          ]);
          return { data: null, error: { code: 'refresh_token_not_found', message: 'Invalid Refresh Token: Refresh Token Not Found' } };
        },
      },
    }));

    const req1 = new NextRequest('https://lumina.test/student-catalog', {
      headers: { cookie: 'sb-old=stale-token' },
    });
    const res1 = await proxy(req1);
    expect(res1.status).toBe(200);
    expect(res1.cookies.get('sb-old')?.maxAge).toBe(0);

    mockCreateServerClient.mockImplementationOnce((_url, _key, options) => ({
      auth: {
        getClaims: async () => {
          options.cookies.setAll([
            { name: 'sb-old', value: '', options: { maxAge: 0, path: '/' } },
          ]);
          throw new Error('Auth service unavailable');
        },
      },
    }));

    const req2 = new NextRequest('https://lumina.test/student-catalog', {
      headers: { cookie: 'sb-old=stale-token' },
    });
    const res2 = await proxy(req2);
    expect(res2.status).toBe(200);
    expect(res2.cookies.get('sb-old')?.maxAge).toBe(0);
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
