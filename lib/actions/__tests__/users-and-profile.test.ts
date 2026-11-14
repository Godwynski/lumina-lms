import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabaseClient, createMockQueryBuilder, type MockSupabaseClientHelper, type MockSupabaseQueryBuilder } from '@/test/mocks/supabase';

const mockRevalidatePath = vi.fn();
const mockLogAuditActivity = vi.fn().mockResolvedValue(undefined);
const mockEnsureStaticLibraryCardAssets = vi.fn().mockResolvedValue(undefined);

let serverClientHelper: MockSupabaseClientHelper;
let adminClientHelper: MockSupabaseClientHelper;

vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => serverClientHelper.client),
  createSafeClient: vi.fn(() => serverClientHelper.client),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => adminClientHelper.client),
}));

vi.mock('@/lib/audit', () => ({
  logAuditActivity: (...args: unknown[]) => mockLogAuditActivity(...args),
}));

vi.mock('@/lib/library-card-assets.server', () => ({
  ensureStaticLibraryCardAssets: (...args: unknown[]) => mockEnsureStaticLibraryCardAssets(...args),
}));

import { getUsers, inviteUser } from '@/lib/actions/users';
import { getAcademicPrograms, submitOnboarding } from '@/lib/actions/onboarding';
import { updateAvatarUrl } from '@/lib/actions/profile';
import { createSafeAction } from '@/lib/actions/action-utils';
import { z } from 'zod';

function setAuthUser(
  helper: MockSupabaseClientHelper,
  user: { id: string; email?: string; app_metadata?: Record<string, unknown> } | null,
  profile: Record<string, unknown> | null
) {
  helper.auth.getUser.mockResolvedValue({
    data: { user },
    error: null,
  });
  if (profile) {
    helper.setTableResponse('profiles', profile, null);
  } else {
    helper.setTableResponse('profiles', null, { message: 'Profile not found' });
  }
}

function queueProfileBuilders(helper: MockSupabaseClientHelper, builders: MockSupabaseQueryBuilder[]) {
  const queue = [...builders];
  const fallback = helper.getTableBuilder('profiles');
  helper.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return queue.shift() ?? fallback;
    }
    return helper.getTableBuilder(table);
  });
}

