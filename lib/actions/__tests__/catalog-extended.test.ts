import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  batchImportBooks,
  lookupAndImportISBN,
  getBookAdminDetails,
  getBookPublicDetails,
  getBooksForExport,
  type ImportBookRow,
} from '../catalog';
import { getPublicBookById } from '../public-catalog';
import { getBookAvailabilityStatus } from '../reservations';
import { getMe } from '@/lib/auth-helpers';
import { revalidateTag } from 'next/cache';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';
import type { ProfileData, UserRole } from '@/lib/types';

vi.mock('@/lib/auth-helpers', () => ({
  getMe: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../public-catalog', () => ({
  getPublicBookById: vi.fn(),
}));

vi.mock('../reservations', () => ({
  getBookAvailabilityStatus: vi.fn(),
}));

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-webp-bytes')),
  })),
}));

describe('Catalog Extended Server Actions', () => {
  let mockClientHelper: MockSupabaseClientHelper;

  const mockStaffUser = (role: UserRole = 'librarian', id = 'staff-1') => ({
    user: {
      id,
      email: 'staff@school.edu',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id,
      email: 'staff@school.edu',
      role,
      status: 'ACTIVE',
      full_name: 'Library Staff',
      permissions: {},
    } as unknown as ProfileData,
    role,
    isStaff: true,
    isAdmin: role === 'super_admin',
    isDeactivatedSA: false,
    hasPermission: vi.fn().mockReturnValue(true),
    supabase: mockClientHelper.client,
  });

  const mockStudentUser = (id = 'student-1') => ({
    user: {
      id,
      email: 'student@school.edu',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id,
      email: 'student@school.edu',
      role: 'student' as UserRole,
      status: 'ACTIVE',
      full_name: 'Test Student',
      permissions: {},
    } as unknown as ProfileData,
    role: 'student' as UserRole,
    isStaff: false,
    isAdmin: false,
    isDeactivatedSA: false,
    hasPermission: vi.fn().mockReturnValue(false),
    supabase: mockClientHelper.client,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientHelper = createMockSupabaseClient();
    vi.mocked(getMe).mockResolvedValue(
      mockStaffUser() as unknown as Awaited<ReturnType<typeof getMe>>
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Authorization Guards', () => {
    it('rejects batchImportBooks when user is unauthenticated', async () => {
      vi.mocked(getMe).mockResolvedValue(null);
      await expect(batchImportBooks([])).rejects.toThrow('Unauthorized');
    });

    it('rejects batchImportBooks when user is a student', async () => {
      vi.mocked(getMe).mockResolvedValue(
        mockStudentUser() as unknown as Awaited<ReturnType<typeof getMe>>
      );
      await expect(batchImportBooks([])).rejects.toThrow('Unauthorized');
    });

    it('rejects lookupAndImportISBN when user is not staff', async () => {
      vi.mocked(getMe).mockResolvedValue(
        mockStudentUser() as unknown as Awaited<ReturnType<typeof getMe>>
      );
      await expect(lookupAndImportISBN('9781234567890')).rejects.toThrow('Unauthorized');
    });

    it('rejects getBookAdminDetails when user is not staff', async () => {
      vi.mocked(getMe).mockResolvedValue(
        mockStudentUser() as unknown as Awaited<ReturnType<typeof getMe>>
      );
      await expect(getBookAdminDetails('book-1')).rejects.toThrow('Unauthorized');
    });

    it('rejects getBooksForExport when user is not staff', async () => {
      vi.mocked(getMe).mockResolvedValue(
        mockStudentUser() as unknown as Awaited<ReturnType<typeof getMe>>
      );
      await expect(getBooksForExport()).rejects.toThrow('Unauthorized');
    });

    it('rejects when staff user has unauthorized role', async () => {
      const oddStaff = {
        ...mockStaffUser('student' as unknown as UserRole),
        role: 'guest_staff' as unknown as UserRole,
        isStaff: true,
      };
      vi.mocked(getMe).mockResolvedValue(
        oddStaff as unknown as Awaited<ReturnType<typeof getMe>>
      );
      await expect(getBooksForExport()).rejects.toThrow('Access denied: Inventory management is restricted to authorized staff roles.');
    });
  });

  describe('batchImportBooks', () => {
    it('handles duplicate by matching ISBN and adds copies to existing book', async () => {
      const existingBooks = [
        { id: 'existing-book-1', isbn: '9780131103627', title: 'The C Programming Language', author: 'Dennis Ritchie' },
      ];
      mockClientHelper.setTableResponse('books', existingBooks);

      const rows: ImportBookRow[] = [
        {
          title: 'The C Programming Language',
          author: 'Brian Kernighan & Dennis Ritchie',
          isbn: '978-0131103627',
          copiesCount: 2,
        },
      ];

      const result = await batchImportBooks(rows);

      expect(result.success).toBe(true);
      expect(result.duplicates).toBe(1);
      expect(result.copiesAdded).toBe(2);
      expect(result.imported).toBe(0);

      const copyBuilder = mockClientHelper.getTableBuilder('book_copies');
      expect(copyBuilder.insert).toHaveBeenCalledWith([
        { book_id: 'existing-book-1', status: 'AVAILABLE' },
        { book_id: 'existing-book-1', status: 'AVAILABLE' },
      ]);
    });

    it('handles duplicate by matching Title and Author case-insensitively', async () => {
      const existingBooks = [
        { id: 'existing-book-2', isbn: null, title: 'Clean Architecture', author: 'Robert Martin' },
      ];
      mockClientHelper.setTableResponse('books', existingBooks);

      const rows: ImportBookRow[] = [
        {
          title: '  clean architecture  ',
          author: 'robert martin',
          stock: '3',
        },
      ];

      const result = await batchImportBooks(rows);

      expect(result.duplicates).toBe(1);
      expect(result.copiesAdded).toBe(3);
      expect(result.imported).toBe(0);
    });

    it('imports new book records and resolves existing categories', async () => {
      mockClientHelper.setTableResponse('books', []); // No existing books initially
      mockClientHelper.setTableResponse('categories', { id: 'cat-db-id' }); // Category found

      const insertedBook = { id: 'new-book-1', title: 'Refactoring' };
      const booksBuilder = mockClientHelper.getTableBuilder('books');
      // First select is for duplicate check, then insert().select().single()
      booksBuilder.single.mockResolvedValueOnce({ data: insertedBook, error: null });

      const rows: ImportBookRow[] = [
        {
          title: 'Refactoring',
          author: 'Martin Fowler',
          isbn: '9780201485677',
          category: 'Software Engineering',
          stock: 1,
          tags: 'design, architecture',
          published_year: '1999',
        },
      ];

      const result = await batchImportBooks(rows);

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(result.copiesAdded).toBe(1);
      expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
      expect(revalidateTag).toHaveBeenCalledWith('books', 'max');
    });

    it('creates new category when category does not already exist', async () => {
      mockClientHelper.setTableResponse('books', []);
      const catBuilder = mockClientHelper.getTableBuilder('categories');
      // maybeSingle finds nothing
      catBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      // single after insert returns new category
      catBuilder.single.mockResolvedValueOnce({ data: { id: 'new-cat-id' }, error: null });

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      booksBuilder.single.mockResolvedValueOnce({ data: { id: 'book-new' }, error: null });

      const rows: ImportBookRow[] = [
        {
          title: 'Deep Learning',
          author: 'Ian Goodfellow',
          category: 'Artificial Intelligence',
          stock: 1,
        },
      ];

      const result = await batchImportBooks(rows);

      expect(result.imported).toBe(1);
      expect(catBuilder.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          name: 'Artificial Intelligence',
          slug: 'artificial-intelligence',
          is_active: true,
        }),
      ]);
    });

    it('skips rows with missing title or author', async () => {
      mockClientHelper.setTableResponse('books', []);

      const rows: ImportBookRow[] = [
        { title: '', author: 'Some Author' },
        { title: 'Valid Title', author: '' },
      ];

      const result = await batchImportBooks(rows);

      expect(result.imported).toBe(0);
      expect(result.duplicates).toBe(0);
      expect(result.logs.some((l) => l.includes('Skipped: Missing title or author'))).toBe(true);
    });

    it('throws error if duplicate check preparation fails', async () => {
      mockClientHelper.setTableResponse('books', null, { message: 'Database read error' });

      await expect(batchImportBooks([])).rejects.toThrow('Failed to perform duplicate check database prep: Database read error');
    });
  });

  describe('lookupAndImportISBN', () => {
    it('returns error if ISBN is empty or whitespace', async () => {
      const result = await lookupAndImportISBN('   ');
      expect(result).toEqual({
        success: false,
        isbn: '   ',
        error: 'Invalid ISBN number provided',
      });
    });

    it('adds copy if book with ISBN already exists in the database', async () => {
      const existingBook = {
        id: 'existing-book-1',
        title: 'Design Patterns',
        author: 'Gang of Four',
      };
      mockClientHelper.setTableResponse('books', existingBook);

      const result = await lookupAndImportISBN('978-0201633610');

      expect(result).toEqual({
        success: true,
        isbn: '978-0201633610',
        status: 'exists',
        bookId: 'existing-book-1',
        title: 'Design Patterns',
        author: 'Gang of Four',
        message: expect.stringContaining('Book already exists'),
      });

      const copyBuilder = mockClientHelper.getTableBuilder('book_copies');
      expect(copyBuilder.insert).toHaveBeenCalledWith([
        { book_id: 'existing-book-1', status: 'AVAILABLE' },
      ]);
      expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
    });

    it('fetches metadata from Google Books when not in database, creates book and copy', async () => {
      // Books table has no existing book with this ISBN
      mockClientHelper.setTableResponse('books', null);

      const mockGoogleResponse = {
        items: [
          {
            volumeInfo: {
              title: 'Refactoring Ruby Edition',
              authors: ['Jay Fields', 'Martin Fowler'],
              publisher: 'Addison-Wesley',
              publishedDate: '2009-10-15',
              description: 'Refactoring principles in Ruby',
              categories: ['Programming'],
              imageLinks: {
                thumbnail: 'http://books.google.com/ruby.jpg',
              },
            },
          },
        ],
      };

      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (url.includes('googleapis.com')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockGoogleResponse,
          });
        }
        if (url.startsWith('http://books.google.com/ruby.jpg')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: async () => new ArrayBuffer(8),
          });
        }
        return Promise.reject(new Error('Unknown url'));
      }));

      // Mock category lookup
      mockClientHelper.setTableResponse('categories', { id: 'cat-prog' });

      // Mock book insertion
      const booksBuilder = mockClientHelper.getTableBuilder('books');
      booksBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'imported-book-id',
          title: 'Refactoring Ruby Edition',
          author: 'Jay Fields, Martin Fowler',
        },
        error: null,
      });

      const result = await lookupAndImportISBN('9780321984135');

      expect(result).toEqual({
        success: true,
        isbn: '9780321984135',
        status: 'imported',
        bookId: 'imported-book-id',
        title: 'Refactoring Ruby Edition',
        author: 'Jay Fields, Martin Fowler',
        message: expect.stringContaining('Successfully imported'),
      });
      expect(revalidateTag).toHaveBeenCalledWith('catalog', 'max');
    });

    it('falls back to Open Library API if Google Books yields no items', async () => {
      mockClientHelper.setTableResponse('books', null);

      const mockOpenLibResponse = {
        'ISBN:9781449331818': {
          title: 'Learning JavaScript Design Patterns',
          authors: [{ name: 'Addy Osmani' }],
          publishers: [{ name: "O'Reilly Media" }],
          published_date: '2012',
          notes: 'A JavaScript patterns guide',
          subjects: [{ name: 'JavaScript' }],
        },
      };

      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (url.includes('googleapis.com')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [] }),
          });
        }
        if (url.includes('openlibrary.org')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockOpenLibResponse,
          });
        }
        return Promise.reject(new Error('Unknown url'));
      }));

      mockClientHelper.setTableResponse('categories', { id: 'cat-js' });
      const booksBuilder = mockClientHelper.getTableBuilder('books');
      booksBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'openlib-book-id',
          title: 'Learning JavaScript Design Patterns',
          author: 'Addy Osmani',
        },
        error: null,
      });

      const result = await lookupAndImportISBN('9781449331818');

      expect(result.success).toBe(true);
      expect(result.status).toBe('imported');
      expect(result.title).toBe('Learning JavaScript Design Patterns');
      expect(result.author).toBe('Addy Osmani');
    });

    it('returns error if neither Google Books nor Open Library finds the ISBN', async () => {
      mockClientHelper.setTableResponse('books', null);

      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (url.includes('googleapis.com')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ items: [] }),
          });
        }
        if (url.includes('openlibrary.org')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({}),
          });
        }
        return Promise.reject(new Error('Network error'));
      }));

      const result = await lookupAndImportISBN('0000000000000');

      expect(result).toEqual({
        success: false,
        isbn: '0000000000000',
        error: 'Book metadata not found in any public APIs',
      });
    });

    it('rolls back newly inserted book if copy creation fails', async () => {
      mockClientHelper.setTableResponse('books', null);

      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (url.includes('googleapis.com')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              items: [
                {
                  volumeInfo: {
                    title: 'Failure Test Book',
                    authors: ['Tester'],
                  },
                },
              ],
            }),
          });
        }
        return Promise.reject(new Error('Error'));
      }));

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      booksBuilder.single.mockResolvedValueOnce({
        data: { id: 'temp-book-id', title: 'Failure Test Book', author: 'Tester' },
        error: null,
      });

      // Cause book_copies insert to fail
      mockClientHelper.setTableResponse('book_copies', null, { message: 'Copy insert failed' });

      const result = await lookupAndImportISBN('9789999999999');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rolled back');
      // Verifies delete was called to rollback
      expect(booksBuilder.delete).toHaveBeenCalled();
      expect(booksBuilder.eq).toHaveBeenCalledWith('id', 'temp-book-id');
    });
  });

  describe('getBookAdminDetails', () => {
    it('returns book, normalized copies with active reservations, and queue entries', async () => {
      const mockBook = {
        id: 'book-admin-1',
        title: 'Distributed Systems',
        categories: { name: 'Engineering' },
      };

      const mockCopies = [
        {
          id: 'copy-1',
          book_id: 'book-admin-1',
          status: 'BORROWED',
          condition: 'GOOD',
          qr_string: 'QR-001',
          created_at: '2026-01-01',
          reservations: [
            {
              id: 'res-1',
              status: 'READY',
              queue_position: 1,
              hold_expires_at: '2026-01-10',
              profiles: {
                id: 'student-10',
                full_name: 'Alice Cooper',
                email: 'alice@school.edu',
                student_id: 'S1001',
              },
            },
          ],
        },
      ];

      const mockQueue = [
        {
          id: 'res-1',
          status: 'READY',
          queue_position: 1,
          hold_expires_at: '2026-01-10',
          reserved_at: '2026-01-02',
          copy_id: 'copy-1',
          profiles: {
            id: 'student-10',
            full_name: 'Alice Cooper',
            email: 'alice@school.edu',
            student_id: 'S1001',
            avatar_url: null,
          },
          book_copies: { qr_string: 'QR-001' },
        },
      ];

      mockClientHelper.setTableResponse('books', mockBook);
      mockClientHelper.setTableResponse('book_copies', mockCopies);
      mockClientHelper.setTableResponse('reservations', mockQueue);

      const result = await getBookAdminDetails('book-admin-1');

      expect(result.book).toEqual(mockBook);
      expect(result.copies).toHaveLength(1);
      expect(result.copies[0].reservation).toEqual({
        id: 'res-1',
        status: 'READY',
        queue_position: 1,
        hold_expires_at: '2026-01-10',
        profiles: {
          id: 'student-10',
          full_name: 'Alice Cooper',
          email: 'alice@school.edu',
          student_id: 'S1001',
        },
      });
      expect(result.queue).toEqual(mockQueue);
    });

    it('throws error when book query fails', async () => {
      mockClientHelper.setTableResponse('books', null, { message: 'Book not found' });
      mockClientHelper.setTableResponse('book_copies', []);
      mockClientHelper.setTableResponse('reservations', []);

      await expect(getBookAdminDetails('missing-book')).rejects.toThrow('Book not found');
    });
  });

  describe('getBookPublicDetails', () => {
    it('returns book and availability concurrently', async () => {
      const mockBook = { id: 'book-pub-1', title: 'Calculus' };
      const mockAvailability = {
        nextAvailableDate: null,
        hasReservation: false,
        isReady: false,
        queuePosition: null,
        holdExpiresAt: null,
        reservationId: null,
      };

      vi.mocked(getPublicBookById).mockResolvedValue(mockBook as unknown as Awaited<ReturnType<typeof getPublicBookById>>);
      vi.mocked(getBookAvailabilityStatus).mockResolvedValue(mockAvailability);

      const result = await getBookPublicDetails('book-pub-1');

      expect(getPublicBookById).toHaveBeenCalledWith('book-pub-1');
      expect(getBookAvailabilityStatus).toHaveBeenCalledWith('book-pub-1');
      expect(result).toEqual({
        book: mockBook,
        availability: mockAvailability,
      });
    });
  });

  describe('getBooksForExport', () => {
    it('returns books with categories ordered by title', async () => {
      const exportData = [
        { id: 'b1', title: 'Algorithms', author: 'Sedgewick', categories: { name: 'CS' } },
        { id: 'b2', title: 'Compilers', author: 'Aho', categories: { name: 'CS' } },
      ];
      mockClientHelper.setTableResponse('books', exportData);

      const result = await getBooksForExport();

      const booksBuilder = mockClientHelper.getTableBuilder('books');
      expect(booksBuilder.order).toHaveBeenCalledWith('title');
      expect(result).toEqual(exportData);
    });

    it('throws error when database query fails during export', async () => {
      mockClientHelper.setTableResponse('books', null, { message: 'Export query failed' });

      await expect(getBooksForExport()).rejects.toThrow('Failed to fetch books for export: Export query failed');
    });
  });
});
