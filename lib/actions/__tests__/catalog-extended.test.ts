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
import { enqueueCatalogEnrichment } from '@/lib/catalog-import-worker';
import { scheduleCatalogImport } from '@/lib/catalog-import-scheduler';
import { createAdminClient } from '@/lib/supabase/admin';
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

vi.mock('@/lib/catalog-import-worker', () => ({ enqueueCatalogEnrichment: vi.fn() }));
vi.mock('@/lib/catalog-import-scheduler', () => ({ scheduleCatalogImport: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

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
    vi.mocked(createAdminClient).mockReturnValue(mockClientHelper.client as unknown as ReturnType<typeof createAdminClient>);
    vi.mocked(enqueueCatalogEnrichment).mockReset().mockResolvedValue('enrichment-job');
    mockClientHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'staff-1' } }, error: null });
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
    it('enqueues all involved saved books once without adding copies for duplicates', async () => {
      mockClientHelper.setTableResponse('books', [{ id: 'existing', isbn: '9780201633610', title: 'Existing', author: 'Author', cover_url: null }]);
      const booksBuilder = mockClientHelper.getTableBuilder('books');
      booksBuilder.insert.mockReturnValueOnce({ select: vi.fn().mockResolvedValueOnce({ data: [{ id: 'new', title: 'New', author: 'Author', isbn: null }], error: null }) } as unknown as ReturnType<typeof booksBuilder.insert>);
      const result = await batchImportBooks([
        { title: 'Existing', author: 'Author', isbn: '9780201633610', cover_url: 'https://covers.test/existing.jpg', stock: 4 },
        { title: 'Existing', author: 'Author', isbn: '9780201633610', stock: 4 },
        { title: 'New', author: 'Author', cover_url: 'https://covers.test/new.jpg', stock: 2 },
      ]);
      expect(result).toMatchObject({ success: true, imported: 1, copiesAdded: 2, duplicates: 2, enrichmentJobId: 'enrichment-job' });
      expect(enqueueCatalogEnrichment).toHaveBeenCalledWith([
        { id: 'existing', isbn: '9780201633610', title: 'Existing', cover_url: 'https://covers.test/existing.jpg' },
        { id: 'new', isbn: null, title: 'New', cover_url: 'https://covers.test/new.jpg' },
      ], 'staff-1');
      expect(scheduleCatalogImport).toHaveBeenCalledOnce();
      expect(revalidateTag).toHaveBeenCalledWith('public-books', 'max');
    });

    it('keeps saved rows successful and reports an enrichment enqueue failure', async () => {
      mockClientHelper.setTableResponse('books', [{ id: 'existing', isbn: null, title: 'Existing', author: 'Author' }]);
      vi.mocked(enqueueCatalogEnrichment).mockRejectedValueOnce(new Error('Queue unavailable'));
      const result = await batchImportBooks([{ title: 'Existing', author: 'Author' }]);
      expect(result.success).toBe(true);
      expect(result.logs.join(' ')).toContain('Queue unavailable');
      expect(result.enrichmentJobId).toBeUndefined();
      expect(scheduleCatalogImport).not.toHaveBeenCalled();
    });

    it('skips duplicate by matching ISBN by default and adds copies when addCopiesToDuplicates is true', async () => {
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

      // Default: skip duplicates (0 copies added)
      const defaultResult = await batchImportBooks(rows);
      expect(defaultResult.success).toBe(true);
      expect(defaultResult.duplicates).toBe(1);
      expect(defaultResult.copiesAdded).toBe(0);
      expect(defaultResult.imported).toBe(0);

      // Opt-in: add copies to existing book
      const optInResult = await batchImportBooks(rows, { addCopiesToDuplicates: true });

      expect(optInResult.success).toBe(true);
      expect(optInResult.duplicates).toBe(1);
      expect(optInResult.copiesAdded).toBe(2);
      expect(optInResult.imported).toBe(0);

      const copyBuilder = mockClientHelper.getTableBuilder('book_copies');
      expect(copyBuilder.insert).toHaveBeenCalledWith([
        { book_id: 'existing-book-1', status: 'AVAILABLE' },
        { book_id: 'existing-book-1', status: 'AVAILABLE' },
      ]);
    });

    it('handles duplicate by matching Title and Author case-insensitively (default skip vs opt-in copies)', async () => {
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

      const skipped = await batchImportBooks(rows);
      expect(skipped.duplicates).toBe(1);
      expect(skipped.copiesAdded).toBe(0);
      expect(skipped.imported).toBe(0);

      const added = await batchImportBooks(rows, { addCopiesToDuplicates: true });
      expect(added.duplicates).toBe(1);
      expect(added.copiesAdded).toBe(3);
      expect(added.imported).toBe(0);
    });

    it('imports 500 rows in under 10 seconds in bulk, and importing again adds 0 copies (M3 Gate 4)', async () => {
      const rows: ImportBookRow[] = Array.from({ length: 500 }, (_, i) => ({
        title: `Bulk Title ${i + 1}`,
        author: `Bulk Author ${i + 1}`,
        isbn: `978000000${String(i + 1).padStart(4, '0')}`,
        stock: 2,
      }));

      // First run: no existing books; insert returns 500 book rows
      const insertedBooks = rows.map((r, i) => ({
        id: `bulk-book-${i + 1}`,
        title: r.title,
        author: r.author,
        isbn: String(r.isbn),
      }));

      mockClientHelper.setTableResponse('books', []);
      const booksBuilder = mockClientHelper.getTableBuilder('books');
      booksBuilder.insert.mockReturnValueOnce({
        select: vi.fn().mockResolvedValueOnce({ data: insertedBooks, error: null }),
      } as unknown as ReturnType<typeof booksBuilder.insert>);

      const start = performance.now();
      const firstResult = await batchImportBooks(rows);
      const elapsedMs = performance.now() - start;

      expect(elapsedMs).toBeLessThan(10000);
      expect(firstResult.success).toBe(true);
      expect(firstResult.imported).toBe(500);
      expect(firstResult.copiesAdded).toBe(1000);
      expect(firstResult.duplicates).toBe(0);

      // Verify bulk insert was called once for books and once for book_copies
      expect(booksBuilder.insert).toHaveBeenCalledTimes(1);
      const copyBuilder = mockClientHelper.getTableBuilder('book_copies');
      expect(copyBuilder.insert).toHaveBeenCalledTimes(1);

      // Second run: all 500 books already exist in DB
      vi.clearAllMocks();
      mockClientHelper.setTableResponse('books', insertedBooks);
      const secondResult = await batchImportBooks(rows);
      expect(secondResult.success).toBe(true);
      expect(secondResult.imported).toBe(0);
      expect(secondResult.copiesAdded).toBe(0);
      expect(secondResult.duplicates).toBe(500);
      expect(copyBuilder.insert).not.toHaveBeenCalled();
    });

    it('imports new book records and resolves existing categories', async () => {
      mockClientHelper.setTableResponse('books', []); // No existing books initially
      mockClientHelper.setTableResponse('categories', { id: 'cat-db-id' }); // Category found

      const insertedBook = { id: 'new-book-1', title: 'Refactoring', author: 'Martin Fowler' };
      const booksBuilder = mockClientHelper.getTableBuilder('books');
      // Bulk insert: insert([...]).select() returns the new rows
      booksBuilder.insert.mockReturnValueOnce({
        select: vi.fn().mockResolvedValueOnce({ data: [insertedBook], error: null }),
      } as unknown as ReturnType<typeof booksBuilder.insert>);

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
      booksBuilder.insert.mockReturnValueOnce({
        select: vi.fn().mockResolvedValueOnce({ data: [{ id: 'book-new', title: 'Deep Learning', author: 'Ian Goodfellow' }], error: null }),
      } as unknown as ReturnType<typeof booksBuilder.insert>);

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

    it('caps stock at 50 and treats a repeated row in the same file as a duplicate', async () => {
      mockClientHelper.setTableResponse('books', []);
      const booksBuilder = mockClientHelper.getTableBuilder('books');
      booksBuilder.insert.mockReturnValueOnce({
        select: vi.fn().mockResolvedValueOnce({ data: [{ id: 'b-1', title: 'SICP', author: 'Abelson' }], error: null }),
      } as unknown as ReturnType<typeof booksBuilder.insert>);

      const result = await batchImportBooks([
        { title: 'SICP', author: 'Abelson', stock: 80 },
        { title: 'sicp', author: 'ABELSON', stock: 5 },
      ]);

      expect(result.imported).toBe(1);
      expect(result.duplicates).toBe(1);
      expect(result.copiesAdded).toBe(50);
      expect(booksBuilder.insert.mock.calls[0][0]).toHaveLength(1);
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
    it.each(['   ', '123', '978BADISBN0000'])('rejects malformed ISBN %s without enqueuing', async isbn => {
      expect(await lookupAndImportISBN(isbn)).toEqual({ success: false, isbn, error: 'Invalid ISBN number provided' });
      expect(mockClientHelper.rpc).not.toHaveBeenCalled();
      expect(scheduleCatalogImport).not.toHaveBeenCalled();
    });

    it('queues one requested copy without fetching metadata or changing inventory inline', async () => {
      const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
      const result = await lookupAndImportISBN('978-0201633610');
      expect(result).toMatchObject({ success: true, status: 'queued', isbn: '9780201633610', jobId: expect.any(String) });
      expect(mockClientHelper.rpc).toHaveBeenCalledWith('catalog_import_enqueue', {
        p_job: result.jobId, p_actor: 'staff-1', p_label: expect.any(String),
        p_items: [{ mode: 'create', isbn: '9780201633610', requested_copies: 1 }],
      });
      expect(scheduleCatalogImport).toHaveBeenCalledOnce();
      expect(mockClientHelper.from).not.toHaveBeenCalled();
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('returns enqueue failures without claiming the import succeeded', async () => {
      mockClientHelper.setRpcResponse(null, { message: 'Queue unavailable' });
      expect(await lookupAndImportISBN('9780201633610')).toMatchObject({ success: false, error: expect.stringContaining('Queue unavailable') });
      expect(scheduleCatalogImport).not.toHaveBeenCalled();
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
    it.each(['librarian', 'student_assistant'] as const)('allows %s to read archived book information without management data', async (role) => {
      vi.mocked(getMe).mockResolvedValue(mockStaffUser(role) as unknown as Awaited<ReturnType<typeof getMe>>);
      vi.mocked(getPublicBookById).mockResolvedValue(null);
      const archivedBook = { id: 'archived-book', title: 'Archived Book', is_active: false };
      mockClientHelper.setTableResponse('books', archivedBook);

      const result = await getBookPublicDetails('archived-book');

      expect(result.book).toEqual(archivedBook);
      expect(mockClientHelper.getTableBuilder('books').eq).toHaveBeenCalledWith('id', 'archived-book');
      expect(mockClientHelper.from).not.toHaveBeenCalledWith('reservations');
    });

    it('does not expose archived titles to a student through the public detail action', async () => {
      vi.mocked(getMe).mockResolvedValue(mockStudentUser() as unknown as Awaited<ReturnType<typeof getMe>>);
      vi.mocked(getPublicBookById).mockResolvedValue(null);
      mockClientHelper.setTableResponse('books', { id: 'archived-book', is_active: false });

      expect((await getBookPublicDetails('archived-book')).book).toBeNull();
      expect(mockClientHelper.from).not.toHaveBeenCalledWith('books');
    });

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
