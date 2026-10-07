import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPublicBooksCached, getPublicBookById, getCategoriesCached } from '../public-catalog';
import { fetchBooksCore, fetchCategoriesCore } from '../books-core';
import { createSafeClient } from '@/lib/supabase/server';
import { unstable_cache } from 'next/cache';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';

vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => {
    return (...args: unknown[]) => fn(...args);
  }),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('../books-core', () => ({
  fetchBooksCore: vi.fn(),
  fetchCategoriesCore: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSafeClient: vi.fn(),
}));

describe('Public Catalog Server Actions', () => {
  let mockClientHelper: MockSupabaseClientHelper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientHelper = createMockSupabaseClient();
    vi.mocked(createSafeClient).mockReturnValue(
      mockClientHelper.client as unknown as ReturnType<typeof createSafeClient>
    );
  });

  describe('getPublicBooksCached', () => {
    it('wraps fetch with unstable_cache using appropriate dynamic key and tags', async () => {
      const mockResult = { books: [], total: 0, hasMore: false };
      vi.mocked(fetchBooksCore).mockResolvedValue(mockResult);

      const result = await getPublicBooksCached('Design Patterns', 'cat-123', 'Circulation', true, 1, 15, 'title');

      expect(unstable_cache).toHaveBeenCalledWith(
        expect.any(Function),
        ['public-books', 'Design Patterns', 'cat-123', 'Circulation', 'true', '1', '15', 'title'],
        { revalidate: 60, tags: ['public-books'] }
      );
      expect(result).toBe(mockResult);
    });

    it('maps sortBy="newest" to sortBy="created_at" and sortOrder="desc"', async () => {
      vi.mocked(fetchBooksCore).mockResolvedValue({ books: [], total: 0, hasMore: false });

      await getPublicBooksCached('search query', undefined, undefined, false, 1, 20, 'newest');

      expect(fetchBooksCore).toHaveBeenCalledWith(
        {
          query: 'search query',
          categoryId: undefined,
          section: undefined,
          availableOnly: false,
          page: 1,
          pageSize: 20,
          sortBy: 'created_at',
          sortOrder: 'desc',
        },
        'id, title, author, isbn, category_id, tags, section, cover_url, total_copies, available_copies, categories(name)'
      );
    });

    it('maps sortBy="availability" to sortOrder="desc"', async () => {
      vi.mocked(fetchBooksCore).mockResolvedValue({ books: [], total: 0, hasMore: false });

      await getPublicBooksCached('', undefined, undefined, false, 1, 20, 'availability');

      expect(fetchBooksCore).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'availability',
          sortOrder: 'desc',
        }),
        expect.any(String)
      );
    });

    it('maps sortBy="author" to sortOrder="asc"', async () => {
      vi.mocked(fetchBooksCore).mockResolvedValue({ books: [], total: 0, hasMore: false });

      await getPublicBooksCached('', undefined, undefined, false, 1, 20, 'author');

      expect(fetchBooksCore).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'author',
          sortOrder: 'asc',
        }),
        expect.any(String)
      );
    });

    it('handles defaults when optional parameters are omitted', async () => {
      vi.mocked(fetchBooksCore).mockResolvedValue({ books: [], total: 0, hasMore: false });

      await getPublicBooksCached('clean code');

      expect(fetchBooksCore).toHaveBeenCalledWith(
        {
          query: 'clean code',
          categoryId: undefined,
          section: undefined,
          availableOnly: false,
          page: 1,
          pageSize: 20,
          sortBy: 'title',
          sortOrder: 'asc',
        },
        expect.any(String)
      );
    });
  });

  describe('getPublicBookById', () => {
    it('returns book with category join for active book', async () => {
      const mockBook = {
        id: 'book-100',
        title: 'Structure and Interpretation of Computer Programs',
        author: 'Harold Abelson',
        isbn: '9780262510875',
        category_id: 'cat-cs',
        tags: ['lisp', 'functional programming'],
        section: 'Circulation',
        location: 'Shelf 4B',
        cover_url: 'https://cdn.example.com/sicp.jpg',
        total_copies: 5,
        available_copies: 3,
        categories: { name: 'Computer Science' },
      };

      mockClientHelper.setTableResponse('books', mockBook);

      const result = await getPublicBookById('book-100');

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.select).toHaveBeenCalledWith(
        'id, title, author, isbn, category_id, tags, section, location, cover_url, total_copies, available_copies, categories(name)'
      );
      expect(booksBuilder.eq).toHaveBeenCalledWith('id', 'book-100');
      expect(booksBuilder.eq).toHaveBeenCalledWith('is_active', true);
      expect(result).toEqual(mockBook);
    });

    it('returns null when book is inactive or not found', async () => {
      mockClientHelper.setTableResponse('books', null);

      const result = await getPublicBookById('inactive-book-id');

      expect(result).toBeNull();
    });

    it('throws error when database query fails', async () => {
      mockClientHelper.setTableResponse('books', null, { message: 'Database query timeout' });

      await expect(getPublicBookById('book-error')).rejects.toThrow('Database query timeout');
    });
  });

  describe('getCategoriesCached', () => {
    it('invokes fetchCategoriesCore and returns cached list of categories', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Fiction', description: 'Novels', created_at: '2026-01-01' },
      ];
      vi.mocked(fetchCategoriesCore).mockResolvedValue(mockCategories);

      const result = await getCategoriesCached();

      expect(fetchCategoriesCore).toHaveBeenCalled();
      expect(result).toEqual(mockCategories);
    });
  });
});
