import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabaseClient, createMockQueryBuilder, type MockSupabaseClientHelper, type MockSupabaseQueryBuilder } from '@/test/mocks/supabase';

const mockRevalidateTag = vi.fn();
const mockRevalidatePath = vi.fn();
const mockLogAuditActivity = vi.fn().mockResolvedValue(undefined);
const mockFetchImage = vi.fn();
const mockSharpToBuffer = vi.fn().mockResolvedValue(Buffer.from('webp-data'));
const mockSharp = vi.fn((..._args: unknown[]) => ({ webp: vi.fn(() => ({ toBuffer: mockSharpToBuffer })) }));

let serverClientHelper: MockSupabaseClientHelper;
let safeClientHelper: MockSupabaseClientHelper;
let adminClientHelper: MockSupabaseClientHelper;

vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => serverClientHelper.client),
  createSafeClient: vi.fn(() => safeClientHelper.client),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => adminClientHelper.client),
}));

vi.mock('@/lib/audit', () => ({
  logAuditActivity: (...args: unknown[]) => mockLogAuditActivity(...args),
}));

vi.mock('@/lib/fetch-image', () => ({
  fetchImage: (...args: unknown[]) => mockFetchImage(...args),
}));

vi.mock('sharp', () => ({
  default: (...args: unknown[]) => mockSharp(...args),
}));

import { fetchBooksCore, fetchCategoriesCore } from '@/lib/actions/books-core';
import { assertStaffCatalogAccess } from '@/lib/actions/catalog/auth';
import { getCategories, getOrCreateCategoryByName } from '@/lib/actions/catalog/categories';
import { getBooks, createBook, updateBook, softDeleteBook, restoreBook } from '@/lib/actions/catalog/books';
import { addBookCopies, updateBookCopyStatus, getBookPublicDetails, getBookAdminDetails } from '@/lib/actions/catalog/copies';
import { getBooksForExport, batchImportBooks, lookupAndImportISBN } from '@/lib/actions/catalog/import-export';
import { getPublicBooksCached, getPublicBookById, getCategoriesCached } from '@/lib/actions/public-catalog';
import * as catalogFacade from '@/lib/actions/catalog';

