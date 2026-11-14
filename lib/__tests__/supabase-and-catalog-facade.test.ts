import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createMockSupabaseClient,
  createMockQueryBuilder,
  type MockSupabaseClientHelper,
} from '@/test/mocks/supabase';

const mockCreateSupabaseJsClient = vi.fn();
const mockCreateBrowserClient = vi.fn();
const mockCreateServerClient = vi.fn();
const mockCookiesFn = vi.fn();
const mockRevalidateTag = vi.fn();
const mockRevalidatePath = vi.fn();
const mockLogAuditActivity = vi.fn().mockResolvedValue(undefined);
const mockScheduleCatalogImport = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateSupabaseJsClient(...args),
}));

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: (...args: unknown[]) => mockCreateBrowserClient(...args),
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

vi.mock('next/headers', () => ({
  cookies: () => mockCookiesFn(),
}));

vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
  revalidateTag: (...args: unknown[]) => mockRevalidateTag(...args),
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('@/lib/audit', () => ({
  logAuditActivity: (...args: unknown[]) => mockLogAuditActivity(...args),
}));

vi.mock('@/lib/catalog-import-scheduler', () => ({
  scheduleCatalogImport: (...args: unknown[]) => mockScheduleCatalogImport(...args),
}));

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client';
import {
  createClient as createServerSupabaseClient,
  createSafeClient,
} from '@/lib/supabase/server';
import * as catalogFacade from '@/lib/actions/catalog';
import type {
  ImportBookRow,
  GoogleOrOpenLibraryBookDetails,
  AdminReservationQueueEntry,
} from '@/lib/actions/catalog';
import { logger } from '@/lib/logger';

const ORIGINAL_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

function restoreSupabaseEnv() {
  if (ORIGINAL_ENV.NEXT_PUBLIC_SUPABASE_URL !== undefined) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_ENV.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (ORIGINAL_ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY !== undefined) {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ORIGINAL_ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  } else {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  }
  if (ORIGINAL_ENV.SUPABASE_SERVICE_ROLE_KEY !== undefined) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_ENV.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
}

describe('lib/supabase/admin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreSupabaseEnv();
  });

  afterEach(() => {
    restoreSupabaseEnv();
  });

  it('throws a clear error when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key-123';

    expect(() => createAdminClient()).toThrow('Missing Supabase admin environment variables');
    expect(mockCreateSupabaseJsClient).not.toHaveBeenCalled();
  });

  it('throws a clear error when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://my-project.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => createAdminClient()).toThrow('Missing Supabase admin environment variables');
    expect(mockCreateSupabaseJsClient).not.toHaveBeenCalled();
  });

  it('throws when both admin environment variables are empty', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = '';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';

    expect(() => createAdminClient()).toThrow('Missing Supabase admin environment variables');
    expect(mockCreateSupabaseJsClient).not.toHaveBeenCalled();
  });

  it('creates an admin client with autoRefreshToken=false and persistSession=false when env vars are set', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://admin-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret-role-key';
    const fakeAdminClient = { auth: { admin: {} } };
    mockCreateSupabaseJsClient.mockReturnValue(fakeAdminClient);

    const client = createAdminClient();

    expect(client).toBe(fakeAdminClient);
    expect(mockCreateSupabaseJsClient).toHaveBeenCalledWith(
      'https://admin-test.supabase.co',
      'secret-role-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  });
});

