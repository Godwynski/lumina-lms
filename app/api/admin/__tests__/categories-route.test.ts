import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getCategories, POST as postCategory } from '../categories/route';
import {
  GET as getCategoryById,
  PUT as putCategoryById,
  DELETE as deleteCategoryById,
} from '../categories/[id]/route';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/auth-helpers';
import { logAuditActivity } from '@/lib/audit';
import { revalidatePath, revalidateTag } from 'next/cache';
import { isAbortError } from '@/lib/error-utils';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/auth-helpers', () => ({
  assertRole: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditActivity: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/error-utils', () => ({
  isAbortError: vi.fn(),
}));

describe('Admin Categories API Routes (/api/admin/categories & /api/admin/categories/[id])', () => {
  let mockSupabaseHelper: MockSupabaseClientHelper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseHelper = createMockSupabaseClient();
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseHelper.client as unknown as Awaited<ReturnType<typeof createClient>>
    );
    vi.mocked(logAuditActivity).mockResolvedValue(undefined);
    vi.mocked(isAbortError).mockReturnValue(false);
  });

  const createJsonRequest = (url: string, method: string, body?: unknown): NextRequest => {
    return new Request(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }) as unknown as NextRequest;
  };

  const createParams = (id: string): { params: Promise<{ id: string }> } => ({
    params: Promise.resolve({ id }),
  });

  describe('GET /api/admin/categories', () => {
    it('returns 200 with categories list when accessed by super_admin', async () => {
      vi.mocked(assertRole).mockResolvedValue({
        user: { id: 'admin-1' },
        role: 'super_admin',
        supabase: mockSupabaseHelper.client,
      } as unknown as Awaited<ReturnType<typeof assertRole>>);

      const sampleCategories = [
        { id: 'cat-1', name: 'Computer Science', slug: 'computer-science', is_active: true },
        { id: 'cat-2', name: 'Philosophy', slug: 'philosophy', is_active: true },
      ];

      const catBuilder = mockSupabaseHelper.getTableBuilder('categories');
      catBuilder.order.mockResolvedValue({ data: sampleCategories, error: null });

      const res = await getCategories();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual(sampleCategories);
      expect(assertRole).toHaveBeenCalledWith(['super_admin', 'librarian']);
      expect(catBuilder.order).toHaveBeenCalledWith('name');
    });

    it('returns 200 with categories list when accessed by librarian', async () => {
      vi.mocked(assertRole).mockResolvedValue({
        user: { id: 'lib-1' },
        role: 'librarian',
        supabase: mockSupabaseHelper.client,
      } as unknown as Awaited<ReturnType<typeof assertRole>>);

      const catBuilder = mockSupabaseHelper.getTableBuilder('categories');
      catBuilder.order.mockResolvedValue({ data: [], error: null });

      const res = await getCategories();
      expect(res.status).toBe(200);
    });

    it('returns 500 when assertRole rejects unauthorized patron', async () => {
      vi.mocked(assertRole).mockRejectedValue(new Error('Forbidden'));

      const res = await getCategories();
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe('Failed to fetch categories');
    });

    it('returns 499 status when an abort error is encountered', async () => {
      vi.mocked(assertRole).mockImplementation(() => {
        const abortErr = new Error('Client aborted');
        vi.mocked(isAbortError).mockReturnValue(true);
        throw abortErr;
      });

      const res = await getCategories();
      expect(res.status).toBe(499);
    });
  });

  describe('POST /api/admin/categories', () => {
    beforeEach(() => {
      vi.mocked(assertRole).mockResolvedValue({
        user: { id: 'admin-1' },
        role: 'super_admin',
        supabase: mockSupabaseHelper.client,
      } as unknown as Awaited<ReturnType<typeof assertRole>>);
    });

    it('rejects malformed non-JSON requests with 400', async () => {
      const invalidReq = new Request('http://localhost/api/admin/categories', {
        method: 'POST',
        body: 'invalid-non-json-string',
      }) as unknown as NextRequest;

      const res = await postCategory(invalidReq);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid JSON body');
    });

    it('rejects schema validation failure when name is missing or empty with 400', async () => {
      const req = createJsonRequest('http://localhost/api/admin/categories', 'POST', {
        name: '',
        description: 'No name category',
      });

      const res = await postCategory(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('creates new category, invokes audit log, and triggers tag revalidation', async () => {
      const newCategoryPayload = {
        name: 'Artificial Intelligence',
        description: 'Machine learning, robotics, and neural networks',
      };
      const createdCategory = {
        id: 'cat-ai-1',
        name: 'Artificial Intelligence',
        slug: 'artificial-intelligence',
        description: 'Machine learning, robotics, and neural networks',
        is_active: true,
      };

      const catBuilder = mockSupabaseHelper.getTableBuilder('categories');
      catBuilder.single.mockResolvedValue({ data: createdCategory, error: null });

      const req = createJsonRequest(
        'http://localhost/api/admin/categories',
        'POST',
        newCategoryPayload
      );

      const res = await postCategory(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data).toEqual(createdCategory);
      expect(catBuilder.insert).toHaveBeenCalledWith([
        {
          name: 'Artificial Intelligence',
          slug: 'artificial-intelligence',
          description: 'Machine learning, robotics, and neural networks',
          is_active: true,
        },
      ]);
      expect(logAuditActivity).toHaveBeenCalledWith(
        'admin-1',
        'category',
        'cat-ai-1',
        'category_created',
        'Created book category: Artificial Intelligence',
        { slug: 'artificial-intelligence', description: newCategoryPayload.description },
        null,
        createdCategory
      );
      expect(revalidateTag).toHaveBeenCalledWith('categories', 'default');
      expect(revalidatePath).toHaveBeenCalledWith('/catalog', 'page');
    });
  });

  describe('GET /api/admin/categories/[id]', () => {
    it('returns 401 Unauthorized when user session is missing', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = createJsonRequest('http://localhost/api/admin/categories/cat-1', 'GET');
      const res = await getCategoryById(req, createParams('cat-1'));
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns 403 Forbidden when user is a student', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'student-1' } },
        error: null,
      });
      mockSupabaseHelper.setTableResponse('profiles', { role: 'student' });

      const req = createJsonRequest('http://localhost/api/admin/categories/cat-1', 'GET');
      const res = await getCategoryById(req, createParams('cat-1'));
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('returns 200 and category details for super_admin (verifying role fix)', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-1' } },
        error: null,
      });
      mockSupabaseHelper.setTableResponse('profiles', { role: 'super_admin' });

      const category = { id: 'cat-1', name: 'Science', slug: 'science', is_active: true };
      mockSupabaseHelper.setTableResponse('categories', category);

      const req = createJsonRequest('http://localhost/api/admin/categories/cat-1', 'GET');
      const res = await getCategoryById(req, createParams('cat-1'));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual(category);
    });

    it('returns 200 and category details for librarian', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'lib-1' } },
        error: null,
      });
      mockSupabaseHelper.setTableResponse('profiles', { role: 'librarian' });

      const category = { id: 'cat-1', name: 'Science', slug: 'science', is_active: true };
      mockSupabaseHelper.setTableResponse('categories', category);

      const req = createJsonRequest('http://localhost/api/admin/categories/cat-1', 'GET');
      const res = await getCategoryById(req, createParams('cat-1'));

      expect(res.status).toBe(200);
    });

    it('returns 404 Not found when category record is missing', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-1' } },
        error: null,
      });
      mockSupabaseHelper.setTableResponse('profiles', { role: 'super_admin' });
      mockSupabaseHelper.setTableResponse('categories', null);

      const req = createJsonRequest('http://localhost/api/admin/categories/missing-cat', 'GET');
      const res = await getCategoryById(req, createParams('missing-cat'));
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe('Not found');
    });
  });

  describe('PUT /api/admin/categories/[id]', () => {
    it('returns 401 Unauthorized when user session is not present', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = createJsonRequest('http://localhost/api/admin/categories/cat-1', 'PUT', {
        name: 'Updated Name',
      });
      const res = await putCategoryById(req, createParams('cat-1'));
      expect(res.status).toBe(401);
    });

    it('returns 403 Forbidden when user is a student', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'student-1' } },
        error: null,
      });
      mockSupabaseHelper.setTableResponse('profiles', { role: 'student' });

      const req = createJsonRequest('http://localhost/api/admin/categories/cat-1', 'PUT', {
        name: 'Updated Name',
      });
      const res = await putCategoryById(req, createParams('cat-1'));
      expect(res.status).toBe(403);
    });

    it('returns 400 for invalid JSON body', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-1' } },
        error: null,
      });
      mockSupabaseHelper.setTableResponse('profiles', { role: 'super_admin' });

      const invalidReq = new Request('http://localhost/api/admin/categories/cat-1', {
        method: 'PUT',
        body: 'invalid-json',
      }) as unknown as NextRequest;

      const res = await putCategoryById(invalidReq, createParams('cat-1'));
      const data = await res.json();
      expect(res.status).toBe(400);
      expect(data.error).toBe('Invalid JSON body');
    });

    it('returns 404 when target category does not exist in database', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-1' } },
        error: null,
      });
      mockSupabaseHelper.setTableResponse('profiles', { role: 'super_admin' });
      // Existing category check returns null
      mockSupabaseHelper.setTableResponse('categories', null);

      const req = createJsonRequest('http://localhost/api/admin/categories/missing', 'PUT', {
        name: 'New Name',
      });
      const res = await putCategoryById(req, createParams('missing'));
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe('Category not found');
    });

    it('updates category successfully for super_admin (verifying super_admin role fix)', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-1' } },
        error: null,
      });
      mockSupabaseHelper.setTableResponse('profiles', { role: 'super_admin' });

      const existingCategory = {
        id: 'cat-1',
        name: 'Old Name',
        slug: 'old-name',
        description: 'Old desc',
        is_active: true,
      };
      const updatedCategory = {
        id: 'cat-1',
        name: 'Renewed Name',
        slug: 'renewed-name',
        description: 'Updated desc',
        is_active: true,
      };

      const catBuilder = mockSupabaseHelper.getTableBuilder('categories');
      // First select returns existing, update.select.single returns updated
      catBuilder.single
        .mockResolvedValueOnce({ data: existingCategory, error: null })
        .mockResolvedValueOnce({ data: updatedCategory, error: null });

      const req = createJsonRequest('http://localhost/api/admin/categories/cat-1', 'PUT', {
        name: 'Renewed Name',
        slug: 'renewed-name',
        description: 'Updated desc',
      });
      const res = await putCategoryById(req, createParams('cat-1'));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual(updatedCategory);
      expect(catBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Renewed Name',
          slug: 'renewed-name',
          description: 'Updated desc',
          is_active: true,
        })
      );
    });

    it('preserves existing slug when slug is omitted in partial update', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-1' } },
        error: null,
      });
      mockSupabaseHelper.setTableResponse('profiles', { role: 'super_admin' });

      const existingCategory = {
        id: 'cat-1',
        name: 'Old Name',
        slug: 'existing-preserved-slug',
        description: 'Old desc',
        is_active: true,
      };

      const catBuilder = mockSupabaseHelper.getTableBuilder('categories');
      catBuilder.single
        .mockResolvedValueOnce({ data: existingCategory, error: null })
        .mockResolvedValueOnce({ data: existingCategory, error: null });

      const req = createJsonRequest('http://localhost/api/admin/categories/cat-1', 'PUT', {
        name: 'Updated Name Only',
      });
      await putCategoryById(req, createParams('cat-1'));

      expect(catBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name Only',
          slug: 'existing-preserved-slug',
        })
      );
    });

    it('permits librarian to update category', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'lib-1' } },
        error: null,
      });
      mockSupabaseHelper.setTableResponse('profiles', { role: 'librarian' });

      const existingCategory = {
        id: 'cat-1',
        name: 'Librarian Edited',
        slug: 'librarian-edited',
        description: 'desc',
        is_active: true,
      };

      const catBuilder = mockSupabaseHelper.getTableBuilder('categories');
      catBuilder.single
        .mockResolvedValueOnce({ data: existingCategory, error: null })
        .mockResolvedValueOnce({ data: existingCategory, error: null });

      const req = createJsonRequest('http://localhost/api/admin/categories/cat-1', 'PUT', {
        name: 'Librarian Edited',
      });
      const res = await putCategoryById(req, createParams('cat-1'));

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/admin/categories/[id]', () => {
    it('returns 401 Unauthorized when user session is missing', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const req = createJsonRequest('http://localhost/api/admin/categories/cat-1', 'DELETE');
      const res = await deleteCategoryById(req, createParams('cat-1'));
      expect(res.status).toBe(401);
    });

    it('blocks librarian from deleting category with 403 Forbidden', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'lib-1' } },
        error: null,
      });
      mockSupabaseHelper.setTableResponse('profiles', { role: 'librarian' });

      const req = createJsonRequest('http://localhost/api/admin/categories/cat-1', 'DELETE');
      const res = await deleteCategoryById(req, createParams('cat-1'));
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toBe('Forbidden');
    });

    it('blocks student from deleting category with 403 Forbidden', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'stu-1' } },
        error: null,
      });
      mockSupabaseHelper.setTableResponse('profiles', { role: 'student' });

      const req = createJsonRequest('http://localhost/api/admin/categories/cat-1', 'DELETE');
      const res = await deleteCategoryById(req, createParams('cat-1'));

      expect(res.status).toBe(403);
    });

    it('permits super_admin to soft delete category (verifying super_admin role fix)', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: { id: 'admin-1' } },
        error: null,
      });
      mockSupabaseHelper.setTableResponse('profiles', { role: 'super_admin' });

      const catBuilder = mockSupabaseHelper.getTableBuilder('categories');
      catBuilder.update.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const req = createJsonRequest('http://localhost/api/admin/categories/cat-1', 'DELETE');
      const res = await deleteCategoryById(req, createParams('cat-1'));
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(catBuilder.update).toHaveBeenCalledWith({ is_active: false });
    });
  });
});