function setAuthUser(
  helper: MockSupabaseClientHelper,
  user: { id: string; email?: string; app_metadata?: Record<string, unknown> } | null,
  profile: { id: string; role: string; status: string; permissions?: Record<string, boolean> | null } | null
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

function queueTableBuilders(
  helper: MockSupabaseClientHelper,
  table: string,
  builders: MockSupabaseQueryBuilder[]
) {
  const queue = [...builders];
  const fallback = helper.getTableBuilder(table);
  const prevImpl = helper.from.getMockImplementation();
  helper.from.mockImplementation((requestedTable: string) => {
    if (requestedTable === table) {
      return queue.shift() ?? fallback;
    }
    if (prevImpl) {
      return prevImpl(requestedTable);
    }
    return helper.getTableBuilder(requestedTable);
  });
}

describe('Catalog & Books Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverClientHelper = createMockSupabaseClient();
    safeClientHelper = createMockSupabaseClient();
    adminClientHelper = createMockSupabaseClient();
    vi.stubGlobal('fetch', vi.fn());
  });

  describe('Catalog Facade (lib/actions/catalog.ts)', () => {
    it('re-exports all modular catalog server actions', () => {
      expect(catalogFacade.getCategories).toBe(getCategories);
      expect(catalogFacade.getOrCreateCategoryByName).toBe(getOrCreateCategoryByName);
      expect(catalogFacade.getBooks).toBe(getBooks);
      expect(catalogFacade.createBook).toBe(createBook);
      expect(catalogFacade.updateBook).toBe(updateBook);
      expect(catalogFacade.softDeleteBook).toBe(softDeleteBook);
      expect(catalogFacade.restoreBook).toBe(restoreBook);
      expect(catalogFacade.updateBookCopyStatus).toBe(updateBookCopyStatus);
      expect(catalogFacade.addBookCopies).toBe(addBookCopies);
      expect(catalogFacade.getBookPublicDetails).toBe(getBookPublicDetails);
      expect(catalogFacade.getBookAdminDetails).toBe(getBookAdminDetails);
      expect(catalogFacade.getBooksForExport).toBe(getBooksForExport);
      expect(catalogFacade.batchImportBooks).toBe(batchImportBooks);
      expect(catalogFacade.lookupAndImportISBN).toBe(lookupAndImportISBN);
    });
  });

  describe('assertStaffCatalogAccess (lib/actions/catalog/auth.ts)', () => {
    it('throws Unauthorized when unauthenticated or when user is a student', async () => {
      setAuthUser(serverClientHelper, null, null);
      await expect(assertStaffCatalogAccess()).rejects.toThrow('Unauthorized');

      setAuthUser(
        serverClientHelper,
        { id: 'stu-1' },
        { id: 'stu-1', role: 'student', status: 'ACTIVE' }
      );
      await expect(assertStaffCatalogAccess(true)).rejects.toThrow('Unauthorized');
    });

    it('denies student_assistant when allowAssistants is false, allows when true', async () => {
      setAuthUser(
        serverClientHelper,
        { id: 'sa-1' },
        { id: 'sa-1', role: 'student_assistant', status: 'ACTIVE' }
      );

      await expect(assertStaffCatalogAccess(false)).rejects.toThrow(
        'Access denied: Inventory management is restricted to authorized staff roles.'
      );
      const client = await assertStaffCatalogAccess(true);
      expect(client).toBe(serverClientHelper.client);
    });

    it('allows librarian and super_admin without allowAssistants', async () => {
      setAuthUser(
        serverClientHelper,
        { id: 'lib-1' },
        { id: 'lib-1', role: 'librarian', status: 'ACTIVE' }
      );
      expect(await assertStaffCatalogAccess()).toBe(serverClientHelper.client);

      setAuthUser(
        serverClientHelper,
        { id: 'sa-admin' },
        { id: 'sa-admin', role: 'super_admin', status: 'ACTIVE' }
      );
      expect(await assertStaffCatalogAccess()).toBe(serverClientHelper.client);
    });
  });

  describe('books-core (fetchBooksCore & fetchCategoriesCore)', () => {
    it('applies default filters, pagination, and computes hasMore', async () => {
      const books = [{ id: 'b1', title: 'Alpha' }, { id: 'b2', title: 'Beta' }];
      safeClientHelper.setTableResponse('books', books, null, 5);

      const res = await fetchBooksCore(
        { page: 1, pageSize: 2 },
        'id, title',
        safeClientHelper.client as never
      );

      const builder = safeClientHelper.getTableBuilder('books');
      expect(builder.select).toHaveBeenCalledWith('id, title', { count: 'exact' });
      expect(builder.eq).toHaveBeenCalledWith('is_active', true);
      expect(builder.order).toHaveBeenCalledWith('title', { ascending: true });
      expect(builder.range).toHaveBeenCalledWith(0, 1);
      expect(res).toEqual({ books, total: 5, hasMore: true });
    });

    it('uses title-only ilike for short (<3 char) queries and sanitized OR filter for longer queries', async () => {
      safeClientHelper.setTableResponse('books', [], null, 0);
      await fetchBooksCore({ query: 'ab' }, '*', safeClientHelper.client as never);
      const builder = safeClientHelper.getTableBuilder('books');
      expect(builder.ilike).toHaveBeenCalledWith('title', '%ab%');
      expect(builder.or).not.toHaveBeenCalled();

      vi.clearAllMocks();
      safeClientHelper = createMockSupabaseClient();
      safeClientHelper.setTableResponse('books', [], null, 0);
      await fetchBooksCore(
        {
          query: 'Dr. Seuss (100%)',
          categoryId: 'cat-1,cat-2',
          section: 'Fiction',
          availableOnly: true,
          sortBy: 'author',
          sortOrder: 'desc',
          status: 'ARCHIVED',
        },
        '*',
        safeClientHelper.client as never
      );

      const b2 = safeClientHelper.getTableBuilder('books');
      expect(b2.eq).toHaveBeenCalledWith('is_active', false);
      expect(b2.or).toHaveBeenCalledWith(
        'title.ilike.%Dr_ Seuss _100__%,author.ilike.%Dr_ Seuss _100__%,isbn.ilike.%Dr_ Seuss _100__%'
      );
      expect(b2.in).toHaveBeenCalledWith('category_id', ['cat-1', 'cat-2']);
      expect(b2.eq).toHaveBeenCalledWith('section', 'Fiction');
      expect(b2.gt).toHaveBeenCalledWith('available_copies', 0);
      expect(b2.order).toHaveBeenCalledWith('author', { ascending: false });
    });

    it('skips status filter when status is ALL and supports availability and created_at sorting', async () => {
      safeClientHelper.setTableResponse('books', [], null, 0);
      await fetchBooksCore(
        { status: 'ALL', categoryId: 'all', sortBy: 'availability', sortOrder: 'desc' },
        '*',
        safeClientHelper.client as never
      );
      const b1 = safeClientHelper.getTableBuilder('books');
      expect(b1.eq).not.toHaveBeenCalledWith('is_active', expect.anything());
      expect(b1.in).not.toHaveBeenCalled();
      expect(b1.order).toHaveBeenCalledWith('available_copies', { ascending: false });

      safeClientHelper = createMockSupabaseClient();
      safeClientHelper.setTableResponse('books', [], null, 0);
      await fetchBooksCore({ sortBy: 'created_at', sortOrder: 'desc' }, '*', safeClientHelper.client as never);
      expect(safeClientHelper.getTableBuilder('books').order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('uses search_book_ids RPC for relevance sort and preserves rank order', async () => {
      safeClientHelper.setRpcResponse(
        [
          { id: 'b2', total_count: 3 },
          { id: 'b1', total_count: 3 },
        ],
        null,
        'search_book_ids'
      );
      safeClientHelper.setTableResponse('books', [
        { id: 'b1', title: 'First Alpha' },
        { id: 'b2', title: 'Exact Match' },
      ]);

      const res = await fetchBooksCore(
        { query: 'Match', sortBy: 'relevance', page: 1, pageSize: 2, categoryId: 'c1', section: 'Ref', availableOnly: true },
        'id, title',
        safeClientHelper.client as never
      );

      expect(safeClientHelper.rpc).toHaveBeenCalledWith('search_book_ids', {
        p_query: 'Match',
        p_status: 'ACTIVE',
        p_category_ids: ['c1'],
        p_section: 'Ref',
        p_available_only: true,
        p_offset: 0,
        p_limit: 2,
      });
      expect(res.books.map((b) => b.id)).toEqual(['b2', 'b1']);
      expect(res.total).toBe(3);
      expect(res.hasMore).toBe(true);
    });

    it('handles empty page > 1 in relevance search by querying page 1 total_count', async () => {
      safeClientHelper.rpc
        .mockResolvedValueOnce({ data: [], error: null })
        .mockResolvedValueOnce({ data: [{ total_count: '4' }], error: null });

      const res = await fetchBooksCore(
        { query: 'Match', sortBy: 'relevance', page: 3, pageSize: 2 },
        '*',
        safeClientHelper.client as never
      );

      expect(safeClientHelper.rpc).toHaveBeenCalledTimes(2);
      expect(res).toEqual({ books: [], total: 4, hasMore: false });
    });

    it('falls back to plain search when search_book_ids RPC fails and throws on books query error', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      safeClientHelper.setRpcResponse(null, { message: 'function not found' }, 'search_book_ids');
      safeClientHelper.setTableResponse('books', [{ id: 'b1', title: 'Fallback' }], null, 1);

      const res = await fetchBooksCore(
        { query: 'Fallback', sortBy: 'relevance' },
        '*',
        safeClientHelper.client as never
      );

      expect(res.books).toHaveLength(1);
      expect(safeClientHelper.getTableBuilder('books').or).toHaveBeenCalled();
      warnSpy.mockRestore();

      safeClientHelper.setTableResponse('books', null, { message: 'DB failure' });
      await expect(
        fetchBooksCore({ query: 'abc' }, '*', safeClientHelper.client as never)
      ).rejects.toThrow('DB failure');
    });

    it('fetchCategoriesCore returns sorted categories and throws on error', async () => {
      const categories = [{ id: 'c1', name: 'Art' }];
      safeClientHelper.setTableResponse('categories', categories, null);

      expect(await fetchCategoriesCore()).toEqual(categories);
      expect(safeClientHelper.getTableBuilder('categories').order).toHaveBeenCalledWith('name');

      safeClientHelper.setTableResponse('categories', null, { message: 'Cat DB error' });
      await expect(fetchCategoriesCore()).rejects.toThrow('Cat DB error');
    });
  });

  describe('Categories Actions (lib/actions/catalog/categories.ts)', () => {
    it('getCategories fetches ordered categories and throws on error', async () => {
      const cats = [{ id: 'c1', name: 'Science', slug: 'science', is_active: true }];
      safeClientHelper.setTableResponse('categories', cats, null);

      expect(await getCategories()).toEqual(cats);

      safeClientHelper.setTableResponse('categories', null, { message: 'Category error' });
      await expect(getCategories()).rejects.toThrow('Category error');
    });

    it('getOrCreateCategoryByName returns null for blank names and returns existing ID if found', async () => {
      const mockClient = createMockSupabaseClient();
      expect(await getOrCreateCategoryByName(mockClient.client as never, '   ')).toBeNull();

      mockClient.setTableResponse('categories', { id: 'cat-existing' }, null);
      const id = await getOrCreateCategoryByName(mockClient.client as never, '  Computer Science ');
      expect(id).toBe('cat-existing');
      expect(mockClient.getTableBuilder('categories').insert).not.toHaveBeenCalled();
    });

    it('getOrCreateCategoryByName inserts new category with slug and revalidates tag', async () => {
      const mockClient = createMockSupabaseClient();
      const lookupBuilder = createMockQueryBuilder(null, null);
      const insertBuilder = createMockQueryBuilder({ id: 'cat-new' }, null);
      queueTableBuilders(mockClient, 'categories', [lookupBuilder, insertBuilder]);

      const id = await getOrCreateCategoryByName(mockClient.client as never, 'Sci-Fi & Fantasy');
      expect(id).toBe('cat-new');
      expect(insertBuilder.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'Sci-Fi & Fantasy',
          slug: 'sci-fi-fantasy',
          is_active: true,
        }),
      ]);
      expect(mockRevalidateTag).toHaveBeenCalledWith('categories', 'max');
    });

    it('getOrCreateCategoryByName handles concurrent insert conflict via retry lookup and throws if retry misses', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockClient = createMockSupabaseClient();
      const b1 = createMockQueryBuilder(null, null);
      const b2 = createMockQueryBuilder(null, { message: 'duplicate key' });
      const b3 = createMockQueryBuilder({ id: 'cat-race' }, null);
      queueTableBuilders(mockClient, 'categories', [b1, b2, b3]);

      expect(await getOrCreateCategoryByName(mockClient.client as never, 'History')).toBe('cat-race');

      const mockClientFail = createMockSupabaseClient();
      queueTableBuilders(mockClientFail, 'categories', [
        createMockQueryBuilder(null, null),
        createMockQueryBuilder(null, { message: 'insert denied' }),
        createMockQueryBuilder(null, null),
      ]);
      await expect(
        getOrCreateCategoryByName(mockClientFail.client as never, 'History')
      ).rejects.toThrow('Failed to create category "History": insert denied');
      errSpy.mockRestore();
    });
  });

  describe('Books Actions (lib/actions/catalog/books.ts)', () => {
    const validBookData = {
      title: 'Clean Architecture',
      author: 'Robert C. Martin',
      isbn: '978-0134494166',
      is_active: true,
    };

    it('getBooks enforces staff access (including active student_assistant) and maps sort modes', async () => {
      setAuthUser(serverClientHelper, { id: 'stu-1' }, { id: 'stu-1', role: 'student', status: 'ACTIVE' });
      await expect(getBooks()).rejects.toThrow('Unauthorized');

      setAuthUser(
        serverClientHelper,
        { id: 'sa-1' },
        { id: 'sa-1', role: 'student_assistant', status: 'ACTIVE' }
      );
      serverClientHelper.setTableResponse('books', [{ id: 'b1', title: 'Clean' }], null, 1);

      const res = await getBooks('', undefined, 2, 5, 'availability_desc', 'ARCHIVED');
      expect(res).toEqual({ data: [{ id: 'b1', title: 'Clean' }], count: 1 });
      const b = serverClientHelper.getTableBuilder('books');
      expect(b.eq).toHaveBeenCalledWith('is_active', false);
      expect(b.order).toHaveBeenCalledWith('available_copies', { ascending: false });
      expect(b.range).toHaveBeenCalledWith(5, 9);
    });

    it('createBook validates inputs and enforces RBAC', async () => {
      setAuthUser(serverClientHelper, null, null);
      expect(await createBook({ bookData: validBookData, copiesCount: 1 })).toEqual({
        success: false,
        error: 'Authentication required',
      });

      setAuthUser(serverClientHelper, { id: 'sa-1' }, { id: 'sa-1', role: 'student_assistant', status: 'ACTIVE' });
      expect(await createBook({ bookData: validBookData, copiesCount: 1 })).toEqual({
        success: false,
        error: 'Unauthorized access',
      });

      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });
      const badValidation = await createBook({
        bookData: { title: '', author: '', isbn: 'INVALID@ISBN', is_active: true },
        copiesCount: -1,
      });
      expect(badValidation.success).toBe(false);
      if (!badValidation.success) {
        expect(badValidation.error).toBe('Validation failed');
        expect(badValidation.validationErrors).toBeDefined();
      }
    });

    it('createBook creates book and physical copies, refreshes record, logs audit, and revalidates', async () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });

      const insertBookBuilder = createMockQueryBuilder({ id: 'book-1', title: 'Clean Architecture' }, null);
      const refreshBookBuilder = createMockQueryBuilder(
        { id: 'book-1', title: 'Clean Architecture', categories: { name: 'CS' } },
        null
      );
      queueTableBuilders(serverClientHelper, 'books', [insertBookBuilder, refreshBookBuilder]);
      serverClientHelper.setTableResponse('book_copies', null, null);

      const res = await createBook({ bookData: validBookData, copiesCount: 3 });

      expect(res.success).toBe(true);
      expect(res.data).toEqual({ id: 'book-1', title: 'Clean Architecture', categories: { name: 'CS' } });
      expect(serverClientHelper.getTableBuilder('book_copies').insert).toHaveBeenCalledWith([
        { book_id: 'book-1', status: 'AVAILABLE' },
        { book_id: 'book-1', status: 'AVAILABLE' },
        { book_id: 'book-1', status: 'AVAILABLE' },
      ]);
      expect(mockRevalidateTag).toHaveBeenCalledWith('catalog', 'max');
      expect(mockRevalidateTag).toHaveBeenCalledWith('books', 'max');
      expect(mockLogAuditActivity).toHaveBeenCalledWith(
        'lib-1',
        'book',
        'book-1',
        'create',
        'Created new book: Clean Architecture',
        { isbn: '978-0134494166' },
        null,
        expect.objectContaining({ copies_created: 3 })
      );
      infoSpy.mockRestore();
    });

    it('createBook rolls back book record if copy creation fails', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });

      const insertBookBuilder = createMockQueryBuilder({ id: 'book-rollback' }, null);
      const deleteBookBuilder = createMockQueryBuilder(null, null);
      queueTableBuilders(serverClientHelper, 'books', [insertBookBuilder, deleteBookBuilder]);
      serverClientHelper.setTableResponse('book_copies', null, { message: 'Copy insert error' });

      const res = await createBook({ bookData: validBookData, copiesCount: 2 });

      expect(res).toEqual({
        success: false,
        error: 'Failed to initialize book copies. Transaction rolled back.',
      });
      expect(deleteBookBuilder.delete).toHaveBeenCalled();
      expect(deleteBookBuilder.eq).toHaveBeenCalledWith('id', 'book-rollback');
      errSpy.mockRestore();
    });

    it('updateBook updates fields, revalidates tags, and handles DB error', async () => {
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setAuthUser(serverClientHelper, { id: 'sa-admin' }, { id: 'sa-admin', role: 'super_admin', status: 'ACTIVE' });

      const oldBookBuilder = createMockQueryBuilder({ id: 'book-1', title: 'Old Title' }, null);
      const updateBookBuilder = createMockQueryBuilder({ id: 'book-1', title: 'New Title' }, null);
      queueTableBuilders(serverClientHelper, 'books', [oldBookBuilder, updateBookBuilder]);

      const res = await updateBook({ id: 'book-1', bookData: { title: 'New Title' } });
      expect(res.success).toBe(true);
      expect(res.data).toEqual({ id: 'book-1', title: 'New Title' });
      expect(mockRevalidateTag).toHaveBeenCalledWith('catalog', 'max');
      expect(mockRevalidateTag).toHaveBeenCalledWith('book-book-1', 'max');

      queueTableBuilders(serverClientHelper, 'books', [
        createMockQueryBuilder({ id: 'book-1', title: 'Old' }, null),
        createMockQueryBuilder(null, { message: 'Update failed' }),
      ]);
      const failRes = await updateBook({ id: 'book-1', bookData: { title: 'Fail' } });
      expect(failRes).toEqual({ success: false, error: 'Update failed' });
      infoSpy.mockRestore();
      errSpy.mockRestore();
    });

    it('softDeleteBook blocks deletion when copies are BORROWED or reservations are ACTIVE/READY', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });

      serverClientHelper.setTableResponse('book_copies', null, null, 2);
      const borrowedRes = await softDeleteBook('book-1');
      expect(borrowedRes).toEqual({
        success: false,
        error: 'Cannot delete book: There are active borrowed copies.',
      });

      serverClientHelper.setTableResponse('book_copies', null, null, 0);
      serverClientHelper.setTableResponse('reservations', null, null, 1);
      const reservedRes = await softDeleteBook('book-1');
      expect(reservedRes).toEqual({
        success: false,
        error: 'Cannot delete book: There are active or ready reservations waiting.',
      });
      errSpy.mockRestore();
    });

    it('softDeleteBook archives book when clear, and restoreBook reactivates it', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });

      serverClientHelper.setTableResponse('book_copies', null, null, 0);
      serverClientHelper.setTableResponse('reservations', null, null, 0);
      serverClientHelper.setTableResponse('books', { id: 'book-1', title: 'Archived Book', is_active: false }, null);

      const delRes = await softDeleteBook('book-1');
      expect(delRes.success).toBe(true);
      expect(serverClientHelper.getTableBuilder('books').update).toHaveBeenCalledWith({ is_active: false });

      serverClientHelper.setTableResponse('books', { id: 'book-1', title: 'Archived Book', is_active: true }, null);
      const restoreRes = await restoreBook('book-1');
      expect(restoreRes.success).toBe(true);
      expect(serverClientHelper.getTableBuilder('books').update).toHaveBeenCalledWith({ is_active: true });
      warnSpy.mockRestore();
      infoSpy.mockRestore();
    });
  });

  describe('Copies Actions (lib/actions/catalog/copies.ts)', () => {
    it('addBookCopies enforces role, copy count bounds (1-50), and inserts AVAILABLE copies', async () => {
      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });

      const invalidCount = await addBookCopies({ bookId: 'book-1', copiesCount: 51 });
      expect(invalidCount.success).toBe(false);
      expect(invalidCount.error).toBe('Validation failed');

      serverClientHelper.setTableResponse('book_copies', null, null);
      const ok = await addBookCopies({ bookId: 'book-1', copiesCount: 2 });
      expect(ok).toEqual({ success: true, data: null });
      expect(serverClientHelper.getTableBuilder('book_copies').insert).toHaveBeenCalledWith([
        { book_id: 'book-1', status: 'AVAILABLE' },
        { book_id: 'book-1', status: 'AVAILABLE' },
      ]);
      expect(mockRevalidatePath).toHaveBeenCalledWith('/catalog/book-1');

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      serverClientHelper.setTableResponse('book_copies', null, { message: 'DB err' });
      const errRes = await addBookCopies({ bookId: 'book-1', copiesCount: 1 });
      expect(errRes).toEqual({ success: false, error: 'Failed to add book copies.' });
      errSpy.mockRestore();
    });

    it('updateBookCopyStatus prevents modifying RESERVED copies and prevents non-LOST updates on BORROWED copies', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });

      // Invalid status enum (BORROWED is not directly settable)
      const enumErr = await updateBookCopyStatus({ id: 'copy-1', status: 'BORROWED' });
      expect(enumErr.success).toBe(false);
      expect(enumErr.error).toBe('Validation failed');

      // RESERVED copy cannot be changed here
      serverClientHelper.setTableResponse('book_copies', { status: 'RESERVED' }, null);
      expect(await updateBookCopyStatus({ id: 'copy-1', status: 'MAINTENANCE' })).toEqual({
        success: false,
        error: 'This copy is on hold for a student. Cancel the hold or check it out first.',
      });

      // BORROWED copy cannot be set to MAINTENANCE or AVAILABLE
      serverClientHelper.setTableResponse('book_copies', { status: 'BORROWED' }, null);
      expect(await updateBookCopyStatus({ id: 'copy-1', status: 'MAINTENANCE' })).toEqual({
        success: false,
        error: 'This copy is on loan. Use Return first.',
      });

      serverClientHelper.setTableResponse('book_copies', { status: 'BORROWED' }, null);
      expect(await updateBookCopyStatus({ id: 'copy-1', status: 'AVAILABLE' })).toEqual({
        success: false,
        error: 'This copy is on loan. Use Return first.',
      });
      errSpy.mockRestore();
    });

    it('updateBookCopyStatus allows marking BORROWED copy as LOST and transitions active/overdue loans to LOST', async () => {
      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });

      const fetchCurrent = createMockQueryBuilder({ status: 'BORROWED' }, null);
      const updateCopy = createMockQueryBuilder([{ id: 'copy-1' }], null);
      const fetchUpdated = createMockQueryBuilder({ id: 'copy-1', book_id: 'book-1', status: 'LOST' }, null);
      queueTableBuilders(serverClientHelper, 'book_copies', [fetchCurrent, updateCopy, fetchUpdated]);
      serverClientHelper.setTableResponse('borrowing_records', null, null);

      const res = await updateBookCopyStatus({ id: 'copy-1', status: 'LOST' });

      expect(res).toEqual({
        success: true,
        data: { id: 'copy-1', book_id: 'book-1', status: 'LOST' },
      });
      const loanBuilder = serverClientHelper.getTableBuilder('borrowing_records');
      expect(loanBuilder.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'LOST' }));
      expect(loanBuilder.eq).toHaveBeenCalledWith('book_copy_id', 'copy-1');
      expect(loanBuilder.in).toHaveBeenCalledWith('status', ['ACTIVE', 'OVERDUE']);
    });

    it('updateBookCopyStatus calls release_copy RPC when returning MAINTENANCE/LOST copy to AVAILABLE, and handles optimistic lock failure', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });

      const fetchCurrent = createMockQueryBuilder({ status: 'MAINTENANCE' }, null);
      const fetchUpdated = createMockQueryBuilder({ id: 'copy-1', book_id: 'book-1', status: 'AVAILABLE' }, null);
      queueTableBuilders(serverClientHelper, 'book_copies', [fetchCurrent, fetchUpdated]);
      adminClientHelper.setRpcResponse(null, null, 'release_copy');

      const res = await updateBookCopyStatus({ id: 'copy-1', status: 'AVAILABLE' });
      expect(res.success).toBe(true);
      expect(adminClientHelper.rpc).toHaveBeenCalledWith('release_copy', { p_copy_id: 'copy-1' });

      // Optimistic lock mismatch when setting MAINTENANCE
      queueTableBuilders(serverClientHelper, 'book_copies', [
        createMockQueryBuilder({ status: 'AVAILABLE' }, null),
        createMockQueryBuilder([], null),
      ]);
      const raceRes = await updateBookCopyStatus({ id: 'copy-1', status: 'MAINTENANCE' });
      expect(raceRes).toEqual({
        success: false,
        error: 'The copy changed while you were editing. Refresh and try again.',
      });
      errSpy.mockRestore();
    });

    it('getBookPublicDetails merges public book info and user availability status', async () => {
      const book = { id: 'book-1', title: 'Public Book' };
      safeClientHelper.setTableResponse('books', book, null);
      serverClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'stu-1' } }, error: null });
      serverClientHelper.setRpcResponse('2026-12-01T00:00:00Z', null, 'get_next_due_date');
      serverClientHelper.setTableResponse(
        'reservations',
        { id: 'res-1', status: 'READY', hold_expires_at: '2026-12-02T00:00:00Z', queue_position: 1 },
        null
      );

      const res = await getBookPublicDetails('book-1');
      expect(res.book).toEqual(book);
      expect(res.availability).toEqual({
        nextAvailableDate: '2026-12-02T00:00:00Z',
        hasReservation: true,
        isReady: true,
        queuePosition: null,
        holdExpiresAt: '2026-12-02T00:00:00Z',
        reservationId: 'res-1',
      });
    });

    it('getBookAdminDetails enforces staff access and normalizes active reservations onto copies', async () => {
      setAuthUser(serverClientHelper, { id: 'stu-1' }, { id: 'stu-1', role: 'student', status: 'ACTIVE' });
      await expect(getBookAdminDetails('book-1')).rejects.toThrow('Unauthorized');

      setAuthUser(serverClientHelper, { id: 'sa-1' }, { id: 'sa-1', role: 'student_assistant', status: 'ACTIVE' });
      serverClientHelper.setTableResponse('books', { id: 'book-1', title: 'Admin Book' }, null);
      serverClientHelper.setTableResponse('book_copies', [
        {
          id: 'copy-1',
          book_id: 'book-1',
          status: 'RESERVED',
          condition: 'GOOD',
          qr_string: 'QR-1',
          created_at: '2026-01-01',
          reservations: [
            { id: 'r-old', status: 'CANCELLED', queue_position: 1, hold_expires_at: '', profiles: null },
            { id: 'r-ready', status: 'READY', queue_position: 1, hold_expires_at: '2026-12-02', profiles: { full_name: 'Alice' } },
          ],
        },
        {
          id: 'copy-2',
          book_id: 'book-1',
          status: 'AVAILABLE',
          condition: 'GOOD',
          qr_string: 'QR-2',
          created_at: '2026-01-01',
          reservations: [],
        },
      ]);
      serverClientHelper.setTableResponse('reservations', [{ id: 'r-ready', status: 'READY' }]);

      const details = await getBookAdminDetails('book-1');
      expect(details.book.id).toBe('book-1');
      expect(details.copies[0].reservation).toEqual({
        id: 'r-ready',
        status: 'READY',
        queue_position: 1,
        hold_expires_at: '2026-12-02',
        profiles: { full_name: 'Alice' },
      });
      expect(details.copies[1].reservation).toBeNull();
      expect(details.queue).toEqual([{ id: 'r-ready', status: 'READY' }]);

      serverClientHelper.setTableResponse('books', null, { message: 'Not found' });
      await expect(getBookAdminDetails('book-missing')).rejects.toThrow('Not found');
    });
  });

  describe('Import / Export Actions (lib/actions/catalog/import-export.ts)', () => {
    it('getBooksForExport enforces librarian/super_admin access and returns books', async () => {
      setAuthUser(serverClientHelper, { id: 'sa-1' }, { id: 'sa-1', role: 'student_assistant', status: 'ACTIVE' });
      await expect(getBooksForExport()).rejects.toThrow('Access denied');

      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });
      const exported = [{ id: 'b1', title: 'Book 1' }];
      serverClientHelper.setTableResponse('books', exported, null);
      expect(await getBooksForExport()).toEqual(exported);

      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      serverClientHelper.setTableResponse('books', null, { message: 'Export failed' });
      await expect(getBooksForExport()).rejects.toThrow('Failed to fetch books for export: Export failed');
      errSpy.mockRestore();
    });

    it('batchImportBooks rejects > 500 rows and propagates initial duplicate-check DB errors', async () => {
      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });
      const oversized = Array.from({ length: 501 }, (_, i) => ({ title: `Book ${i}`, author: 'Author' }));
      await expect(batchImportBooks(oversized)).rejects.toThrow('Maximum batch size is 500 rows per import.');

      serverClientHelper.setTableResponse('books', null, { message: 'Prep failed' });
      await expect(batchImportBooks([{ title: 'A', author: 'B' }])).rejects.toThrow(
        'Failed to perform duplicate check database prep: Prep failed'
      );
    });

    it('batchImportBooks skips invalid rows, handles duplicates (skip vs addCopiesToDuplicates), caps stock at 50, creates categories, and logs audit', async () => {
      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });

      const existingBooksBuilder = createMockQueryBuilder(
        [{ id: 'existing-1', isbn: '978-1111111111', title: 'Existing Book', author: 'Known Author' }],
        null
      );
      const insertBooksBuilder = createMockQueryBuilder(
        [{ id: 'new-1', title: 'New Book', author: 'New Author' }],
        null
      );
      queueTableBuilders(serverClientHelper, 'books', [existingBooksBuilder, insertBooksBuilder]);

      const existingCatsBuilder = createMockQueryBuilder([{ id: 'cat-1', name: 'Fiction' }], null);
      const lookupCatBuilder = createMockQueryBuilder(null, null);
      const createCatBuilder = createMockQueryBuilder({ id: 'cat-2' }, null);
      queueTableBuilders(serverClientHelper, 'categories', [existingCatsBuilder, lookupCatBuilder, createCatBuilder]);

      serverClientHelper.setTableResponse('book_copies', null, null);

      const res = await batchImportBooks(
        [
          { title: '', author: 'Missing Title' }, // skipped
          { title: 'Existing Book', author: 'Known Author', isbn: '9781111111111', stock: 2 }, // duplicate existing
          { title: 'New Book', author: 'New Author', isbn: '978-2222222222', category: 'Philosophy', stock: 99, tags: 'tag1, tag2', published_year: '2020' }, // capped at 50
          { title: 'New Book', author: 'New Author', stock: 3 }, // in-batch duplicate
        ],
        { addCopiesToDuplicates: true }
      );

      expect(res.success).toBe(true);
      expect(res.imported).toBe(1);
      expect(res.duplicates).toBe(2);
      expect(res.copiesAdded).toBe(52); // 2 for existing + 50 capped for new
      expect(res.logs.some((l) => l.includes('Missing title or author'))).toBe(true);
      expect(res.logs.some((l) => l.includes('Stock capped at 50 copies'))).toBe(true);
      expect(mockLogAuditActivity).toHaveBeenCalledWith(
        'lib-1',
        'book',
        null,
        'batch_import',
        expect.stringContaining('1 books created, 52 copies added, 2 duplicates'),
        expect.objectContaining({ addCopiesToDuplicates: true })
      );
      expect(mockRevalidateTag).toHaveBeenCalledWith('catalog', 'max');
    });

    it('batchImportBooks skips duplicate copies when addCopiesToDuplicates is false and records copy insert failure in logs', async () => {
      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });

      queueTableBuilders(serverClientHelper, 'books', [
        createMockQueryBuilder([{ id: 'ex-1', isbn: null, title: 'Dup', author: 'Auth' }], null),
        createMockQueryBuilder([{ id: 'new-1', title: 'Fresh', author: 'Auth' }], null),
      ]);
      serverClientHelper.setTableResponse('categories', [], null);
      serverClientHelper.setTableResponse('book_copies', null, { message: 'Copy DB error' });

      const res = await batchImportBooks(
        [
          { title: 'dup', author: 'auth', stock: 3 },
          { title: 'Fresh', author: 'Auth', stock: 2 },
        ],
        { addCopiesToDuplicates: false }
      );

      expect(res.imported).toBe(1);
      expect(res.duplicates).toBe(1);
      expect(res.copiesAdded).toBe(0);
      expect(res.logs.some((l) => l.includes('Skipped duplicate'))).toBe(true);
      expect(res.logs.some((l) => l.includes('Failed to add 2 copies: Copy DB error'))).toBe(true);
    });

    it('lookupAndImportISBN validates ISBN, adds copy if ISBN exists, and falls back from Google Books to Open Library', async () => {
      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });

      expect(await lookupAndImportISBN('   ')).toEqual({
        success: false,
        isbn: '   ',
        error: 'Invalid ISBN number provided',
      });

      // Existing ISBN adds 1 copy
      serverClientHelper.setTableResponse('books', { id: 'b-ex', title: 'Existing', author: 'Auth' }, null);
      serverClientHelper.setTableResponse('book_copies', null, null);
      const existsRes = await lookupAndImportISBN('978-0-13-110362-7');
      expect(existsRes).toMatchObject({ success: true, status: 'exists', bookId: 'b-ex' });

      // Google Books fails -> Open Library succeeds + cover upload
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const fetchMock = vi.mocked(fetch);
      fetchMock
        .mockResolvedValueOnce(new Response(null, { status: 500 })) // Google Books
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              'ISBN:0131103628': {
                title: 'The C Programming Language',
                authors: [{ name: 'Kernighan' }, { name: 'Ritchie' }],
                publishers: [{ name: 'Prentice Hall' }],
                published_date: '1988',
                subjects: [{ name: 'Programming' }],
                cover: { large: 'https://covers.openlibrary.org/b/id/1-L.jpg' },
              },
            }),
            { status: 200 }
          )
        );
      mockFetchImage.mockResolvedValueOnce({ buffer: Buffer.from('jpg'), contentType: 'image/jpeg' });

      queueTableBuilders(serverClientHelper, 'books', [
        createMockQueryBuilder(null, null), // duplicate check -> not found
        createMockQueryBuilder({ id: 'b-new', title: 'The C Programming Language', author: 'Kernighan, Ritchie' }, null),
      ]);
      queueTableBuilders(serverClientHelper, 'categories', [
        createMockQueryBuilder(null, null),
        createMockQueryBuilder({ id: 'cat-prog' }, null),
      ]);
      serverClientHelper.setTableResponse('book_copies', null, null);

      const importedRes = await lookupAndImportISBN('0-13-110362-8');
      expect(importedRes).toMatchObject({
        success: true,
        status: 'imported',
        bookId: 'b-new',
        title: 'The C Programming Language',
        author: 'Kernighan, Ritchie',
      });
      warnSpy.mockRestore();
    });

    it('lookupAndImportISBN returns error when both APIs miss and rolls back book if copy insert fails', async () => {
      setAuthUser(serverClientHelper, { id: 'lib-1' }, { id: 'lib-1', role: 'librarian', status: 'ACTIVE' });
      const fetchMock = vi.mocked(fetch);
      fetchMock
        .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
      serverClientHelper.setTableResponse('books', null, null);

      const notFoundRes = await lookupAndImportISBN('0000000000');
      expect(notFoundRes).toEqual({
        success: false,
        isbn: '0000000000',
        error: 'Book metadata not found in any public APIs',
      });

      // Google Books succeeds, copy insert fails -> rollback delete
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [{ volumeInfo: { title: 'Rollback Book', authors: ['Author'] } }],
          }),
          { status: 200 }
        )
      );
      const deleteBuilder = createMockQueryBuilder(null, null);
      queueTableBuilders(serverClientHelper, 'books', [
        createMockQueryBuilder(null, null),
        createMockQueryBuilder({ id: 'b-rb', title: 'Rollback Book', author: 'Author' }, null),
        deleteBuilder,
      ]);
      serverClientHelper.setTableResponse('book_copies', null, { message: 'copy fail' });

      const rollbackRes = await lookupAndImportISBN('1234567890');
      expect(rollbackRes).toEqual({
        success: false,
        isbn: '1234567890',
        error: 'Book record was created, but copy generation failed: copy fail. Rolled back.',
      });
      expect(deleteBuilder.delete).toHaveBeenCalled();
      expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'b-rb');
    });
  });

  describe('Public Catalog (lib/actions/public-catalog.ts)', () => {
    it('getPublicBooksCached delegates to fetchBooksCore with newest/availability sort mapping', async () => {
      safeClientHelper.setTableResponse('books', [{ id: 'pub-1', title: 'Public' }], null, 1);

      const res = await getPublicBooksCached('Pub', 'cat-1', 'General', true, 1, 12, 'newest');
      expect(res).toEqual({
        books: [{ id: 'pub-1', title: 'Public' }],
        total: 1,
        hasMore: false,
      });
      const b = safeClientHelper.getTableBuilder('books');
      expect(b.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(b.gt).toHaveBeenCalledWith('available_copies', 0);
    });

    it('getPublicBookById fetches active book by ID and throws on error', async () => {
      const book = { id: 'pub-1', title: 'Dune' };
      safeClientHelper.setTableResponse('books', book, null);

      expect(await getPublicBookById('pub-1')).toEqual(book);
      const b = safeClientHelper.getTableBuilder('books');
      expect(b.eq).toHaveBeenCalledWith('id', 'pub-1');
      expect(b.eq).toHaveBeenCalledWith('is_active', true);

      safeClientHelper.setTableResponse('books', null, { message: 'Public lookup failed' });
      await expect(getPublicBookById('pub-1')).rejects.toThrow('Public lookup failed');
    });

    it('getCategoriesCached returns categories from fetchCategoriesCore', async () => {
      const cats = [{ id: 'c1', name: 'Literature' }];
      safeClientHelper.setTableResponse('categories', cats, null);
      expect(await getCategoriesCached()).toEqual(cats);
    });
  });
});
