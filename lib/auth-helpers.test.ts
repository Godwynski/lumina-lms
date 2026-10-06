import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabaseClient, MockSupabaseClientHelper } from '../test/mocks/supabase';

// Mock react cache to be a pass-through so getMe is not memoized across distinct test cases
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T): T => fn,
  };
});

let mockSupabase: MockSupabaseClientHelper;

vi.mock('./supabase/server', () => ({
  createClient: vi.fn(async () => mockSupabase.client),
}));

import { normalizeUserRole, getMe, assertRole, getUserRole } from './auth-helpers';

describe('normalizeUserRole', () => {
  it('returns valid roles as-is for correct lowercase strings', () => {
    expect(normalizeUserRole('super_admin')).toBe('super_admin');
    expect(normalizeUserRole('librarian')).toBe('librarian');
    expect(normalizeUserRole('student_assistant')).toBe('student_assistant');
    expect(normalizeUserRole('student')).toBe('student');
  });

  it('handles case-insensitivity and whitespace trimming', () => {
    expect(normalizeUserRole('SUPER_ADMIN')).toBe('super_admin');
    expect(normalizeUserRole('  librarian  ')).toBe('librarian');
    expect(normalizeUserRole('Student_Assistant')).toBe('student_assistant');
    expect(normalizeUserRole('\tSTUDENT\n')).toBe('student');
  });

  it('returns null for unrecognized or invalid strings', () => {
    expect(normalizeUserRole('admin')).toBeNull();
    expect(normalizeUserRole('superadmin')).toBeNull();
    expect(normalizeUserRole('faculty')).toBeNull();
    expect(normalizeUserRole('teacher')).toBeNull();
    expect(normalizeUserRole('guest')).toBeNull();
    expect(normalizeUserRole('')).toBeNull();
    expect(normalizeUserRole('   ')).toBeNull();
  });

  it('returns null for non-string types', () => {
    expect(normalizeUserRole(null)).toBeNull();
    expect(normalizeUserRole(undefined)).toBeNull();
    expect(normalizeUserRole(123)).toBeNull();
    expect(normalizeUserRole(true)).toBeNull();
    expect(normalizeUserRole({})).toBeNull();
    expect(normalizeUserRole(['student'])).toBeNull();
  });
});

