import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { inviteUser } from '@/lib/actions/users';
import { GET, POST } from '@/app/api/circulation/reservations/route';
import { getMe } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';
import type { ProfileData, UserRole } from '@/lib/types';

// Mock dependencies
vi.mock('@/lib/auth-helpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth-helpers')>();
  return {
    ...actual,
    getMe: vi.fn(),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditActivity: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

// Helper to create mock UserSession matching canonical type
type MeSession = NonNullable<Awaited<ReturnType<typeof getMe>>>;

function createSessionMock(
  mockHelper: MockSupabaseClientHelper,
  role: UserRole = 'super_admin',
  userId: string = 'requester-id'
): MeSession {
  return {
    user: {
      id: userId,
      email: `${role}@school.edu`,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id: userId,
      email: `${role}@school.edu`,
      role,
      status: 'ACTIVE',
      full_name: `${role} User`,
      department: 'Library',
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
    supabase: mockHelper.client,
  } as unknown as MeSession;
}

describe('Challenger Milestone 2 Iteration 2: Empirical Privilege & Security Challenges', () => {
  let mockClientHelper: MockSupabaseClientHelper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientHelper = createMockSupabaseClient();
  });

  // =========================================================================
  // SUITE 1: lib/actions/users.ts:inviteUser Privilege Boundaries
  // =========================================================================
  describe('Empirical Challenge 1: inviteUser Privilege Boundary & Demotion Prevention', () => {
    it('EMPIRICALLY VERIFIES: librarian calling inviteUser targeting an existing super_admin is rejected and DB update is NOT executed', async () => {
      vi.mocked(getMe).mockResolvedValue(createSessionMock(mockClientHelper, 'librarian', 'lib-caller-id'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          id: 'victim-sa-id',
          email: 'admin@school.edu',
          role: 'super_admin',
          status: 'ACTIVE',
          department: 'IT',
        },
        error: null,
      });

      const result = await inviteUser({ email: 'admin@school.edu', role: 'student' });

      // Empirical Assertions
      expect(result.success).toBe(false);
      expect(result.error).toBe('Only super administrators can modify a super administrator account');
      expect(tableBuilder.update).not.toHaveBeenCalled();
    });

    it('EMPIRICALLY VERIFIES: librarian calling inviteUser targeting an existing librarian is rejected and DB update is NOT executed', async () => {
      vi.mocked(getMe).mockResolvedValue(createSessionMock(mockClientHelper, 'librarian', 'lib-caller-id'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          id: 'victim-lib-id',
          email: 'colleague@school.edu',
          role: 'librarian',
          status: 'ACTIVE',
          department: 'Cataloging',
        },
        error: null,
      });

      const result = await inviteUser({ email: 'colleague@school.edu', role: 'student' });

      // Empirical Assertions
      expect(result.success).toBe(false);
      expect(result.error).toBe('Librarians cannot modify accounts with staff or admin roles');
      expect(tableBuilder.update).not.toHaveBeenCalled();
    });

    it('EMPIRICALLY VERIFIES: librarian calling inviteUser targeting existing student_assistant is rejected and DB update is NOT executed', async () => {
      vi.mocked(getMe).mockResolvedValue(createSessionMock(mockClientHelper, 'librarian', 'lib-caller-id'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          id: 'victim-sa-id',
          email: 'assistant@school.edu',
          role: 'student_assistant',
          status: 'ACTIVE',
          department: 'Circulation',
        },
        error: null,
      });

      const result = await inviteUser({ email: 'assistant@school.edu', role: 'student' });

      // Empirical Assertions
      expect(result.success).toBe(false);
      expect(result.error).toBe('Librarians cannot modify accounts with staff or admin roles');
      expect(tableBuilder.update).not.toHaveBeenCalled();
    });

    it('EMPIRICALLY VERIFIES: librarian attempting to invite/promote someone to librarian or super_admin is rejected before DB query', async () => {
      vi.mocked(getMe).mockResolvedValue(createSessionMock(mockClientHelper, 'librarian', 'lib-caller-id'));
      const tableBuilder = mockClientHelper.getTableBuilder('profiles');

      for (const forbiddenRole of ['super_admin', 'librarian', 'student_assistant']) {
        const result = await inviteUser({ email: 'target@school.edu', role: forbiddenRole });
        expect(result.success).toBe(false);
        expect(result.error).toBe('Librarians are not allowed to assign roles');
        expect(tableBuilder.select).not.toHaveBeenCalled();
      }
    });

    it('EMPIRICALLY VERIFIES: super_admin modifying another super_admin succeeds and executes DB update', async () => {
      vi.mocked(getMe).mockResolvedValue(createSessionMock(mockClientHelper, 'super_admin', 'sa-caller-id'));

      const tableBuilder = mockClientHelper.getTableBuilder('profiles');
      tableBuilder.maybeSingle.mockResolvedValueOnce({
        data: {
          id: 'target-sa-id',
          email: 'target-sa@school.edu',
          role: 'super_admin',
          status: 'ACTIVE',
          department: 'General',
        },
        error: null,
      });

      tableBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'target-sa-id',
          email: 'target-sa@school.edu',
          role: 'super_admin',
          status: 'PENDING',
          department: 'Executive',
        },
        error: null,
      });

      const result = await inviteUser({
        email: 'target-sa@school.edu',
        role: 'super_admin',
        department: 'Executive',
      });

      expect(result.success).toBe(true);
      expect(result.data?.user.role).toBe('super_admin');
      expect(tableBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'super_admin',
          status: 'PENDING',
          department: 'Executive',
        })
      );
    });
  });

  // =========================================================================
  // SUITE 2: app/api/circulation/reservations/route.ts GET Authorization
  // =========================================================================
  describe('Empirical Challenge 2: Circulation Route Deactivated Staff Enforcement', () => {
    let mockSupabase: {
      auth: { getUser: Mock };
      from: Mock;
      rpc: Mock;
    };

    const setupAuthUser = (userId = 'sa-user-id', email = 'sa@school.edu') => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId, email } },
        error: null,
      });
    };

    const createProfileQueryMock = (role: string, status: string) => {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'sa-user-id', role, status },
              error: null,
            }),
          }),
        }),
      };
    };

    const createReservationsQueryMock = () => {
      const q: {
        select: Mock;
        eq: Mock;
        order: Mock;
      } = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn(),
      };
      q.select.mockReturnValue(q);
      q.eq.mockReturnValue(q);
      q.order.mockResolvedValue({
        data: [{ id: 'res-999', user_id: 'victim-patron-id', status: 'ACTIVE' }],
        error: null,
      });
      return q;
    };

    beforeEach(() => {
      mockSupabase = {
        auth: { getUser: vi.fn() },
        from: vi.fn(),
        rpc: vi.fn(),
      };
      (createClient as Mock).mockResolvedValue(mockSupabase);
    });

    it('EMPIRICALLY VERIFIES: deactivated student assistant (INACTIVE) receives 403 Forbidden viewing other patrons reservations', async () => {
      setupAuthUser('sa-deactivated-id', 'sa@school.edu');
      const resQuery = createReservationsQueryMock();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return createProfileQueryMock('student_assistant', 'INACTIVE');
        }
        if (table === 'reservations') {
          return resQuery;
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/circulation/reservations?userId=victim-patron-id');
      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('EMPIRICALLY VERIFIES: suspended student assistant (SUSPENDED) receives 403 Forbidden viewing other patrons reservations', async () => {
      setupAuthUser('sa-suspended-id', 'sa@school.edu');
      const resQuery = createReservationsQueryMock();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return createProfileQueryMock('student_assistant', 'SUSPENDED');
        }
        if (table === 'reservations') {
          return resQuery;
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/circulation/reservations?userId=victim-patron-id');
      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('EMPIRICALLY VERIFIES: pending student assistant (PENDING) receives 403 Forbidden viewing other patrons reservations', async () => {
      setupAuthUser('sa-pending-id', 'sa@school.edu');
      const resQuery = createReservationsQueryMock();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return createProfileQueryMock('student_assistant', 'PENDING');
        }
        if (table === 'reservations') {
          return resQuery;
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/circulation/reservations?userId=victim-patron-id');
      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('EMPIRICALLY VERIFIES: deactivated student assistant querying without userId only receives their own reservations', async () => {
      setupAuthUser('sa-deactivated-id', 'sa@school.edu');

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'res-own', user_id: 'sa-deactivated-id', status: 'ACTIVE' }],
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return createProfileQueryMock('student_assistant', 'INACTIVE');
        }
        if (table === 'reservations') {
          return mockQuery;
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/circulation/reservations');
      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toHaveLength(1);
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'sa-deactivated-id');
    });

    it('EMPIRICALLY VERIFIES: active student assistant CAN view other patrons reservations', async () => {
      setupAuthUser('sa-active-id', 'sa@school.edu');

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'res-patron', user_id: 'victim-patron-id', status: 'ACTIVE' }],
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return createProfileQueryMock('student_assistant', 'ACTIVE');
        }
        if (table === 'reservations') {
          return mockQuery;
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/circulation/reservations?userId=victim-patron-id');
      const response = await GET(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toHaveLength(1);
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'victim-patron-id');
    });

    it('EMPIRICALLY VERIFIES: active librarian and super_admin CAN view other patrons reservations', async () => {
      for (const role of ['librarian', 'super_admin']) {
        setupAuthUser(`${role}-caller-id`, `${role}@school.edu`);

        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: `res-${role}`, user_id: 'victim-patron-id', status: 'ACTIVE' }],
            error: null,
          }),
        };

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'profiles') {
            return createProfileQueryMock(role, 'ACTIVE');
          }
          if (table === 'reservations') {
            return mockQuery;
          }
          return {};
        });

        const req = new NextRequest('http://localhost:3000/api/circulation/reservations?userId=victim-patron-id');
        const response = await GET(req);

        expect(response.status).toBe(200);
        expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'victim-patron-id');
      }
    });

    it('EMPIRICALLY VERIFIES: deactivated student assistant attempting POST on behalf of another user is rejected with 403 FORBIDDEN', async () => {
      setupAuthUser('sa-deactivated-id');

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return createProfileQueryMock('student_assistant', 'INACTIVE');
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/circulation/reservations', {
        method: 'POST',
        body: JSON.stringify({
          bookId: '11111111-1111-4111-a111-111111111111',
          userId: '22222222-2222-4222-a222-222222222222',
        }),
      });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.code).toBe('FORBIDDEN');
      expect(json.message).toBe('Only staff members can reserve books on behalf of other users');
    });
  });
});