describe('lib/supabase/client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreSupabaseEnv();
  });

  afterEach(() => {
    restoreSupabaseEnv();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('uses configured env keys, isSingleton=true, and window.location.protocol in the browser', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://browser-test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'pub-key-abc';
    const fakeBrowserClient = { from: vi.fn() };
    mockCreateBrowserClient.mockReturnValue(fakeBrowserClient);

    const originalLocation = window.location;
    vi.stubGlobal('location', { ...originalLocation, protocol: 'https:' });

    const client = createBrowserSupabaseClient();

    expect(client).toBe(fakeBrowserClient);
    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      'https://browser-test.supabase.co',
      'pub-key-abc',
      {
        isSingleton: true,
        cookieOptions: {
          secure: true,
          sameSite: 'lax',
          path: '/',
        },
      }
    );
  });

  it('sets cookieOptions.secure=false in browser when protocol is http: and falls back when env vars are missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const fakeBrowserClient = { from: vi.fn() };
    mockCreateBrowserClient.mockReturnValue(fakeBrowserClient);

    const originalLocation = window.location;
    vi.stubGlobal('location', { ...originalLocation, protocol: 'http:' });

    createBrowserSupabaseClient();

    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      expect.stringMatching(/^eyJ/),
      {
        isSingleton: true,
        cookieOptions: {
          secure: false,
          sameSite: 'lax',
          path: '/',
        },
      }
    );
  });

  it('uses NODE_ENV === "production" for cookieOptions.secure when window is undefined (SSR)', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ssr.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'ssr-pub-key';
    mockCreateBrowserClient.mockReturnValue({});

    vi.stubGlobal('window', undefined);
    vi.stubEnv('NODE_ENV', 'production');
    createBrowserSupabaseClient();

    expect(mockCreateBrowserClient).toHaveBeenLastCalledWith(
      'https://ssr.supabase.co',
      'ssr-pub-key',
      {
        isSingleton: true,
        cookieOptions: {
          secure: true,
          sameSite: 'lax',
          path: '/',
        },
      }
    );

    vi.stubEnv('NODE_ENV', 'development');
    createBrowserSupabaseClient();

    expect(mockCreateBrowserClient).toHaveBeenLastCalledWith(
      'https://ssr.supabase.co',
      'ssr-pub-key',
      {
        isSingleton: true,
        cookieOptions: {
          secure: false,
          sameSite: 'lax',
          path: '/',
        },
      }
    );
  });
});