describe('Users, Onboarding & Profile Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClientHelper = createMockSupabaseClient();
    adminClientHelper = createMockSupabaseClient();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://placeholder.supabase.co';
  });

  describe('getUsers (lib/actions/users.ts)', () => {
    it('throws Unauthorized when unauthenticated and Forbidden for student or student_assistant', async () => {
      setAuthUser(serverClientHelper, null, null);
      await expect(getUsers()).rejects.toThrow('Unauthorized');

      setAuthUser(serverClientHelper, { id: 'stu-1' }, { id: 'stu-1', role: 'student', status: 'ACTIVE' });
      await expect(getUsers()).rejects.toThrow('Forbidden');

      setAuthUser(serverClientHelper, { id: 'sa-1' }, { id: 'sa-1', role: 'student_assistant', status: 'ACTIVE' });
      await expect(getUsers()).rejects.toThrow('Forbidden');
    });

    it('returns non-archived users for super_admin without hiding super_admin accounts', async () => {
      const meBuilder = createMockQueryBuilder(
        { id: 'admin-1', role: 'super_admin', status: 'ACTIVE' },
        null
      );
      const listBuilder = createMockQueryBuilder(
        [
          {
            id: 'u1',
            full_name: 'Alice Admin',
            email: 'alice@example.com',
            role: 'super_admin',
            status: 'active',
            department: 'Library',
            created_at: '2026-01-15T00:00:00Z',
            onboarding_completed: true,
            permissions: { manage_users: true },
          },
        ],
        null,
        1
      );
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
      queueProfileBuilders(serverClientHelper, [meBuilder, listBuilder]);

      const res = await getUsers({ tab: 'all', page: 0, pageSize: 10 });

      expect(res.total).toBe(1);
      expect(res.users).toHaveLength(1);
      expect(res.users[0]).toMatchObject({
        id: 'u1',
        name: 'Alice Admin',
        role: 'super_admin',
        status: 'ACTIVE',
        permissions: { manage_users: true },
      });
      expect(listBuilder.neq).toHaveBeenCalledWith('status', 'ARCHIVED');
      expect(listBuilder.neq).not.toHaveBeenCalledWith('role', 'super_admin');
      expect(listBuilder.range).toHaveBeenCalledWith(0, 9);
    });

    it('hides super_admin accounts when called by a librarian', async () => {
      const meBuilder = createMockQueryBuilder(
        { id: 'lib-1', role: 'librarian', status: 'ACTIVE' },
        null
      );
      const listBuilder = createMockQueryBuilder([], null, 0);
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'lib-1' } }, error: null });
      queueProfileBuilders(serverClientHelper, [meBuilder, listBuilder]);

      await getUsers({ tab: 'review', search: 'john.doe@school.edu(1)', page: 2, pageSize: 5 });

      expect(listBuilder.eq).toHaveBeenCalledWith('status', 'PENDING');
      expect(listBuilder.neq).toHaveBeenCalledWith('role', 'super_admin');
      expect(listBuilder.or).toHaveBeenCalledWith(
        'full_name.ilike.%johndoe@schooledu1%,email.ilike.%johndoe@schooledu1%,student_id.ilike.%johndoe@schooledu1%,email.eq.john.doe@school.edu1'
      );
      expect(listBuilder.range).toHaveBeenCalledWith(5, 9);
    });

    it('supports archived and role-specific tabs and propagates DB errors', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
      const meB1 = createMockQueryBuilder({ id: 'admin-1', role: 'super_admin', status: 'ACTIVE' }, null);
      const archivedB = createMockQueryBuilder([], null, 0);
      queueProfileBuilders(serverClientHelper, [meB1, archivedB]);
      await getUsers({ tab: 'archived' });
      expect(archivedB.eq).toHaveBeenCalledWith('status', 'ARCHIVED');

      const meB2 = createMockQueryBuilder({ id: 'admin-1', role: 'super_admin', status: 'ACTIVE' }, null);
      const roleB = createMockQueryBuilder([], null, 0);
      queueProfileBuilders(serverClientHelper, [meB2, roleB]);
      await getUsers({ tab: 'librarian' });
      expect(roleB.eq).toHaveBeenCalledWith('role', 'librarian');
      expect(roleB.neq).toHaveBeenCalledWith('status', 'ARCHIVED');

      const meB3 = createMockQueryBuilder({ id: 'admin-1', role: 'super_admin', status: 'ACTIVE' }, null);
      const errB = createMockQueryBuilder(null, new Error('Query failed'));
      queueProfileBuilders(serverClientHelper, [meB3, errB]);
      await expect(getUsers()).rejects.toThrow('Query failed');
    });
  });

  describe('inviteUser (lib/actions/users.ts)', () => {
    it('rejects unauthenticated users, students, student_assistants, and invalid emails', async () => {
      setAuthUser(serverClientHelper, null, null);
      expect(await inviteUser({ email: 'user@example.com' })).toEqual({
        success: false,
        error: 'Authentication required',
      });

      setAuthUser(serverClientHelper, { id: 'stu-1' }, { id: 'stu-1', role: 'student', status: 'ACTIVE' });
      expect(await inviteUser({ email: 'user@example.com' })).toEqual({
        success: false,
        error: 'Unauthorized access',
      });

      setAuthUser(
        serverClientHelper,
        { id: 'sa-1' },
        { id: 'sa-1', role: 'student_assistant', status: 'INACTIVE' }
      );
      expect(await inviteUser({ email: 'user@example.com' })).toEqual({
        success: false,
        error: 'Unauthorized access',
      });

      setAuthUser(serverClientHelper, { id: 'admin-1' }, { id: 'admin-1', role: 'super_admin', status: 'ACTIVE' });
      const invalid = await inviteUser({ email: 'not-an-email' });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error).toBe('Validation failed');
        expect(invalid.validationErrors?.email).toBeDefined();
      }
    });

    it('enforces librarian role constraints (cannot assign non-student role or modify staff/super_admin accounts)', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'lib-1' } }, error: null });

      // Librarian cannot assign librarian/super_admin role
      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });
      expect(await inviteUser({ email: 'target@school.edu', role: 'librarian' })).toEqual({
        success: false,
        error: 'Librarians are not allowed to assign roles',
      });

      // Librarian cannot modify existing super_admin
      queueProfileBuilders(serverClientHelper, [
        createMockQueryBuilder({ id: 'lib-1', role: 'librarian', status: 'ACTIVE' }, null),
        createMockQueryBuilder({ id: 'sa-target', role: 'super_admin', status: 'ACTIVE' }, null),
      ]);
      expect(await inviteUser({ email: 'sa@school.edu', role: 'student' })).toEqual({
        success: false,
        error: 'Only super administrators can modify a super administrator account',
      });

      // Librarian cannot modify existing staff (librarian / student_assistant)
      queueProfileBuilders(serverClientHelper, [
        createMockQueryBuilder({ id: 'lib-1', role: 'librarian', status: 'ACTIVE' }, null),
        createMockQueryBuilder({ id: 'staff-target', role: 'student_assistant', status: 'ACTIVE' }, null),
      ]);
      expect(await inviteUser({ email: 'sa2@school.edu' })).toEqual({
        success: false,
        error: 'Librarians cannot modify accounts with staff or admin roles',
      });
      errSpy.mockRestore();
    });

    it('allows librarian to update a student account department/status', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'lib-1' } }, error: null });
      const meB = createMockQueryBuilder({ id: 'lib-1', role: 'librarian', status: 'ACTIVE' }, null);
      const targetB = createMockQueryBuilder(
        { id: 'stu-2', email: 'stu2@school.edu', role: 'student', status: 'ACTIVE', department: 'General' },
        null
      );
      const updateB = createMockQueryBuilder(
        { id: 'stu-2', email: 'stu2@school.edu', role: 'student', status: 'PENDING', department: 'IT' },
        null
      );
      queueProfileBuilders(serverClientHelper, [meB, targetB, updateB]);

      const res = await inviteUser({ email: 'STU2@SCHOOL.EDU', role: 'student', department: 'IT' });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.user).toMatchObject({ id: 'stu-2', role: 'student', status: 'PENDING', department: 'IT' });
      }
      expect(updateB.update).toHaveBeenCalledWith({
        role: 'student',
        status: 'PENDING',
        department: 'IT',
      });
      expect(mockLogAuditActivity).toHaveBeenCalledWith(
        'lib-1',
        'profile',
        'stu-2',
        'role_updated',
        expect.stringContaining('stu2@school.edu'),
        null,
        { role: 'student', status: 'ACTIVE', department: 'General' },
        { role: 'student', status: 'PENDING', department: 'IT' }
      );
    });

    it('returns helpful error when target email has no existing profile', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
      queueProfileBuilders(serverClientHelper, [
        createMockQueryBuilder({ id: 'admin-1', role: 'super_admin', status: 'ACTIVE' }, null),
        createMockQueryBuilder(null, null),
      ]);

      expect(await inviteUser({ email: 'missing@school.edu', role: 'librarian' })).toEqual({
        success: false,
        error: 'No account found for that email. They must sign in first.',
      });
      errSpy.mockRestore();
    });

    it('allows super_admin to promote/demote roles and transfer super_admin ownership via admin RPC', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
      const meB = createMockQueryBuilder({ id: 'admin-1', role: 'super_admin', status: 'ACTIVE' }, null);
      const targetB = createMockQueryBuilder(
        { id: 'lib-2', email: 'lib2@school.edu', role: 'librarian', status: 'ACTIVE', department: 'Library' },
        null
      );
      queueProfileBuilders(serverClientHelper, [meB, targetB]);

      adminClientHelper.setRpcResponse(null, null, 'transfer_super_admin_ownership');
      const adminUpdateB = createMockQueryBuilder(
        { id: 'lib-2', email: 'lib2@school.edu', role: 'super_admin', status: 'ACTIVE', department: 'Admin' },
        null
      );
      adminClientHelper.from.mockReturnValue(adminUpdateB);

      const res = await inviteUser({ email: 'lib2@school.edu', role: 'super_admin', department: 'Admin' });

      expect(res.success).toBe(true);
      expect(adminClientHelper.rpc).toHaveBeenCalledWith('transfer_super_admin_ownership', {
        p_current_admin_id: 'admin-1',
        p_new_admin_id: 'lib-2',
      });
      expect(adminUpdateB.update).toHaveBeenCalledWith({
        role: 'super_admin',
        status: 'ACTIVE',
        department: 'Admin',
      });
    });

    it('aborts super_admin transfer if transfer_super_admin_ownership RPC fails', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null });
      queueProfileBuilders(serverClientHelper, [
        createMockQueryBuilder({ id: 'admin-1', role: 'super_admin', status: 'ACTIVE' }, null),
        createMockQueryBuilder({ id: 'lib-2', email: 'lib2@school.edu', role: 'librarian', status: 'ACTIVE' }, null),
      ]);
      adminClientHelper.setRpcResponse(null, new Error('Transfer RPC failed'), 'transfer_super_admin_ownership');

      const res = await inviteUser({ email: 'lib2@school.edu', role: 'super_admin' });
      expect(res).toEqual({
        success: false,
        error: 'Transfer RPC failed',
      });
      errSpy.mockRestore();
    });
  });

  describe('createSafeAction staff & permission guards', () => {
    it('blocks deactivated student_assistant on staff-only actions and enforces allowedPermissions', async () => {
      const staffAction = createSafeAction(
        z.object({ ok: z.boolean() }),
        async (input) => input,
        {
          allowedRoles: ['super_admin', 'librarian', 'student_assistant'],
          allowedPermissions: ['manage_users'],
        }
      );

      // Deactivated SA blocked
      setAuthUser(
        serverClientHelper,
        { id: 'sa-inactive' },
        {
          id: 'sa-inactive',
          role: 'student_assistant',
          status: 'INACTIVE',
          permissions: { manage_users: true },
        }
      );
      expect(await staffAction({ ok: true })).toEqual({
        success: false,
        error: 'Access denied: Staff account is currently deactivated.',
      });

      // Active SA without required permission blocked
      setAuthUser(
        serverClientHelper,
        { id: 'sa-no-perm' },
        {
          id: 'sa-no-perm',
          role: 'student_assistant',
          status: 'ACTIVE',
          permissions: { manage_circulation: true, manage_users: false },
        }
      );
      expect(await staffAction({ ok: true })).toEqual({
        success: false,
        error: 'Access denied: Missing required permission.',
      });

      // Active SA with required permission succeeds
      setAuthUser(
        serverClientHelper,
        { id: 'sa-ok' },
        {
          id: 'sa-ok',
          role: 'student_assistant',
          status: 'ACTIVE',
          permissions: { manage_users: true },
        }
      );
      expect(await staffAction({ ok: true })).toEqual({
        success: true,
        data: { ok: true },
      });
    });
  });

  describe('Onboarding Actions (lib/actions/onboarding.ts)', () => {
    it('getAcademicPrograms parses JSON array, CSV fallback, malformed JSON fallback, and DB error default', async () => {
      serverClientHelper.setTableResponse('system_settings', { value: '["CS","IT","Nursing"]' }, null);
      expect(await getAcademicPrograms()).toEqual(['CS', 'IT', 'Nursing']);

      serverClientHelper.setTableResponse('system_settings', { value: 'Law, Medicine , Architecture, ' }, null);
      expect(await getAcademicPrograms()).toEqual(['Law', 'Medicine', 'Architecture']);

      serverClientHelper.setTableResponse('system_settings', { value: '[invalid-json, fallback]' }, null);
      expect(await getAcademicPrograms()).toEqual(['[invalid-json', 'fallback]']);

      serverClientHelper.setTableResponse('system_settings', null, { message: 'Not found' });
      expect(await getAcademicPrograms()).toEqual([
        'Information Technology',
        'Computer Science',
        'Business Administration',
        'Engineering',
      ]);
    });

    it('submitOnboarding rejects unauthenticated callers, updates profile to PENDING, logs audit, and revalidates', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(
        submitOnboarding({ address: '123 Main', phone: '09171234567', department: 'CS' })
      ).rejects.toThrow('Unauthorized');

      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'stu-1' } }, error: null });
      serverClientHelper.setTableResponse('profiles', null, null);

      const res = await submitOnboarding({
        address: '456 Elm St',
        phone: '09181234567',
        department: 'Computer Science',
      });

      expect(res).toEqual({ success: true });
      const profileBuilder = serverClientHelper.getTableBuilder('profiles');
      expect(profileBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          address: '456 Elm St',
          phone: '09181234567',
          department: 'Computer Science',
          onboarding_completed: true,
          status: 'PENDING',
        })
      );
      expect(profileBuilder.eq).toHaveBeenCalledWith('id', 'stu-1');
      expect(mockLogAuditActivity).toHaveBeenCalledWith(
        'stu-1',
        'profile',
        'stu-1',
        'onboarding_completed',
        'Completed onboarding and profile setup.',
        { address: '456 Elm St', phone: '09181234567', department: 'Computer Science' }
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/');
    });

    it('submitOnboarding throws when database update fails', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'stu-1' } }, error: null });
      serverClientHelper.setTableResponse('profiles', null, { message: 'Profile update blocked' });

      await expect(
        submitOnboarding({ address: '123', phone: '456', department: 'CS' })
      ).rejects.toThrow('Profile update blocked');
    });
  });

  describe('Profile Actions (lib/actions/profile.ts)', () => {
    it('updateAvatarUrl rejects unauthenticated users and invalid/foreign/traversal avatar URLs', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(updateAvatarUrl('https://placeholder.supabase.co/storage/v1/object/public/avatars/u1/a.png')).rejects.toThrow('Unauthorized');

      serverClientHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'u1@school.edu' } },
        error: null,
      });

      await expect(updateAvatarUrl('https://evil.example.com/avatar.png')).rejects.toThrow('Invalid avatar URL.');
      await expect(
        updateAvatarUrl('https://placeholder.supabase.co/storage/v1/object/public/avatars/user-2/avatar.png')
      ).rejects.toThrow('Invalid avatar URL.');
      await expect(
        updateAvatarUrl('https://placeholder.supabase.co/storage/v1/object/public/avatars/user-1/../user-2/avatar.png')
      ).rejects.toThrow('Invalid avatar URL.');
    });

    it('updateAvatarUrl updates profile, syncs card assets, logs audit, and revalidates /profile', async () => {
      const validUrl = 'https://placeholder.supabase.co/storage/v1/object/public/avatars/user-1/avatar.webp';
      serverClientHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'u1@school.edu' } },
        error: null,
      });
      serverClientHelper.setTableResponse('profiles', null, null);

      const res = await updateAvatarUrl(validUrl);

      expect(res).toEqual({ success: true });
      expect(serverClientHelper.getTableBuilder('profiles').update).toHaveBeenCalledWith(
        expect.objectContaining({ avatar_url: validUrl })
      );
      expect(mockEnsureStaticLibraryCardAssets).toHaveBeenCalledWith({
        userId: 'user-1',
        fallbackEmail: 'u1@school.edu',
        fallbackAvatarUrl: validUrl,
      });
      expect(mockLogAuditActivity).toHaveBeenCalledWith(
        'user-1',
        'profile',
        'user-1',
        'avatar_updated',
        'Updated profile picture.',
        { avatar_url: validUrl }
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/profile');
    });

    it('updateAvatarUrl succeeds even if card asset sync fails, and throws on DB update error', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const validUrl = 'https://placeholder.supabase.co/storage/v1/object/public/avatars/user-1/pic.png';
      serverClientHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1', email: 'u1@school.edu' } },
        error: null,
      });
      serverClientHelper.setTableResponse('profiles', null, null);
      mockEnsureStaticLibraryCardAssets.mockRejectedValueOnce(new Error('Sharp failed'));

      expect(await updateAvatarUrl(validUrl)).toEqual({ success: true });

      serverClientHelper.setTableResponse('profiles', null, { message: 'DB error' });
      await expect(updateAvatarUrl(validUrl)).rejects.toThrow('Failed to update profile picture.');
      errSpy.mockRestore();
    });
  });
});
