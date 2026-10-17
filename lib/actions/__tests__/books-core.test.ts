import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchBooksCore, fetchCategoriesCore } from '../books-core';
import { createSafeClient } from '@/lib/supabase/server';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({
  createSafeClient: vi.fn(),
}));

describe('books-core server actions', () => {
  let mockClientHelper: MockSupabaseClientHelper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientHelper = createMockSupabaseClient();
    vi.mocked(createSafeClient).mockReturnValue(
      mockClientHelper.client as unknown as ReturnType<typeof createSafeClient>
    );
  });

  describe('fetchBooksCore', () => {
    it('applies default filters, ordering by title ascending, and returns paginated books', async () => {
      const mockBooks = [
        { id: 'book-1', title: 'Advanced Algorithms', author: 'Ada Lovelace' },
        { id: 'book-2', title: 'Calculus Made Easy', author: 'Silvanus Thompson' },
      ];
      mockClientHelper.setTableResponse('books', mockBooks, null, 25);

      const result = await fetchBooksCore({});

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.select).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(booksBuilder.eq).toHaveBeenCalledWith('is_active', true);
      expect(booksBuilder.order).toHaveBeenCalledWith('title', { ascending: true });
      expect(booksBuilder.range).toHaveBeenCalledWith(0, 19);

      expect(result).toEqual({
        books: mockBooks,
        total: 25,
        hasMore: true,
      });
    });

    it('performs short query search (< 3 chars) using ILIKE across title, author, and isbn', async () => {
      mockClientHelper.setTableResponse('books', [], null, 0);

      await fetchBooksCore({ query: 'ai' });

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.or).toHaveBeenCalledWith('title.ilike.%ai%,author.ilike.%ai%,isbn.ilike.%ai%');
      expect(booksBuilder.textSearch).not.toHaveBeenCalled();
    });

    it('trims whitespace and searches with ILIKE for short query', async () => {
      mockClientHelper.setTableResponse('books', [], null, 0);

      await fetchBooksCore({ query: '  js  ' });

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      // "js" has length 2
      expect(booksBuilder.or).toHaveBeenCalledWith('title.ilike.%js%,author.ilike.%js%,isbn.ilike.%js%');
      expect(booksBuilder.textSearch).not.toHaveBeenCalled();
    });

    it('performs full-text search (>= 3 chars) by converting terms to prefix tokens', async () => {
      mockClientHelper.setTableResponse('books', [], null, 0);

      await fetchBooksCore({ query: 'machine learning theory' });

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.textSearch).toHaveBeenCalledWith(
        'search_vector',
        'machine:* & learning:* & theory:*'
      );
      expect(booksBuilder.or).not.toHaveBeenCalled();
    });

    it('ignores whitespace-only query', async () => {
      mockClientHelper.setTableResponse('books', [], null, 0);

      await fetchBooksCore({ query: '     ' });

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.or).not.toHaveBeenCalled();
      expect(booksBuilder.textSearch).not.toHaveBeenCalled();
    });

    it('applies category filter with single id', async () => {
      mockClientHelper.setTableResponse('books', [], null, 0);

      await fetchBooksCore({ categoryId: 'cat-comp-sci' });

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.in).toHaveBeenCalledWith('category_id', ['cat-comp-sci']);
    });

    it('applies category filter with comma-separated list of category ids', async () => {
      mockClientHelper.setTableResponse('books', [], null, 0);

      await fetchBooksCore({ categoryId: 'cat-1,cat-2,cat-3' });

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.in).toHaveBeenCalledWith('category_id', ['cat-1', 'cat-2', 'cat-3']);
    });

    it('ignores categoryId when set to "all"', async () => {
      mockClientHelper.setTableResponse('books', [], null, 0);

      await fetchBooksCore({ categoryId: 'all' });

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.in).not.toHaveBeenCalled();
    });

    it('applies section filter when specified', async () => {
      mockClientHelper.setTableResponse('books', [], null, 0);

      await fetchBooksCore({ section: 'Filipiniana' });

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.eq).toHaveBeenCalledWith('section', 'Filipiniana');
    });

    it('applies availableOnly filter by requiring available_copies > 0', async () => {
      mockClientHelper.setTableResponse('books', [], null, 0);

      await fetchBooksCore({ availableOnly: true });

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.gt).toHaveBeenCalledWith('available_copies', 0);
    });

    it('orders by author ascending and descending', async () => {
      mockClientHelper.setTableResponse('books', [], null, 0);

      await fetchBooksCore({ sortBy: 'author', sortOrder: 'asc' });
      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.order).toHaveBeenCalledWith('author', { ascending: true });

      await fetchBooksCore({ sortBy: 'author', sortOrder: 'desc' });
      expect(booksBuilder.order).toHaveBeenCalledWith('author', { ascending: false });
    });

    it('orders by availability correctly mapping descending to true and ascending to false', async () => {
      mockClientHelper.setTableResponse('books', [], null, 0);

      await fetchBooksCore({ sortBy: 'availability', sortOrder: 'desc' });
      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.order).toHaveBeenCalledWith('available_copies', { ascending: true });

      await fetchBooksCore({ sortBy: 'availability', sortOrder: 'asc' });
      expect(booksBuilder.order).toHaveBeenCalledWith('available_copies', { ascending: false });
    });

    it('orders by created_at correctly', async () => {
      mockClientHelper.setTableResponse('books', [], null, 0);

      await fetchBooksCore({ sortBy: 'created_at', sortOrder: 'asc' });
      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.order).toHaveBeenCalledWith('created_at', { ascending: true });

      await fetchBooksCore({ sortBy: 'created_at', sortOrder: 'desc' });
      expect(booksBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('calculates pagination ranges and hasMore correctly when not more results', async () => {
      const books = [{ id: 'b1', title: 'B1' }, { id: 'b2', title: 'B2' }];
      mockClientHelper.setTableResponse('books', books, null, 22);

      const result = await fetchBooksCore({ page: 2, pageSize: 20 });

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.range).toHaveBeenCalledWith(20, 39);
      // from (20) + data.length (2) = 22, count = 22 => hasMore = false
      expect(result.hasMore).toBe(false);
      expect(result.total).toBe(22);
    });

    it('handles custom columns parameter', async () => {
      mockClientHelper.setTableResponse('books', [], null, 0);

      await fetchBooksCore({}, 'id, title, author');

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.select).toHaveBeenCalledWith('id, title, author', { count: 'exact' });
    });

    it('throws error when database query fails', async () => {
      mockClientHelper.setTableResponse('books', null, { message: 'Database connection timeout' });

      await expect(fetchBooksCore({})).rejects.toThrow('Database connection timeout');
    });
  });

  describe('fetchCategoriesCore', () => {
    it('queries categories ordered by name', async () => {
      const mockCategories = [
        { id: 'c1', name: 'Computer Science', description: 'Tech books', created_at: '2026-01-01' },
        { id: 'c2', name: 'Mathematics', description: 'Math books', created_at: '2026-01-02' },
      ];
      mockClientHelper.setTableResponse('categories', mockCategories);

      const result = await fetchCategoriesCore();

      const catBuilder = mockClientHelper.getTableBuilder('categories');
      expect(catBuilder.select).toHaveBeenCalledWith('id, name, description, created_at');
      expect(catBuilder.order).toHaveBeenCalledWith('name');
      expect(result).toEqual(mockCategories);
    });

    it('returns empty array when data is null', async () => {
      mockClientHelper.setTableResponse('categories', null);

      const result = await fetchCategoriesCore();
      expect(result).toEqual([]);
    });

    it('throws error when database fails', async () => {
      mockClientHelper.setTableResponse('categories', null, { message: 'Failed to fetch categories' });

      await expect(fetchCategoriesCore()).rejects.toThrow('Failed to fetch categories');
    });
  });
});