describe('lib/supabase/server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreSupabaseEnv();
  });

  afterEach(() => {
    restoreSupabaseEnv();
    vi.unstubAllEnvs();
  });

  it('createClient reads and writes cookies via next/headers and sets cookieOptions.secure by NODE_ENV', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://server.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'server-pub-key';
    vi.stubEnv('NODE_ENV', 'production');

    const storedCookies = [{ name: 'sb-token', value: 'abc123' }];
    const cookieStore = {
      getAll: vi.fn(() => storedCookies),
      set: vi.fn(),
    };
    mockCookiesFn.mockResolvedValue(cookieStore);
    const fakeServerClient = { auth: {} };
    mockCreateServerClient.mockReturnValue(fakeServerClient);

    const client = await createServerSupabaseClient();

    expect(client).toBe(fakeServerClient);
    expect(mockCookiesFn).toHaveBeenCalledTimes(1);
    expect(mockCreateServerClient).toHaveBeenCalledTimes(1);

    const [url, key, options] = mockCreateServerClient.mock.calls[0] as [
      string,
      string,
      {
        cookieOptions: { secure: boolean; sameSite: string; path: string };
        cookies: {
          getAll: () => unknown[];
          setAll: (cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => void;
        };
      },
    ];

    expect(url).toBe('https://server.supabase.co');
    expect(key).toBe('server-pub-key');
    expect(options.cookieOptions).toEqual({
      secure: true,
      sameSite: 'lax',
      path: '/',
    });

    expect(options.cookies.getAll()).toEqual(storedCookies);
    expect(cookieStore.getAll).toHaveBeenCalledTimes(1);

    options.cookies.setAll([
      { name: 'sb-access', value: 'tok1', options: { path: '/' } },
      { name: 'sb-refresh', value: 'tok2', options: { httpOnly: true } },
    ]);
    expect(cookieStore.set).toHaveBeenCalledTimes(2);
    expect(cookieStore.set).toHaveBeenNthCalledWith(1, 'sb-access', 'tok1', { path: '/' });
    expect(cookieStore.set).toHaveBeenNthCalledWith(2, 'sb-refresh', 'tok2', { httpOnly: true });
  });

  it('createClient catches errors thrown by cookieStore.set in Server Components and falls back when env vars are unset', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    vi.stubEnv('NODE_ENV', 'test');

    const cookieStore = {
      getAll: vi.fn(() => []),
      set: vi.fn(() => {
        throw new Error('Cookies can only be modified in a Server Action or Route Handler');
      }),
    };
    mockCookiesFn.mockResolvedValue(cookieStore);
    mockCreateServerClient.mockReturnValue({});

    await createServerSupabaseClient();

    const [url, key, options] = mockCreateServerClient.mock.calls[0] as [
      string,
      string,
      {
        cookieOptions: { secure: boolean; sameSite: string; path: string };
        cookies: {
          setAll: (cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => void;
        };
      },
    ];

    expect(url).toBe('http://localhost:54321');
    expect(key).toBe('dummy');
    expect(options.cookieOptions.secure).toBe(false);
    expect(() =>
      options.cookies.setAll([{ name: 'sb-access', value: 'tok1', options: {} }])
    ).not.toThrow();
    expect(cookieStore.set).toHaveBeenCalledTimes(1);
  });

  it('createSafeClient creates a server client with empty getAll, noop setAll, and no cookies() call', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const fakeSafeClient = { from: vi.fn() };
    mockCreateServerClient.mockReturnValue(fakeSafeClient);

    const client = createSafeClient();

    expect(client).toBe(fakeSafeClient);
    expect(mockCookiesFn).not.toHaveBeenCalled();

    const [url, key, options] = mockCreateServerClient.mock.calls[0] as [
      string,
      string,
      {
        cookies: {
          getAll: () => unknown[];
          setAll: (cookies: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => void;
        };
      },
    ];

    expect(url).toBe('http://localhost:54321');
    expect(key).toBe('dummy');
    expect(options.cookies.getAll()).toEqual([]);
    expect(() =>
      options.cookies.setAll([{ name: 'ignored', value: 'v', options: {} }])
    ).not.toThrow();
  });
});