describe('getMe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
  });

  it('returns null if supabase.auth.getUser() returns no user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const me = await getMe();
    expect(me).toBeNull();
  });

  it('returns null if supabase.auth.getUser() returns an error', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Session expired' },
    });

    const me = await getMe();
    expect(me).toBeNull();
  });

  it('returns null if profile query fails or profile is missing', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
    mockSupabase.setTableResponse('profiles', null, { message: 'Profile not found' });

    const me = await getMe();
    expect(me).toBeNull();
  });

  it('resolves active student profile with helper properties', async () => {
    const mockUser = { id: 'stu-1', app_metadata: {} };
    const mockProfile = {
      id: 'stu-1',
      role: 'student',
      status: 'ACTIVE',
      email: 'student@school.edu',
      permissions: null,
    };

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockSupabase.setTableResponse('profiles', mockProfile);

    const me = await getMe();
    expect(me).not.toBeNull();
    expect(me?.role).toBe('student');
    expect(me?.isStaff).toBe(false);
    expect(me?.isAdmin).toBe(false);
    expect(me?.isDeactivatedSA).toBe(false);
    expect(me?.hasPermission('manage_circulation')).toBe(false);
  });

  it('resolves super_admin with isAdmin and permission bypass', async () => {
    const mockUser = { id: 'admin-1', app_metadata: {} };
    const mockProfile = {
      id: 'admin-1',
      role: 'super_admin',
      status: 'ACTIVE',
      email: 'admin@school.edu',
      permissions: null,
    };

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockSupabase.setTableResponse('profiles', mockProfile);

    const me = await getMe();
    expect(me).not.toBeNull();
    expect(me?.role).toBe('super_admin');
    expect(me?.isStaff).toBe(true);
    expect(me?.isAdmin).toBe(true);
    expect(me?.hasPermission('manage_circulation')).toBe(true);
    expect(me?.hasPermission('view_admin_dashboard')).toBe(true);
  });

  it('resolves librarian with isStaff and permission bypass', async () => {
    const mockUser = { id: 'lib-1', app_metadata: {} };
    const mockProfile = {
      id: 'lib-1',
      role: 'librarian',
      status: 'ACTIVE',
      email: 'librarian@school.edu',
      permissions: null,
    };

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockSupabase.setTableResponse('profiles', mockProfile);

    const me = await getMe();
    expect(me).not.toBeNull();
    expect(me?.role).toBe('librarian');
    expect(me?.isStaff).toBe(true);
    expect(me?.isAdmin).toBe(false);
    expect(me?.hasPermission('manage_circulation')).toBe(true);
  });

  it('evaluates granular permissions for student assistant', async () => {
    const mockUser = { id: 'sa-1', app_metadata: {} };
    const mockProfile = {
      id: 'sa-1',
      role: 'student_assistant',
      status: 'ACTIVE',
      email: 'sa@school.edu',
      permissions: { manage_circulation: true, manage_attendance: false },
    };

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockSupabase.setTableResponse('profiles', mockProfile);

    const me = await getMe();
    expect(me).not.toBeNull();
    expect(me?.role).toBe('student_assistant');
    expect(me?.isStaff).toBe(true);
    expect(me?.isDeactivatedSA).toBe(false);
    expect(me?.hasPermission('manage_circulation')).toBe(true);
    expect(me?.hasPermission('manage_attendance')).toBe(false);
    expect(me?.hasPermission('view_admin_dashboard')).toBe(false);
  });

  it('identifies deactivated student assistant (isDeactivatedSA = true)', async () => {
    const mockUser = { id: 'sa-inactive', app_metadata: {} };
    const mockProfile = {
      id: 'sa-inactive',
      role: 'student_assistant',
      status: 'INACTIVE',
      email: 'sa_inactive@school.edu',
      permissions: { manage_circulation: true },
    };

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockSupabase.setTableResponse('profiles', mockProfile);

    const me = await getMe();
    expect(me).not.toBeNull();
    expect(me?.role).toBe('student_assistant');
    expect(me?.isDeactivatedSA).toBe(true);
  });

  it('falls back to app_metadata role when profile role is missing or invalid', async () => {
    const mockUser = {
      id: 'meta-user',
      app_metadata: { role: 'librarian' },
    };
    const mockProfile = {
      id: 'meta-user',
      role: 'invalid_role',
      status: 'ACTIVE',
      email: 'meta@school.edu',
      permissions: null,
    };

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockSupabase.setTableResponse('profiles', mockProfile);

    const me = await getMe();
    expect(me?.role).toBe('librarian');
  });

  it('falls back to student role when both profile and metadata roles are invalid', async () => {
    const mockUser = {
      id: 'fallback-user',
      app_metadata: { role: 'invalid_meta' },
    };
    const mockProfile = {
      id: 'fallback-user',
      role: 'invalid_profile',
      status: 'ACTIVE',
      email: 'fallback@school.edu',
      permissions: null,
    };

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockSupabase.setTableResponse('profiles', mockProfile);

    const me = await getMe();
    expect(me?.role).toBe('student');
  });
});

describe('assertRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
  });

  it('throws Error("Unauthorized") when user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(assertRole(['student'])).rejects.toThrow('Unauthorized');
  });

  it('throws Error("Forbidden") when user role is not in allowedRoles', async () => {
    const mockUser = { id: 'stu-1', app_metadata: {} };
    const mockProfile = {
      id: 'stu-1',
      role: 'student',
      status: 'ACTIVE',
      email: 'student@school.edu',
    };

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockSupabase.setTableResponse('profiles', mockProfile);

    await expect(assertRole(['librarian', 'super_admin'])).rejects.toThrow('Forbidden');
  });

  it('succeeds and returns me context when user role matches allowedRoles', async () => {
    const mockUser = { id: 'admin-1', app_metadata: {} };
    const mockProfile = {
      id: 'admin-1',
      role: 'super_admin',
      status: 'ACTIVE',
      email: 'admin@school.edu',
    };

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockSupabase.setTableResponse('profiles', mockProfile);

    const result = await assertRole(['super_admin', 'librarian']);
    expect(result).not.toBeNull();
    expect(result.role).toBe('super_admin');
  });
});

describe('getUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
  });

  it('returns role when authenticated', async () => {
    const mockUser = { id: 'lib-1', app_metadata: {} };
    const mockProfile = {
      id: 'lib-1',
      role: 'librarian',
      status: 'ACTIVE',
    };

    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    mockSupabase.setTableResponse('profiles', mockProfile);

    const role = await getUserRole();
    expect(role).toBe('librarian');
  });

  it('returns null when unauthenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const role = await getUserRole();
    expect(role).toBeNull();
  });
});
