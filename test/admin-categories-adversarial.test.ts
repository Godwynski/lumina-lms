import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { GET, PUT, DELETE } from '@/app/api/admin/categories/[id]/route';
import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('Admin Categories [id] API Route - Adversarial Verification', () => {
  let mockSupabase: {
    auth: { getUser: Mock };
    from: Mock;
  };

  const setupMockUserAndProfile = (role: string | null, userId: string | null = 'user-test-id') => {
    if (!userId) {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      return;
    }

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId, email: `${role}@test.com` } },
    });

    const mockProfileQuery = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: role ? { id: userId, role } : null,
            error: role ? null : new Error('Profile not found'),
          }),
        }),
      }),
    };

    return mockProfileQuery;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
    };
    (createClient as Mock).mockResolvedValue(mockSupabase);
  });

  describe('GET /api/admin/categories/[id]', () => {
    it('returns 401 Unauthorized for unauthenticated requests', async () => {
      setupMockUserAndProfile(null, null);

      const req = new NextRequest('http://localhost:3000/api/admin/categories/cat-123');
      const res = await GET(req, { params: Promise.resolve({ id: 'cat-123' }) });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 403 Forbidden for student role', async () => {
      const profileQuery = setupMockUserAndProfile('student');
      mockSupabase.from.mockReturnValue(profileQuery);

      const req = new NextRequest('http://localhost:3000/api/admin/categories/cat-123');
      const res = await GET(req, { params: Promise.resolve({ id: 'cat-123' }) });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden');
    });

    it('returns 403 Forbidden for student_assistant role', async () => {
      const profileQuery = setupMockUserAndProfile('student_assistant');
      mockSupabase.from.mockReturnValue(profileQuery);

      const req = new NextRequest('http://localhost:3000/api/admin/categories/cat-123');
      const res = await GET(req, { params: Promise.resolve({ id: 'cat-123' }) });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden');
    });

    it('CRITICAL: allows super_admin and returns 200 with category data (does NOT throw 403)', async () => {
      const categoryData = {
        id: 'cat-123',
        name: 'Computer Science',
        slug: 'computer-science',
        description: 'CS books',
        is_active: true,
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-id' } },
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { role: 'super_admin' }, error: null }),
              }),
            }),
          };
        }
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

      const req = new NextRequest('http://localhost:3000/api/admin/categories/cat-123');
      const res = await GET(req, { params: Promise.resolve({ id: 'cat-123' }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(categoryData);
    });

    it('allows librarian and returns 200 with category data', async () => {
      const categoryData = { id: 'cat-123', name: 'Literature', slug: 'literature' };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'lib-id' } },
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { role: 'librarian' }, error: null }),
              }),
            }),
          };
        }
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

      const req = new NextRequest('http://localhost:3000/api/admin/categories/cat-123');
      const res = await GET(req, { params: Promise.resolve({ id: 'cat-123' }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual(categoryData);
    });

    it('returns 404 when category is not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-id' } },
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { role: 'super_admin' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/admin/categories/missing-cat');
      const res = await GET(req, { params: Promise.resolve({ id: 'missing-cat' }) });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Not found');
    });
  });

  describe('PUT /api/admin/categories/[id]', () => {
    it('returns 401 Unauthorized for unauthenticated requests', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

      const req = new NextRequest('http://localhost:3000/api/admin/categories/cat-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name' }),
      });
      const res = await PUT(req, { params: Promise.resolve({ id: 'cat-123' }) });

      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden for non-admin/non-librarian roles', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'student' } }),
          }),
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/admin/categories/cat-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name' }),
      });
      const res = await PUT(req, { params: Promise.resolve({ id: 'cat-123' }) });

      expect(res.status).toBe(403);
    });

    it('CRITICAL: allows super_admin to update category (does NOT return 403 Forbidden)', async () => {
      const existingCategory = { id: 'cat-123', name: 'Old Name', slug: 'old-name', description: null, is_active: true };
      const updatedCategory = { id: 'cat-123', name: 'Updated Science', slug: 'updated-science', description: 'Updated CS', is_active: true };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-id' } } });

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedCategory, error: null }),
          }),
        }),
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { role: 'super_admin' }, error: null }),
              }),
            }),
          };
        }
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

      const req = new NextRequest('http://localhost:3000/api/admin/categories/cat-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Science', slug: 'updated-science', description: 'Updated CS' }),
      });
      const res = await PUT(req, { params: Promise.resolve({ id: 'cat-123' }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Updated Science');
      expect(data.slug).toBe('updated-science');
      expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Updated Science',
        slug: 'updated-science',
        description: 'Updated CS',
      }));
    });

    it('allows librarian to update category', async () => {
      const existingCategory = { id: 'cat-123', name: 'Old Lib', slug: 'old-lib' };
      const updatedCategory = { id: 'cat-123', name: 'New Lib', slug: 'new-lib' };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'lib-id' } } });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { role: 'librarian' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: existingCategory, error: null }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: updatedCategory, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/admin/categories/cat-123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'New Lib' }),
      });
      const res = await PUT(req, { params: Promise.resolve({ id: 'cat-123' }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('New Lib');
    });

    it('returns 400 for invalid JSON body', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-id' } } });
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'super_admin' } }),
          }),
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/admin/categories/cat-123', {
        method: 'PUT',
        body: 'invalid-non-json',
      });
      const res = await PUT(req, { params: Promise.resolve({ id: 'cat-123' }) });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid JSON body');
    });

    it('returns 404 if category to update is not found', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-id' } } });
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { role: 'super_admin' } }),
              }),
            }),
          };
        }
        if (table === 'categories') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
              }),
            }),
          };
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/admin/categories/missing-cat', {
        method: 'PUT',
        body: JSON.stringify({ name: 'New Name' }),
      });
      const res = await PUT(req, { params: Promise.resolve({ id: 'missing-cat' }) });

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Category not found');
    });
  });

  describe('DELETE /api/admin/categories/[id]', () => {
    it('returns 401 Unauthorized for unauthenticated requests', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

      const req = new NextRequest('http://localhost:3000/api/admin/categories/cat-123', { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ id: 'cat-123' }) });

      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden for librarian (DELETE is restricted to super_admin only)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'lib-id' } } });
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { role: 'librarian' } }),
          }),
        }),
      });

      const req = new NextRequest('http://localhost:3000/api/admin/categories/cat-123', { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ id: 'cat-123' }) });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Forbidden');
    });

    it('CRITICAL: allows super_admin to soft delete category (does NOT return 403 Forbidden)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'admin-id' } } });

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { role: 'super_admin' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'categories') {
          return {
            update: updateMock,
          };
        }
        return {};
      });

      const req = new NextRequest('http://localhost:3000/api/admin/categories/cat-123', { method: 'DELETE' });
      const res = await DELETE(req, { params: Promise.resolve({ id: 'cat-123' }) });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(updateMock).toHaveBeenCalledWith({ is_active: false });
    });
  });
});