describe('lib/actions/catalog facade', () => {
  let serverHelper: MockSupabaseClientHelper;
  let adminHelper: MockSupabaseClientHelper;

  function configureStaffSession(role: 'librarian' | 'super_admin' = 'librarian') {
    serverHelper.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'staff-user-1',
          email: 'librarian@sti.edu.ph',
          app_metadata: { role },
        },
      },
      error: null,
    });
    serverHelper.setTableResponse('profiles', {
      id: 'staff-user-1',
      email: 'librarian@sti.edu.ph',
      full_name: 'Head Librarian',
      role,
      status: 'ACTIVE',
      permissions: null,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    restoreSupabaseEnv();

    serverHelper = createMockSupabaseClient();
    adminHelper = createMockSupabaseClient();

    mockCookiesFn.mockResolvedValue({
      getAll: () => [],
      set: vi.fn(),
    });
    mockCreateServerClient.mockImplementation(() => serverHelper.client);
    mockCreateSupabaseJsClient.mockImplementation(() => adminHelper.client);
    configureStaffSession('librarian');
  });

  afterEach(() => {
    restoreSupabaseEnv();
  });

  it('re-exports and executes category functions (getCategories, getOrCreateCategoryByName)', async () => {
    const categories = [{ id: 'cat-1', name: 'Computer Science', slug: 'computer-science' }];
    serverHelper.setTableResponse('categories', categories, null);

    const fetched = await catalogFacade.getCategories();
    expect(fetched).toEqual(categories);

    // Existing category lookup via explicit supabase client
    const existingBuilder = createMockQueryBuilder({ id: 'cat-existing' }, null);
    serverHelper.from.mockImplementationOnce(() => existingBuilder);
    const existingId = await catalogFacade.getOrCreateCategoryByName(
      serverHelper.client as unknown as SupabaseClient,
      '  Computer Science  '
    );
    expect(existingId).toBe('cat-existing');

    // Blank category returns null
    const blankId = await catalogFacade.getOrCreateCategoryByName(
      serverHelper.client as unknown as SupabaseClient,
      '   '
    );
    expect(blankId).toBeNull();

    // Missing category creates a new one and revalidates tag
    const selectMissing = createMockQueryBuilder(null, null);
    const insertCreated = createMockQueryBuilder({ id: 'cat-created' }, null);
    let catCall = 0;
    serverHelper.from.mockImplementation(() => {
      catCall += 1;
      return catCall === 1 ? selectMissing : insertCreated;
    });
    const createdId = await catalogFacade.getOrCreateCategoryByName(
      serverHelper.client as unknown as SupabaseClient,
      'Data Structures'
    );
    expect(createdId).toBe('cat-created');
    expect(mockRevalidateTag).toHaveBeenCalledWith('categories', 'max');
  });

  it('re-exports and executes book CRUD & lifecycle functions (getBooks, createBook, updateBook, softDeleteBook, restoreBook)', async () => {
    const sampleBook = {
      id: 'book-1',
      title: 'Clean Code',
      author: 'Robert Martin',
      isbn: '9780132350884',
      is_active: true,
    };

    serverHelper.setTableResponse('books', [sampleBook], null, 1);
    const listed = await catalogFacade.getBooks('Clean', undefined, 1, 10, 'title_asc', 'ACTIVE');
    expect(listed).toEqual({ data: [sampleBook], count: 1 });

    // createBook
    serverHelper.setTableResponse('books', sampleBook, null);
    serverHelper.setTableResponse('book_copies', null, null);
    const created = await catalogFacade.createBook({
      bookData: {
        title: 'Clean Code',
        author: 'Robert Martin',
        isbn: '9780132350884',
        category_id: '11111111-1111-4111-8111-111111111111',
        is_active: true,
      },
      copiesCount: 2,
    });
    expect(created).toEqual({ success: true, data: sampleBook });

    // updateBook
    serverHelper.setTableResponse('books', { ...sampleBook, title: 'Clean Code 2e' }, null);
    const updated = await catalogFacade.updateBook({
      id: 'book-1',
      bookData: { title: 'Clean Code 2e' },
    });
    expect(updated).toEqual({
      success: true,
      data: { ...sampleBook, title: 'Clean Code 2e' },
    });

    // softDeleteBook
    serverHelper.setTableResponse('book_copies', null, null, 0);
    serverHelper.setTableResponse('reservations', null, null, 0);
    serverHelper.setTableResponse('books', { ...sampleBook, is_active: false }, null);
    const archived = await catalogFacade.softDeleteBook('book-1');
    expect(archived).toEqual({
      success: true,
      data: { ...sampleBook, is_active: false },
    });

    // restoreBook
    serverHelper.setTableResponse('books', { ...sampleBook, is_active: true }, null);
    const restored = await catalogFacade.restoreBook('book-1');
    expect(restored).toEqual({
      success: true,
      data: { ...sampleBook, is_active: true },
    });
  });

  it('re-exports and executes copy & detail functions (addBookCopies, updateBookCopyStatus, getBookPublicDetails, getBookAdminDetails)', async () => {
    // addBookCopies
    serverHelper.setTableResponse('book_copies', null, null);
    const added = await catalogFacade.addBookCopies({ bookId: 'book-1', copiesCount: 2 });
    expect(added).toEqual({ success: true, data: null });

    // updateBookCopyStatus: AVAILABLE -> MAINTENANCE
    const selectCurrent = createMockQueryBuilder({ status: 'AVAILABLE' }, null);
    const updateStatus = createMockQueryBuilder([{ id: 'copy-1' }], null);
    const selectFinal = createMockQueryBuilder(
      { id: 'copy-1', book_id: 'book-1', status: 'MAINTENANCE' },
      null
    );
    const copyQueue = [selectCurrent, updateStatus, selectFinal];
    const baseFrom = serverHelper.from.getMockImplementation();
    serverHelper.from.mockImplementation((table: string) => {
      if (table === 'book_copies' && copyQueue.length > 0) {
        return copyQueue.shift()!;
      }
      return baseFrom ? baseFrom(table) : serverHelper.getTableBuilder(table);
    });

    const copyMaint = await catalogFacade.updateBookCopyStatus({
      id: 'copy-1',
      status: 'MAINTENANCE',
    });
    expect(copyMaint).toEqual({
      success: true,
      data: { id: 'copy-1', book_id: 'book-1', status: 'MAINTENANCE' },
    });

    // updateBookCopyStatus: MAINTENANCE -> AVAILABLE triggers admin RPC release_copy
    const selectCurrentMaint = createMockQueryBuilder({ status: 'MAINTENANCE' }, null);
    const selectAfterRelease = createMockQueryBuilder(
      { id: 'copy-1', book_id: 'book-1', status: 'AVAILABLE' },
      null
    );
    copyQueue.push(selectCurrentMaint, selectAfterRelease);
    adminHelper.setRpcResponse(null, null, 'release_copy');

    const copyAvail = await catalogFacade.updateBookCopyStatus({
      id: 'copy-1',
      status: 'AVAILABLE',
    });
    expect(adminHelper.rpc).toHaveBeenCalledWith('release_copy', { p_copy_id: 'copy-1' });
    expect(copyAvail).toEqual({
      success: true,
      data: { id: 'copy-1', book_id: 'book-1', status: 'AVAILABLE' },
    });

    // getBookPublicDetails
    serverHelper.from.mockImplementation((table: string) => serverHelper.getTableBuilder(table));
    serverHelper.setTableResponse('books', { id: 'book-1', title: 'Clean Code' }, null);
    serverHelper.setRpcResponse('2026-12-01T00:00:00Z', null, 'get_next_due_date');
    serverHelper.setTableResponse('reservations', null, null);

    const publicDetails = await catalogFacade.getBookPublicDetails('book-1');
    expect(publicDetails).toEqual({
      book: { id: 'book-1', title: 'Clean Code' },
      availability: {
        nextAvailableDate: '2026-12-01T00:00:00Z',
        hasReservation: false,
        isReady: false,
        queuePosition: null,
        holdExpiresAt: null,
        reservationId: null,
      },
    });

    // getBookAdminDetails
    serverHelper.setTableResponse('books', { id: 'book-1', title: 'Clean Code' }, null);
    serverHelper.setTableResponse(
      'book_copies',
      [
        {
          id: 'copy-1',
          book_id: 'book-1',
          status: 'RESERVED',
          condition: 'GOOD',
          qr_string: 'QR-1',
          created_at: '2026-01-01',
          reservations: [
            {
              id: 'res-1',
              status: 'READY',
              queue_position: 1,
              hold_expires_at: '2026-12-02T00:00:00Z',
              profiles: { full_name: 'Student A', email: 'a@sti.edu.ph', student_id: 'S1' },
            },
          ],
        },
      ],
      null
    );
    const queueEntry: AdminReservationQueueEntry = {
      id: 'res-1',
      status: 'READY',
      queue_position: 1,
      hold_expires_at: '2026-12-02T00:00:00Z',
      reserved_at: '2026-01-02',
      user_id: 'stu-1',
      profiles: { full_name: 'Student A', email: 'a@sti.edu.ph', student_id: 'S1' },
    };
    serverHelper.setTableResponse('reservations', [queueEntry], null);

    const adminDetails = await catalogFacade.getBookAdminDetails('book-1');
    expect(adminDetails.book).toEqual({ id: 'book-1', title: 'Clean Code' });
    expect(adminDetails.copies).toHaveLength(1);
    expect(adminDetails.copies[0].reservation?.id).toBe('res-1');
    expect(adminDetails.queue).toEqual([queueEntry]);
  });

  it('re-exports and executes import/export functions (getBooksForExport, batchImportBooks, lookupAndImportISBN)', async () => {
    // getBooksForExport
    const exportRows = [{ id: 'b-1', title: 'Domain-Driven Design' }];
    serverHelper.setTableResponse('books', exportRows, null);
    const exported = await catalogFacade.getBooksForExport();
    expect(exported).toEqual(exportRows);

    // batchImportBooks
    const existingBooksPage = createMockQueryBuilder([], null);
    const insertedBooksBuilder = createMockQueryBuilder(
      [{ id: 'imp-1', title: 'Refactoring', author: 'Martin Fowler' }],
      null
    );
    const booksBuilders = [existingBooksPage, insertedBooksBuilder];
    const defaultFrom = serverHelper.from.getMockImplementation();
    serverHelper.from.mockImplementation((table: string) => {
      if (table === 'books' && booksBuilders.length > 0) {
        return booksBuilders.shift()!;
      }
      return defaultFrom ? defaultFrom(table) : serverHelper.getTableBuilder(table);
    });
    serverHelper.setTableResponse('categories', [], null);
    serverHelper.setTableResponse('book_copies', null, null);

    const importRow: ImportBookRow = {
      title: 'Refactoring',
      author: 'Martin Fowler',
      isbn: '9780201485677',
      stock: 2,
    };
    const batchResult = await catalogFacade.batchImportBooks([importRow]);
    expect(batchResult).toMatchObject({
      success: true,
      imported: 1,
      copiesAdded: 2,
      duplicates: 0,
    });
    expect(mockLogAuditActivity).toHaveBeenCalledWith(
      'staff-user-1',
      'book',
      null,
      'batch_import',
      expect.stringContaining('1 books created, 2 copies added'),
      expect.any(Object)
    );

    // lookupAndImportISBN: invalid blank ISBN
    serverHelper.from.mockImplementation((table: string) => serverHelper.getTableBuilder(table));
    const invalidIsbnResult = await catalogFacade.lookupAndImportISBN('   ');
    expect(invalidIsbnResult).toEqual({
      success: false,
      isbn: '   ',
      error: 'Invalid ISBN number provided',
    });

    // lookupAndImportISBN: valid ISBN queues catalog_import_jobs and schedules worker
    adminHelper.setRpcResponse(null, null, 'catalog_import_enqueue');
    const queuedIsbnResult = await catalogFacade.lookupAndImportISBN('978-0-13-235088-4');
    expect(queuedIsbnResult).toEqual({
      success: true,
      status: 'queued',
      isbn: '9780132350884',
      jobId: expect.any(String),
      message: 'ISBN import queued. Metadata and cover progress can be reviewed in batch tasks.',
    });
    expect(adminHelper.rpc).toHaveBeenCalledWith('catalog_import_enqueue', {
      p_job: queuedIsbnResult.jobId,
      p_actor: 'staff-user-1',
      p_label: 'ISBN import',
      p_items: [{ mode: 'create', isbn: '9780132350884', requested_copies: 1 }],
    });
    expect(mockScheduleCatalogImport).toHaveBeenCalled();

    // lookupAndImportISBN: enqueue RPC error returns failure
    adminHelper.setRpcResponse(null, { message: 'Queue unavailable' }, 'catalog_import_enqueue');
    const failedQueueResult = await catalogFacade.lookupAndImportISBN('978-0-13-235088-4');
    expect(failedQueueResult).toEqual({
      success: false,
      isbn: '9780132350884',
      error: 'Could not queue ISBN import: Queue unavailable',
    });

    // Type export sanity check
    const detailsShape: GoogleOrOpenLibraryBookDetails = {
      title: 'Test',
      author: 'Author',
      publisher: null,
      published_year: 2024,
      description: null,
      dewey_decimal: null,
      tags: ['CS'],
    };
    expect(detailsShape.tags).toEqual(['CS']);
  });
});

