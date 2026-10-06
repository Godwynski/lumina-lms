import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createBook,
  updateBook,
  softDeleteBook,
  restoreBook,
  addBookCopies,
  updateBookCopyStatus,
  getBooks,
} from '../catalog';
import { getMe } from '@/lib/auth-helpers';
import { logAuditActivity } from '@/lib/audit';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';
import type { ProfileData, UserRole } from '@/lib/types';

vi.mock('@/lib/auth-helpers', () => ({
  getMe: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditActivity: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: () => unknown) => fn),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Catalog Server Actions', () => {
  let mockClientHelper: MockSupabaseClientHelper;

  const mockStaffUser = (role: UserRole = 'librarian', id = 'librarian-1') => ({
    user: {
      id,
      email: 'librarian@school.edu',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id,
      email: 'librarian@school.edu',
      role,
      status: 'ACTIVE',
      full_name: 'Lead Librarian',
      permissions: {},
    } as unknown as ProfileData & {
      id: string;
      email: string | null;
      role: string;
      status: string;
      permissions: Record<string, boolean> | null;
    },
    role,
    isStaff: true,
    isAdmin: role === 'super_admin',
    isDeactivatedSA: false,
    hasPermission: vi.fn().mockReturnValue(true),
    supabase: mockClientHelper.client,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientHelper = createMockSupabaseClient();

    vi.mocked(getMe).mockResolvedValue(
      mockStaffUser() as unknown as Awaited<ReturnType<typeof getMe>>
    );
    vi.mocked(logAuditActivity).mockResolvedValue(undefined);
  });

  describe('createBook', () => {
    const validBookData = {
      title: 'Operating Systems: Three Easy Pieces',
      author: 'Remzi H. Arpaci-Dusseau',
      isbn: '9781985086593',
      published_year: 2018,
      is_active: true,
      description: 'A comprehensive book on virtualization, concurrency, and persistence.',
    };

    it('rejects invalid inputs failing BookSchema validation (e.g. non-numeric ISBN or empty title)', async () => {
      const invalidData = {
        title: '', // Empty title
        author: 'John Doe',
        isbn: 'ISBN-WITH-LETTERS', // Non-numeric
      };

      const result = await createBook({
        bookData: invalidData,
        copiesCount: 2,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Validation failed');
        expect(result.validationErrors?.['bookData.title']).toBeDefined();
        expect(result.validationErrors?.['bookData.isbn']).toBeDefined();
      }
    });

    it('creates book record and initial copies, and revalidates cache tags', async () => {
      const booksBuilder = mockClientHelper.getTableBuilder('books');
      const copiesBuilder = mockClientHelper.getTableBuilder('book_copies');

      // 1. First .single() call for insert([bookData])
      booksBuilder.single.mockResolvedValueOnce({
        data: { id: 'book-new-uuid', ...validBookData },
        error: null,
      });

      // 2. Second .single() call for refreshing counts
      booksBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'book-new-uuid',
          ...validBookData,
          total_copies: 3,
          available_copies: 3,
          categories: { name: 'Computer Science' },
        },
        error: null,
      });

      const result = await createBook({
        bookData: validBookData,
        copiesCount: 3,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('book-new-uuid');
        expect(result.data.title).toBe(validBookData.title);
      }

      // Initial book insertion
      expect(booksBuilder.insert).toHaveBeenCalledWith([validBookData]);

      // Copy creation: 3 copies created with status 'AVAILABLE'
      expect(copiesBuilder.insert).toHaveBeenCalledWith([
        { book_id: 'book-new-uuid', status: 'AVAILABLE' },
        { book_id: 'book-new-uuid', status: 'AVAILABLE' },
        { book_id: 'book-new-uuid', status: 'AVAILABLE' },
      ]);

      // Revalidates cache tags
      expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
      expect(revalidateTag).toHaveBeenCalledWith('books', 'max');
    });

    it('creates book without copies when copiesCount is 0', async () => {
      const booksBuilder = mockClientHelper.getTableBuilder('books');
      const copiesBuilder = mockClientHelper.getTableBuilder('book_copies');

      booksBuilder.single
        .mockResolvedValueOnce({
          data: { id: 'book-zero-copies', ...validBookData },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'book-zero-copies', ...validBookData, total_copies: 0 },
          error: null,
        });

      const result = await createBook({
        bookData: validBookData,
        copiesCount: 0,
      });

      expect(result.success).toBe(true);
      expect(copiesBuilder.insert).not.toHaveBeenCalled();
    });

    it('rolls back book record creation when copies creation fails', async () => {
      const booksBuilder = mockClientHelper.getTableBuilder('books');
      const copiesBuilder = mockClientHelper.getTableBuilder('book_copies');

      // Book insert succeeds
      booksBuilder.single.mockResolvedValueOnce({
        data: { id: 'book-rollback-uuid', ...validBookData },
        error: null,
      });

      // Copies insert fails
      copiesBuilder.insert.mockReturnValueOnce({
        then: (resolve: (val: unknown) => unknown) =>
          resolve({ data: null, error: { message: 'Foreign key constraint violated' } }),
      } as unknown as ReturnType<typeof copiesBuilder.insert>);

      const result = await createBook({
        bookData: validBookData,
        copiesCount: 2,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Failed to initialize book copies. Transaction rolled back.');
      }

      // Rollback: books table delete was called with book ID
      expect(booksBuilder.delete).toHaveBeenCalled();
      expect(booksBuilder.eq).toHaveBeenCalledWith('id', 'book-rollback-uuid');
    });
  });

  describe('updateBook', () => {
    it('updates book fields and revalidates cache', async () => {
      const booksBuilder = mockClientHelper.getTableBuilder('books');

      // Old data query
      booksBuilder.single.mockResolvedValueOnce({
        data: { id: 'b-1', title: 'Old Title', author: 'Old Author' },
        error: null,
      });

      // Update query
      booksBuilder.single.mockResolvedValueOnce({
        data: { id: 'b-1', title: 'Updated Title', author: 'Old Author' },
        error: null,
      });

      const result = await updateBook({
        id: 'b-1',
        bookData: { title: 'Updated Title' },
      });

      expect(result.success).toBe(true);
      expect(booksBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Updated Title' })
      );
      expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
      expect(revalidateTag).toHaveBeenCalledWith('book-b-1', 'max');
    });
  });

  describe('updateBookCopyStatus', () => {
    it('rejects invalid copy status outside allowed enum (AVAILABLE, BORROWED, MAINTENANCE, LOST)', async () => {
      const result = await updateBookCopyStatus({
        id: 'copy-123',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: 'RESERVED' as any,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Validation failed');
      }
    });

    it('updates copy to MAINTENANCE and closes lingering active or overdue borrows', async () => {
      const copyBuilder = mockClientHelper.getTableBuilder('book_copies');
      const borrowBuilder = mockClientHelper.getTableBuilder('borrowing_records');

      copyBuilder.single.mockResolvedValueOnce({
        data: { id: 'copy-m-1', book_id: 'book-100', status: 'MAINTENANCE' },
        error: null,
      });

      const result = await updateBookCopyStatus({
        id: 'copy-m-1',
        status: 'MAINTENANCE',
      });

      expect(result.success).toBe(true);
      expect(copyBuilder.update).toHaveBeenCalledWith({ status: 'MAINTENANCE' });

      // Closes active/overdue borrows
      expect(borrowBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'RETURNED' })
      );
      expect(borrowBuilder.eq).toHaveBeenCalledWith('book_copy_id', 'copy-m-1');
      expect(borrowBuilder.in).toHaveBeenCalledWith('status', ['ACTIVE', 'OVERDUE']);

      // Revalidates paths
      expect(revalidatePath).toHaveBeenCalledWith('/catalog');
      expect(revalidatePath).toHaveBeenCalledWith('/catalog/book-100');
    });

    it('updates copy to LOST and closes lingering borrows', async () => {
      const copyBuilder = mockClientHelper.getTableBuilder('book_copies');
      const borrowBuilder = mockClientHelper.getTableBuilder('borrowing_records');

      copyBuilder.single.mockResolvedValueOnce({
        data: { id: 'copy-l-1', book_id: 'book-200', status: 'LOST' },
        error: null,
      });

      const result = await updateBookCopyStatus({
        id: 'copy-l-1',
        status: 'LOST',
      });

      expect(result.success).toBe(true);
      expect(borrowBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'RETURNED' })
      );
    });

    it('updates copy to AVAILABLE and closes lingering borrows', async () => {
      const copyBuilder = mockClientHelper.getTableBuilder('book_copies');
      const borrowBuilder = mockClientHelper.getTableBuilder('borrowing_records');

      copyBuilder.single.mockResolvedValueOnce({
        data: { id: 'copy-a-1', book_id: 'book-300', status: 'AVAILABLE' },
        error: null,
      });

      const result = await updateBookCopyStatus({
        id: 'copy-a-1',
        status: 'AVAILABLE',
      });

      expect(result.success).toBe(true);
      expect(borrowBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'RETURNED' })
      );
    });

    it('updates copy to BORROWED without updating borrowing records', async () => {
      const copyBuilder = mockClientHelper.getTableBuilder('book_copies');
      const borrowBuilder = mockClientHelper.getTableBuilder('borrowing_records');

      copyBuilder.single.mockResolvedValueOnce({
        data: { id: 'copy-b-1', book_id: 'book-400', status: 'BORROWED' },
        error: null,
      });

      const result = await updateBookCopyStatus({
        id: 'copy-b-1',
        status: 'BORROWED',
      });

      expect(result.success).toBe(true);
      expect(copyBuilder.update).toHaveBeenCalledWith({ status: 'BORROWED' });
      // Borrowing records should NOT be updated
      expect(borrowBuilder.update).not.toHaveBeenCalled();
    });

    it('rejects status transitions with other invalid states such as RESERVED, PENDING, DELETED, or lowercase available', async () => {
      const invalidStatuses = ['RESERVED', 'PENDING', 'DELETED', 'available', ''];
      for (const invalidStatus of invalidStatuses) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await updateBookCopyStatus({ id: 'copy-inv', status: invalidStatus as any });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error).toMatch(/validation/i);
        }
      }
    });

    it('rejects updateBookCopyStatus when caller is student or student_assistant', async () => {
      vi.mocked(getMe).mockResolvedValue({
        ...mockStaffUser('student_assistant', 'sa-1'),
        role: 'student_assistant',
        isAdmin: false,
      } as unknown as Awaited<ReturnType<typeof getMe>>);

      const result = await updateBookCopyStatus({
        id: 'copy-1',
        status: 'MAINTENANCE',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized access');
      }
    });
  });

  describe('softDeleteBook', () => {
    it('blocks soft deletion when book has active borrowed copies', async () => {
      mockClientHelper.setTableResponse('book_copies', [{ id: 'copy-borrowed' }], null, 2);

      const result = await softDeleteBook('book-with-borrows');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Cannot delete book: There are active borrowed copies.');
      }
      expect(mockClientHelper.getTableBuilder('books').update).not.toHaveBeenCalled();
    });

    it('blocks soft deletion when book has multiple active borrowed copies (stress test count = 5)', async () => {
      mockClientHelper.setTableResponse('book_copies', [], null, 5);

      const result = await softDeleteBook('book-with-many-borrows');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Cannot delete book: There are active borrowed copies.');
      }
      expect(mockClientHelper.getTableBuilder('books').update).not.toHaveBeenCalled();
    });

    it('rejects soft deletion when caller has student_assistant role', async () => {
      vi.mocked(getMe).mockResolvedValue({
        ...mockStaffUser('student_assistant', 'sa-user-1'),
        role: 'student_assistant',
        isAdmin: false,
      } as unknown as Awaited<ReturnType<typeof getMe>>);

      const result = await softDeleteBook('book-target-id');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized access');
      }
    });

    it('propagates error when query for active borrowed copies fails with database error', async () => {
      mockClientHelper.setTableResponse('book_copies', null, { message: 'Database connection failed' });

      const result = await softDeleteBook('book-db-err');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Database connection failed');
      }
    });

    it('successfully soft deletes book by setting is_active = false when no copies are borrowed', async () => {
      mockClientHelper.setTableResponse('book_copies', [], null, 0);

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      booksBuilder.single.mockResolvedValueOnce({
        data: { id: 'book-to-delete', title: 'Calculus', is_active: false },
        error: null,
      });

      const result = await softDeleteBook('book-to-delete');

      expect(result.success).toBe(true);
      expect(booksBuilder.update).toHaveBeenCalledWith({ is_active: false });
      expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
      expect(revalidateTag).toHaveBeenCalledWith('books', 'max');
    });
  });

  describe('restoreBook', () => {
    it('restores soft-deleted book by setting is_active = true and revalidating cache', async () => {
      const booksBuilder = mockClientHelper.getTableBuilder('books');
      booksBuilder.single.mockResolvedValueOnce({
        data: { id: 'book-to-restore', title: 'Linear Algebra', is_active: true },
        error: null,
      });

      const result = await restoreBook('book-to-restore');

      expect(result.success).toBe(true);
      expect(booksBuilder.update).toHaveBeenCalledWith({ is_active: true });
      expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
      expect(revalidateTag).toHaveBeenCalledWith('books', 'max');
    });

    it('rejects restoreBook when caller is student_assistant', async () => {
      vi.mocked(getMe).mockResolvedValue({
        ...mockStaffUser('student_assistant', 'sa-user-2'),
        role: 'student_assistant',
        isAdmin: false,
      } as unknown as Awaited<ReturnType<typeof getMe>>);

      const result = await restoreBook('book-restore-target');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized access');
      }
    });
  });

  describe('addBookCopies', () => {
    it('rejects copy count outside 1..50 bounds', async () => {
      const resultZero = await addBookCopies({ bookId: 'b-1', copiesCount: 0 });
      expect(resultZero.success).toBe(false);

      const resultOverMax = await addBookCopies({ bookId: 'b-1', copiesCount: 51 });
      expect(resultOverMax.success).toBe(false);
    });

    it('adds valid number of copies with default status AVAILABLE and revalidates paths', async () => {
      const copiesBuilder = mockClientHelper.getTableBuilder('book_copies');
      copiesBuilder.insert.mockReturnValueOnce({
        then: (resolve: (val: unknown) => unknown) => resolve({ data: [], error: null }),
      } as unknown as ReturnType<typeof copiesBuilder.insert>);

      const result = await addBookCopies({
        bookId: 'book-target-uuid',
        copiesCount: 5,
      });

      expect(result.success).toBe(true);
      expect(copiesBuilder.insert).toHaveBeenCalledWith(
        Array(5).fill({ book_id: 'book-target-uuid', status: 'AVAILABLE' })
      );
      expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
      expect(revalidateTag).toHaveBeenCalledWith('book-book-target-uuid', 'max');
      expect(revalidatePath).toHaveBeenCalledWith('/catalog/book-target-uuid');
    });
  });

  describe('getBooks', () => {
    it('enforces staff-only access and throws Unauthorized if caller is student', async () => {
      vi.mocked(getMe).mockResolvedValue({
        user: { id: 'student-id' },
        role: 'student',
        isStaff: false,
      } as unknown as Awaited<ReturnType<typeof getMe>>);

      await expect(getBooks()).rejects.toThrow('Unauthorized');
    });

    it('queries books with pagination and active status filter', async () => {
      const mockBookList = [
        { id: 'b-1', title: 'Algorithms', is_active: true },
        { id: 'b-2', title: 'Data Structures', is_active: true },
      ];
      mockClientHelper.setTableResponse('books', mockBookList, null, 2);

      const response = await getBooks('', undefined, 1, 10, 'title_asc', 'ACTIVE');

      expect(response).toEqual({
        data: mockBookList,
        count: 2,
      });
      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.eq).toHaveBeenCalledWith('is_active', true);
      expect(booksBuilder.range).toHaveBeenCalledWith(0, 9);
    });
  });
});
