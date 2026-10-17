import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { GET, POST } from '@/app/api/circulation/reservations/route';
import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

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

describe('Adversarial & Boundary Verification: /api/circulation/reservations', () => {
  let mockSupabase: {
    auth: { getUser: Mock };
    from: Mock;
    rpc: Mock;
  };

  const setupMockUser = (userId: string | null = 'user-123', email = 'user@school.edu') => {
    if (!userId) {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
      return;
    }
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId, email } },
      error: null,
    });
  };

  const setupMockProfile = (role: string, status = 'ACTIVE') => {
    return {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'caller-id', role, status },
            error: null,
          }),
        }),
      }),
    };
  };

  const createMockReservationsQuery = () => {
    const query: {
      select: Mock;
      eq: Mock;
      order: Mock;
    } = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockResolvedValue({
      data: [{ id: 'res-1', user_id: 'patron-id', status: 'ACTIVE' }],
      error: null,
    });
    return query;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
      rpc: vi.fn(),
    };
    (createClient as Mock).mockResolvedValue(mockSupabase);
  });

  describe('GET /api/circulation/reservations', () => {
    it('returns 401 Unauthorized when caller is not authenticated', async () => {
      setupMockUser(null);

      const request = new NextRequest('http://localhost:3000/api/circulation/reservations');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('denies (403 Forbidden) when a deactivated student assistant queries another patron reservations', async () => {
      setupMockUser('sa-deactivated-id', 'sa@school.edu');
      const resQuery = createMockReservationsQuery();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return setupMockProfile('student_assistant', 'INACTIVE');
        }
        if (table === 'reservations') {
          return resQuery;
        }
        return {};
      });

      const request = new NextRequest('http://localhost:3000/api/circulation/reservations?userId=victim-patron-id');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('denies (403 Forbidden) when a suspended student assistant queries another patron reservations', async () => {
      setupMockUser('sa-suspended-id', 'sa@school.edu');
      const resQuery = createMockReservationsQuery();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return setupMockProfile('student_assistant', 'SUSPENDED');
        }
        if (table === 'reservations') {
          return resQuery;
        }
        return {};
      });

      const request = new NextRequest('http://localhost:3000/api/circulation/reservations?userId=victim-patron-id');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('denies (403 Forbidden) when a regular student queries another patron reservations', async () => {
      setupMockUser('student-id', 'student@school.edu');
      const resQuery = createMockReservationsQuery();

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return setupMockProfile('student', 'ACTIVE');
        }
        if (table === 'reservations') {
          return resQuery;
        }
        return {};
      });

      const request = new NextRequest('http://localhost:3000/api/circulation/reservations?userId=other-student-id');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe('Forbidden');
    });

    it('restricts deactivated student assistant to self reservations when userId param is omitted', async () => {
      setupMockUser('sa-deactivated-id', 'sa@school.edu');

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
          return setupMockProfile('student_assistant', 'INACTIVE');
        }
        if (table === 'reservations') {
          return mockQuery;
        }
        return {};
      });

      const request = new NextRequest('http://localhost:3000/api/circulation/reservations');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toHaveLength(1);
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'sa-deactivated-id');
    });

    it('allows active student assistant to query patron reservations', async () => {
      setupMockUser('sa-active-id', 'sa@school.edu');

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'res-patron', user_id: 'patron-id', status: 'ACTIVE' }],
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return setupMockProfile('student_assistant', 'ACTIVE');
        }
        if (table === 'reservations') {
          return mockQuery;
        }
        return {};
      });

      const request = new NextRequest('http://localhost:3000/api/circulation/reservations?userId=patron-id');
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toHaveLength(1);
      expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'patron-id');
    });

    it('allows librarian and super_admin to query patron reservations', async () => {
      for (const role of ['librarian', 'super_admin']) {
        setupMockUser(`${role}-id`, `${role}@school.edu`);

        const mockQuery = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: `res-${role}`, user_id: 'patron-123', status: 'ACTIVE' }],
            error: null,
          }),
        };

        mockSupabase.from.mockImplementation((table: string) => {
          if (table === 'profiles') {
            return setupMockProfile(role, 'ACTIVE');
          }
          if (table === 'reservations') {
            return mockQuery;
          }
          return {};
        });

        const request = new NextRequest('http://localhost:3000/api/circulation/reservations?userId=patron-123');
        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'patron-123');
      }
    });

    it('filters by bookId when provided', async () => {
      setupMockUser('user-id', 'user@school.edu');

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'res-book', book_id: 'book-456', status: 'ACTIVE' }],
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return setupMockProfile('librarian', 'ACTIVE');
        }
        if (table === 'reservations') {
          return mockQuery;
        }
        return {};
      });

      const request = new NextRequest('http://localhost:3000/api/circulation/reservations?bookId=book-456');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockQuery.eq).toHaveBeenCalledWith('book_id', 'book-456');
    });
  });

  describe('POST /api/circulation/reservations', () => {
    it('returns 401 when caller is unauthenticated', async () => {
      setupMockUser(null);

      const request = new NextRequest('http://localhost:3000/api/circulation/reservations', {
        method: 'POST',
        body: JSON.stringify({ bookId: '11111111-1111-4111-a111-111111111111' }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });

    it('returns 400 when body is invalid JSON', async () => {
      setupMockUser('user-123');

      const request = new NextRequest('http://localhost:3000/api/circulation/reservations', {
        method: 'POST',
        body: 'invalid-json{',
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.message).toBe('Invalid JSON body');
    });

    it('blocks deactivated student assistant from reserving on behalf of another user', async () => {
      setupMockUser('sa-deactivated-id');

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return setupMockProfile('student_assistant', 'INACTIVE');
        }
        return {};
      });

      const request = new NextRequest('http://localhost:3000/api/circulation/reservations', {
        method: 'POST',
        body: JSON.stringify({
          bookId: '11111111-1111-4111-a111-111111111111',
          userId: '22222222-2222-4222-a222-222222222222',
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.code).toBe('FORBIDDEN');
      expect(json.message).toBe('Only staff members can reserve books on behalf of other users');
    });

    it('allows active librarian to reserve on behalf of another user and invokes atomic RPC', async () => {
      setupMockUser('librarian-id');

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return setupMockProfile('librarian', 'ACTIVE');
        }
        return {};
      });

      mockSupabase.rpc.mockResolvedValue({
        data: {
          ok: true,
          reservation_id: 'res-new',
          status: 'ACTIVE',
          queue_position: 1,
        },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/circulation/reservations', {
        method: 'POST',
        body: JSON.stringify({
          bookId: '11111111-1111-4111-a111-111111111111',
          userId: '22222222-2222-4222-a222-222222222222',
        }),
      });

      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_reservation_atomic', {
        p_actor_id: 'librarian-id',
        p_book_id: '11111111-1111-4111-a111-111111111111',
        p_target_user_id: '22222222-2222-4222-a222-222222222222',
      });
    });
  });
});