describe('lib/logger', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('logs structured JSON for info and warn with and without metadata', () => {
    logger.info('catalog', 'Book fetched', { bookId: 'b-1', count: 3 });
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const infoPayload = JSON.parse(infoSpy.mock.calls[0][0] as string);
    expect(infoPayload).toMatchObject({
      level: 'INFO',
      context: 'catalog',
      message: 'Book fetched',
      data: { bookId: 'b-1', count: 3 },
    });
    expect(Date.parse(infoPayload.timestamp)).not.toBeNaN();

    logger.warn('circulation', 'Late return detected');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warnPayload = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(warnPayload).toMatchObject({
      level: 'WARN',
      context: 'circulation',
      message: 'Late return detected',
    });
    expect('data' in warnPayload).toBe(false);
  });

  it('includes stack traces on Error objects only in development mode and redacts stack in production', () => {
    const err = new Error('Database timeout');

    vi.stubEnv('NODE_ENV', 'development');
    logger.error('db', 'Query failed', { query: 'books' }, err);
    const devPayload = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(devPayload).toMatchObject({
      level: 'ERROR',
      context: 'db',
      message: 'Query failed',
      data: { query: 'books' },
      error: {
        name: 'Error',
        message: 'Database timeout',
      },
    });
    expect(typeof devPayload.error.stack).toBe('string');

    vi.stubEnv('NODE_ENV', 'production');
    logger.error('db', 'Query failed in prod', undefined, err);
    const prodPayload = JSON.parse(errorSpy.mock.calls[1][0] as string);
    expect(prodPayload.error).toEqual({
      name: 'Error',
      message: 'Database timeout',
    });
    expect('stack' in prodPayload.error).toBe(false);
  });

  it('normalizes AbortError and non-Error values in logger.error', () => {
    const abortErr = Object.assign(new Error('The operation was aborted'), {
      name: 'AbortError',
    });
    logger.error('auth', 'Request aborted', undefined, abortErr);
    const abortPayload = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(abortPayload.error).toEqual({
      name: 'AbortError',
      message: 'Operation aborted (expected)',
    });

    logger.error('auth', 'Unexpected failure', { step: 2 }, 'string-error-payload');
    const unknownPayload = JSON.parse(errorSpy.mock.calls[1][0] as string);
    expect(unknownPayload.data).toEqual({ step: 2 });
    expect(unknownPayload.error).toEqual({
      name: 'UnknownError',
      message: 'string-error-payload',
    });

    logger.error('auth', 'No error object passed');
    const noErrPayload = JSON.parse(errorSpy.mock.calls[2][0] as string);
    expect('error' in noErrPayload).toBe(false);
  });

  it('emits debug logs only when NODE_ENV === "development"', () => {
    vi.stubEnv('NODE_ENV', 'production');
    logger.debug('cache', 'Skipped in production', { key: 'k1' });
    expect(debugSpy).not.toHaveBeenCalled();

    vi.stubEnv('NODE_ENV', 'test');
    logger.debug('cache', 'Skipped in test', { key: 'k2' });
    expect(debugSpy).not.toHaveBeenCalled();

    vi.stubEnv('NODE_ENV', 'development');
    logger.debug('cache', 'Cache miss', { key: 'k3' });
    expect(debugSpy).toHaveBeenCalledTimes(1);
    const debugPayload = JSON.parse(debugSpy.mock.calls[0][0] as string);
    expect(debugPayload).toMatchObject({
      level: 'DEBUG',
      context: 'cache',
      message: 'Cache miss',
      data: { key: 'k3' },
    });
  });
});
