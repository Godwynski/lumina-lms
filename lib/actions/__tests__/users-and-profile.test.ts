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

import { getUsers } from '@/lib/actions/users';
import { getAcademicPrograms, submitOnboarding } from '@/lib/actions/onboarding';
import { updateAvatarUrl, removeAvatar } from '@/lib/actions/profile';
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
    it.each([
      ['name-asc', 'full_name', true], ['name-desc', 'full_name', false],
      ['id-asc', 'student_id', true], ['id-desc', 'student_id', false],
      ['program-asc', 'department', true], ['program-desc', 'department', false],
      ['invalid-order', 'created_at', false],
    ] as const)('orders the filtered directory by %s before the database range', async (sort, column, ascending) => {
      const actor = createMockQueryBuilder({ id: 'librarian-1', role: 'librarian', status: 'ACTIVE' });
      const rows = createMockQueryBuilder([], null, 0);
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'librarian-1' } }, error: null });
      queueProfileBuilders(serverClientHelper, [actor, rows]);

      await getUsers({ tab: 'archived', search: 'Alice', page: 2, pageSize: 12, sort });

      expect(rows.eq).toHaveBeenCalledWith('status', 'ARCHIVED');
      expect(rows.neq).toHaveBeenCalledWith('role', 'super_admin');
      expect(rows.or).toHaveBeenCalledWith('full_name.ilike.%Alice%,email.ilike.%Alice%,student_id.ilike.%Alice%');
      expect(rows.order).toHaveBeenNthCalledWith(1, column, { ascending, nullsFirst: false });
      expect(rows.order).toHaveBeenLastCalledWith('id', { ascending: false });
      expect(rows.order.mock.invocationCallOrder.at(-1)).toBeLessThan(rows.range.mock.invocationCallOrder[0]);
      expect(rows.range).toHaveBeenCalledExactlyOnceWith(12, 23);
    });

    it('throws Unauthorized when unauthenticated and Forbidden for student or library_staff', async () => {
      setAuthUser(serverClientHelper, null, null);
      await expect(getUsers()).rejects.toThrow('Unauthorized');

      setAuthUser(serverClientHelper, { id: 'stu-1' }, { id: 'stu-1', role: 'patron', status: 'ACTIVE' });
      await expect(getUsers()).rejects.toThrow('Forbidden');

      setAuthUser(serverClientHelper, { id: 'sa-1' }, { id: 'sa-1', role: 'library_staff', status: 'ACTIVE' });
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

  describe('createSafeAction staff & permission guards', () => {
    it('blocks deactivated library_staff on staff-only actions and enforces allowedPermissions', async () => {
      const staffAction = createSafeAction(
        z.object({ ok: z.boolean() }),
        async (input) => input,
        {
          allowedRoles: ['super_admin', 'librarian', 'library_staff'],
          allowedPermissions: ['manage_users'],
        }
      );

      // Deactivated SA blocked
      setAuthUser(
        serverClientHelper,
        { id: 'sa-inactive' },
        {
          id: 'sa-inactive',
          role: 'library_staff',
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
          role: 'library_staff',
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
          role: 'library_staff',
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

    it('submitOnboarding rejects unauthenticated callers, updates profile without changing status, logs audit, and revalidates', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(
        submitOnboarding({ address: '123 Main', phone: '09171234567', department: 'CS' })
      ).rejects.toThrow('Unauthorized');

      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'stu-1' } }, error: null });
      serverClientHelper.setTableResponse('profiles', { onboarding_completed: false }, null);

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
        })
      );
      expect(profileBuilder.eq).toHaveBeenCalledWith('id', 'stu-1');
      expect(mockLogAuditActivity).toHaveBeenCalledWith(
        'stu-1',
        'profile',
        'stu-1',
        'onboarding_completed',
        'Completed onboarding and profile setup.',
        { address: '456 Elm St', phone: '09181234567', patron_type: 'student', department: 'Computer Science' }
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/');
    });

    it('rejects a profile whose onboarding is already completed', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'stu-1' } }, error: null });
      serverClientHelper.setTableResponse('profiles', { onboarding_completed: true, status: 'ACTIVE' }, null);
      await expect(submitOnboarding({ address: '123 Main', phone: '09171234567', department: 'CS' })).rejects.toThrow(/already completed/i);
      expect(serverClientHelper.getTableBuilder('profiles').update).not.toHaveBeenCalled();
    });

    it.each([
      { onboarding_completed: null, status: 'ACTIVE' },
      { onboarding_completed: false, status: 'ACTIVE' },
      { onboarding_completed: true, status: 'PENDING' },
    ])('accepts eligible onboarding state $onboarding_completed / $status with an atomic condition', async (profile) => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'stu-1' } }, error: null });
      const read = createMockQueryBuilder(profile);
      const update = createMockQueryBuilder({ id: 'stu-1' });
      queueProfileBuilders(serverClientHelper, [read, update]);
      await expect(submitOnboarding({ address: '123 Main', phone: '09171234567', department: 'CS' })).resolves.toEqual({ success: true });
      expect(update.or).toHaveBeenCalledWith('status.eq.PENDING,onboarding_completed.is.null,onboarding_completed.eq.false');
    });

    it('rejects when eligibility changes before the update', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'stu-1' } }, error: null });
      queueProfileBuilders(serverClientHelper, [createMockQueryBuilder({ status: 'PENDING', onboarding_completed: true }), createMockQueryBuilder(null)]);
      await expect(submitOnboarding({ address: '123 Main', phone: '09171234567', department: 'CS' })).rejects.toThrow(/already completed/i);
      expect(mockLogAuditActivity).not.toHaveBeenCalled();
    });

    it('preserves the account status when completing an approved profile', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'approved-1' } }, error: null });
      serverClientHelper.setTableResponse('profiles', { onboarding_completed: false }, null);
      await submitOnboarding({ address: '123 Main', phone: '09171234567', department: 'CS' });
      expect(serverClientHelper.getTableBuilder('profiles').update.mock.calls[0][0]).not.toHaveProperty('status');
    });

    it('submitOnboarding allows faculty without department and rejects student without department', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'fac-1' } }, error: null });
      serverClientHelper.setTableResponse('profiles', { onboarding_completed: false }, null);

      await expect(
        submitOnboarding({ address: '123 Main', phone: '09171234567', patron_type: 'student', department: '' })
      ).rejects.toThrow('Academic program is required for students');

      await expect(
        submitOnboarding({
          address: '123 Main',
          phone: '09171234567',
          patron_type: 'visitor' as unknown as 'student',
          department: 'CS',
        })
      ).rejects.toThrow();

      const res = await submitOnboarding({
        address: 'Faculty Wing',
        phone: '09170001234',
        patron_type: 'faculty',
      });
      expect(res).toEqual({ success: true });
      const profileBuilder = serverClientHelper.getTableBuilder('profiles');
      expect(profileBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          address: 'Faculty Wing',
          phone: '09170001234',
          patron_type: 'faculty',
          department: null,
          onboarding_completed: true,
        })
      );
    });

    it('submitOnboarding throws when database update fails', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'stu-1' } }, error: null });
      const read = createMockQueryBuilder({ onboarding_completed: false, status: 'PENDING' });
      const update = createMockQueryBuilder(null, { message: 'Profile update blocked' });
      queueProfileBuilders(serverClientHelper, [read, update]);

      await expect(
        submitOnboarding({ address: '123', phone: '456', department: 'CS' })
      ).rejects.toThrow('Profile update blocked');
      expect(update.update).toHaveBeenCalled();
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

    it('removeAvatar requires a session, clears only the caller avatar, audits, and surfaces DB errors (P2-PRF-006)', async () => {
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      await expect(removeAvatar()).rejects.toThrow('Unauthorized');

      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'u1@school.edu' } }, error: null });
      serverClientHelper.setTableResponse('profiles', null, null);
      expect(await removeAvatar()).toEqual({ success: true });
      const builder = serverClientHelper.getTableBuilder('profiles');
      expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ avatar_url: null }));
      expect(builder.eq).toHaveBeenCalledWith('id', 'user-1');
      expect(mockLogAuditActivity).toHaveBeenCalledWith('user-1', 'profile', 'user-1', 'avatar_removed', 'Removed profile picture.', {});

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      serverClientHelper.setTableResponse('profiles', null, { message: 'DB error' });
      await expect(removeAvatar()).rejects.toThrow('Failed to remove profile picture.');
      errSpy.mockRestore();
    });
  });
});
