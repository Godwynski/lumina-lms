import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  enqueueCatalogEnrichment,
  processCatalogImportChunk,
  type ImportItem,
} from '@/lib/catalog-import-worker';
import { catalogWorkerToken, scheduleCatalogImport } from '@/lib/catalog-import-scheduler';
import { lookupISBN } from '@/lib/isbn-lookup';
import { fetchImage, ImageFetchError } from '@/lib/fetch-image';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  revalidateTag: vi.fn(),
  afterCallbacks: [] as Array<() => Promise<void> | void>,
  upload: vi.fn(),
}));

vi.mock('next/server', () => ({
  after: (cb: () => Promise<void> | void) => {
    mocks.afterCallbacks.push(cb);
  },
}));
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => mocks.revalidateTag(...args),
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => mocks.createAdminClient(),
}));
vi.mock('@/lib/isbn-lookup', () => ({ lookupISBN: vi.fn() }));
vi.mock('@/lib/fetch-image', () => ({
  fetchImage: vi.fn(),
  ImageFetchError: class extends Error {
    constructor(
      message: string,
      public status?: number,
      public retryAfterMs?: number
    ) {
      super(message);
    }
  },
}));
vi.mock('sharp', () => ({
  default: () => ({
    rotate() {
      return this;
    },
    resize() {
      return this;
    },
    webp() {
      return this;
    },
    toBuffer: async () => Buffer.from('webp'),
  }),
}));

const baseItem = {
  id: 'item',
  lease: 'lease',
  job_id: 'job',
  isbn: '9781492040347',
  book_id: 'book',
  mode: 'enrich',
  requested_copies: 0,
  copies_applied: true,
  attempts: 1,
  metadata_status: 'complete',
  cover_status: 'pending',
  covers: [],
  cover_source: null,
  title: 'Book',
} as ImportItem;

const fullBook = {
  id: 'book',
  title: 'Book',
  author: 'Author',
  description: 'Description',
  published_year: 2020,
  dewey_decimal: '005',
  tags: [],
  cover_url: null,
};

function fakeClient(
  item: ImportItem | ImportItem[] | null,
  book: Record<string, unknown> | null,
  overrides?: {
    claimError?: { message: string } | null;
    applyError?: { message: string } | null;
    selectError?: { message: string } | null;
    uploadError?: { message: string } | null;
    enqueueError?: { message: string } | null;
  }
) {
  const claimed = Array.isArray(item) ? item : item ? [item] : [];
  const rpc = vi.fn(async (name: string) => {
    if (name === 'catalog_import_claim') {
      return { data: overrides?.claimError ? null : claimed, error: overrides?.claimError ?? null };
    }
    if (name === 'catalog_import_apply_book') {
      return { data: overrides?.applyError ? null : book?.id ?? null, error: overrides?.applyError ?? null };
    }
    if (name === 'catalog_import_enqueue') {
      return { data: null, error: overrides?.enqueueError ?? null };
    }
    return { data: true, error: null };
  });
  const builder = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle: async () => ({ data: book, error: overrides?.selectError ?? null }),
    single: async () => ({ data: book, error: overrides?.selectError ?? null }),
  };
  const upload = vi.fn(async () => ({ error: overrides?.uploadError ?? null }));
  const client = {
    rpc,
    from: () => builder,
    storage: {
      from: () => ({
        upload,
        getPublicUrl: () => ({
          data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/book-covers/test.webp' },
        }),
      }),
    },
  };
  return {
    client: client as unknown as NonNullable<Parameters<typeof processCatalogImportChunk>[0]>,
    rpc,
    upload,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(lookupISBN).mockReset();
  vi.mocked(fetchImage).mockReset();
  mocks.afterCallbacks.length = 0;
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('catalog-import-worker', () => {
  it('enqueues catalog enrichment batches, normalizes ISBNs, enforces bounds, and handles empty/RPC errors', async () => {
    const { client, rpc } = fakeClient([], fullBook);

    expect(await enqueueCatalogEnrichment([], 'admin-1', 'Empty', client)).toBeNull();
    expect(rpc).not.toHaveBeenCalled();

    const oversized = Array.from({ length: 501 }, (_, i) => ({
      id: `b-${i}`,
      isbn: '9780132350884',
      title: `Book ${i}`,
    }));
    await expect(enqueueCatalogEnrichment(oversized, 'admin-1', 'Too big', client)).rejects.toThrow(
      'Maximum batch size is 500 books.'
    );

    const jobId = await enqueueCatalogEnrichment(
      [
        { id: 'b1', isbn: '978-0-13-235088-x', title: 'Clean Code', cover_url: 'https://img.example/1.jpg' },
        { id: 'b2', isbn: null, title: 'No ISBN' },
      ],
      'admin-1',
      'Enrich missing',
      client
    );
    expect(jobId).toEqual(expect.any(String));
    expect(rpc).toHaveBeenCalledWith('catalog_import_enqueue', {
      p_job: jobId,
      p_actor: 'admin-1',
      p_label: 'Enrich missing',
      p_items: [
        {
          mode: 'enrich',
          requested_copies: 0,
          book_id: 'b1',
          isbn: '978013235088X',
          cover_source: 'https://img.example/1.jpg',
          title: 'Clean Code',
        },
        {
          mode: 'enrich',
          requested_copies: 0,
          book_id: 'b2',
          isbn: null,
          cover_source: null,
          title: 'No ISBN',
        },
      ],
    });

    const failing = fakeClient([], fullBook, { enqueueError: { message: 'Enqueue RPC error' } });
    await expect(
      enqueueCatalogEnrichment([{ id: 'b1', isbn: '1234567890', title: 'Book' }], 'admin-1', 'Fail', failing.client)
    ).rejects.toThrow('Enqueue RPC error');
  });

  it('throws when catalog_import_claim fails and returns processed: 0 when claim is empty', async () => {
    const failing = fakeClient([], fullBook, { claimError: { message: 'Claim failed' } });
    await expect(processCatalogImportChunk(failing.client)).rejects.toThrow('Claim failed');

    const empty = fakeClient([], fullBook);
    expect(await processCatalogImportChunk(empty.client)).toEqual({ processed: 0 });
  });

  it('applies existing stock without relying on an online metadata response', async () => {
    const { client, rpc } = fakeClient(
      { ...baseItem, mode: 'create', book_id: null, requested_copies: 2, copies_applied: false },
      { ...fullBook, cover_url: 'https://project.supabase.co/storage/v1/object/public/book-covers/existing.webp' }
    );
    const res = await processCatalogImportChunk(client);
    expect(res).toEqual({ processed: 1 });
    expect(rpc).toHaveBeenCalledWith('catalog_import_apply_book', expect.objectContaining({ p_data: {} }));
    expect(lookupISBN).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith('catalog_import_finish', expect.objectContaining({ p_status: 'complete' }));
  });

  it('looks up ISBN metadata, upgrades http cover URLs, and handles partial transient metadata retry backoff', async () => {
    const { client, rpc, upload } = fakeClient(
      { ...baseItem, mode: 'create', book_id: null, attempts: 2, metadata_status: 'pending' },
      { ...fullBook, description: null, cover_url: 'http://covers.example/cover.jpg' }
    );
    vi.mocked(lookupISBN).mockResolvedValue({
      success: true,
      transient: true,
      retryAfterMs: 15_000,
      covers: ['http://covers.example/cover.jpg'],
      book: { title: 'Book', author: 'Author', isbn: '9781492040347' },
    } as never);
    vi.mocked(fetchImage).mockResolvedValue({ buffer: Buffer.from('img'), contentType: 'image/jpeg' });

    await processCatalogImportChunk(client);

    expect(rpc).toHaveBeenCalledWith(
      'catalog_import_apply_book',
      expect.objectContaining({ p_data: { title: 'Book', author: 'Author', isbn: '9781492040347' } })
    );
    expect(fetchImage).toHaveBeenCalledWith('https://covers.example/cover.jpg');
    expect(upload).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(
      'catalog_import_finish',
      expect.objectContaining({
        p_status: 'retry',
        p_metadata: 'pending',
        p_cover: 'complete',
        p_delay_ms: 15_000,
      })
    );
  });

  it('handles missing original book, missing ISBN, and permanent not-found ISBN lookup failures', async () => {
    // Missing original book -> failed immediately
    const missingBook = fakeClient({ ...baseItem, book_id: 'deleted-book' }, null);
    await processCatalogImportChunk(missingBook.client);
    expect(missingBook.rpc).toHaveBeenCalledWith(
      'catalog_import_finish',
      expect.objectContaining({
        p_status: 'failed',
        p_error: 'The original book no longer exists.',
      })
    );

    // No book created and permanent ISBN not_found -> failed
    const notFound = fakeClient(
      { ...baseItem, mode: 'create', book_id: null, metadata_status: 'pending' },
      null
    );
    vi.mocked(lookupISBN).mockResolvedValueOnce({
      success: false,
      reason: 'not_found',
      error: 'ISBN not found.',
    });
    await processCatalogImportChunk(notFound.client);
    expect(notFound.rpc).toHaveBeenCalledWith(
      'catalog_import_finish',
      expect.objectContaining({
        p_status: 'failed',
        p_metadata: 'missing',
        p_cover: 'missing',
        p_error: 'ISBN not found.',
      })
    );

    // No ISBN supplied and incomplete metadata with no cover -> review
    const noIsbn = fakeClient(
      { ...baseItem, isbn: null, metadata_status: 'pending' },
      { ...fullBook, description: null, cover_url: null }
    );
    await processCatalogImportChunk(noIsbn.client);
    expect(noIsbn.rpc).toHaveBeenCalledWith(
      'catalog_import_finish',
      expect.objectContaining({
        p_status: 'review',
        p_metadata: 'missing',
        p_cover: 'missing',
        p_error: 'No ISBN supplied for metadata lookup. No cover source is available.',
      })
    );
  });

  it('retries transient ISBN unavailability with exponential backoff when no book exists yet', async () => {
    const { client, rpc } = fakeClient(
      { ...baseItem, mode: 'create', book_id: null, attempts: 3, metadata_status: 'pending' },
      null
    );
    vi.mocked(lookupISBN).mockResolvedValueOnce({
      success: false,
      reason: 'unavailable',
      error: 'Upstream 503',
      retryAfterMs: 1000,
    });
    await processCatalogImportChunk(client);
    // attempt 3 -> 2000 * 2**(3-1) = 8000 > retryAfterMs (1000)
    expect(rpc).toHaveBeenCalledWith(
      'catalog_import_finish',
      expect.objectContaining({
        p_status: 'retry',
        p_delay_ms: 8000,
      })
    );
  });

  it('tries the sixth cover source when earlier candidates return 404', async () => {
    const candidates = Array.from({ length: 6 }, (_, i) => `https://covers.example/${i}.jpg`);
    const { client, rpc, upload } = fakeClient({ ...baseItem, covers: candidates }, { ...fullBook });
    vi.mocked(fetchImage).mockImplementation(async (url) => {
      if (url !== candidates[5]) throw new ImageFetchError('Missing image', 404);
      return { buffer: Buffer.from('image'), contentType: 'image/jpeg' };
    });
    await processCatalogImportChunk(client);
    expect(fetchImage).toHaveBeenCalledTimes(6);
    expect(upload).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(
      'catalog_import_finish',
      expect.objectContaining({ p_status: 'complete', p_cover: 'complete' })
    );
  });

  it('falls back to OpenLibrary cover URL, retries 429/storage failures, and handles 20s cover budget', async () => {
    // 429 with retryAfterMs retains candidate and retries
    const rateLimited = fakeClient({ ...baseItem, attempts: 1, covers: [] }, { ...fullBook });
    vi.mocked(lookupISBN).mockResolvedValueOnce({
      success: false,
      reason: 'not_found',
      error: 'No metadata',
    });
    vi.mocked(fetchImage).mockRejectedValueOnce(new ImageFetchError('Rate limited', 429, 12_000));
    await processCatalogImportChunk(rateLimited.client);
    expect(fetchImage).toHaveBeenCalledWith('https://covers.openlibrary.org/b/isbn/9781492040347-L.jpg?default=false');
    expect(rateLimited.rpc).toHaveBeenCalledWith(
      'catalog_import_finish',
      expect.objectContaining({
        p_status: 'retry',
        p_cover: 'pending',
        p_delay_ms: 12_000,
        p_covers: ['https://covers.openlibrary.org/b/isbn/9781492040347-L.jpg?default=false'],
      })
    );

    // Storage upload failure is treated as transient cover error
    const uploadFail = fakeClient(
      { ...baseItem, attempts: 1, covers: ['https://covers.example/a.jpg'] },
      { ...fullBook },
      { uploadError: { message: 'Storage unavailable' } }
    );
    vi.mocked(fetchImage).mockResolvedValueOnce({ buffer: Buffer.from('img'), contentType: 'image/jpeg' });
    await processCatalogImportChunk(uploadFail.client);
    expect(uploadFail.rpc).toHaveBeenCalledWith(
      'catalog_import_finish',
      expect.objectContaining({ p_status: 'retry', p_cover: 'pending' })
    );

    // Time budget (> 20s) aborts cover loop cleanly into retry
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(22_000);
    const budgetClient = fakeClient(
      { ...baseItem, attempts: 1, covers: ['https://covers.example/a.jpg'] },
      { ...fullBook }
    );
    await processCatalogImportChunk(budgetClient.client);
    expect(budgetClient.rpc).toHaveBeenCalledWith(
      'catalog_import_finish',
      expect.objectContaining({ p_status: 'retry', p_cover: 'pending' })
    );
    nowSpy.mockRestore();
  });

  it('marks exhausted metadata requests as missing rather than permanently pending', async () => {
    const { client, rpc } = fakeClient(
      { ...baseItem, attempts: 4, metadata_status: 'pending' },
      { ...fullBook, description: null, cover_url: 'https://project.supabase.co/storage/v1/object/public/book-covers/existing.webp' }
    );
    vi.mocked(lookupISBN).mockResolvedValue({
      success: false,
      reason: 'unavailable',
      error: 'Try later',
      retryAfterMs: 60_000,
    });
    await processCatalogImportChunk(client);
    expect(rpc).toHaveBeenCalledWith(
      'catalog_import_finish',
      expect.objectContaining({ p_status: 'review', p_metadata: 'missing', p_cover: 'complete' })
    );
  });

  it('catches unexpected DB errors inside processItem and transitions retry vs failed based on attempts', async () => {
    const retryClient = fakeClient({ ...baseItem, attempts: 2 }, fullBook, {
      selectError: { message: 'Transient connection drop' },
    });
    await processCatalogImportChunk(retryClient.client);
    expect(retryClient.rpc).toHaveBeenCalledWith(
      'catalog_import_finish',
      expect.objectContaining({
        p_status: 'retry',
        p_error: 'Transient connection drop',
        p_delay_ms: 4000,
      })
    );

    const failedClient = fakeClient({ ...baseItem, attempts: 4 }, fullBook, {
      selectError: { message: 'Permanent failure' },
    });
    await processCatalogImportChunk(failedClient.client);
    expect(failedClient.rpc).toHaveBeenCalledWith(
      'catalog_import_finish',
      expect.objectContaining({
        p_status: 'failed',
        p_metadata: 'complete',
        p_cover: 'missing',
        p_error: 'Permanent failure',
      })
    );
  });
});

describe('catalog-import-scheduler', () => {
  function makeSchedulerClient(opts: {
    claimed?: ImportItem[];
    activeCount?: number;
    activeError?: { message: string } | null;
    nextRows?: Array<{ next_attempt_at?: string; lease_until?: string; status: string }>;
    nextError?: { message: string } | null;
  }) {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'catalog_import_claim') return { data: opts.claimed ?? [], error: null };
      if (name === 'catalog_import_apply_book') return { data: 'book', error: null };
      return { data: true, error: null };
    });

    let itemsQueryCall = 0;
    const bookBuilder = {
      select() { return this; },
      eq() { return this; },
      maybeSingle: async () => ({
        data: { ...fullBook, cover_url: 'https://project.supabase.co/storage/v1/object/public/book-covers/existing.webp' },
        error: null,
      }),
      single: async () => ({
        data: { ...fullBook, cover_url: 'https://project.supabase.co/storage/v1/object/public/book-covers/existing.webp' },
        error: null,
      }),
    };

    const itemsActiveBuilder = {
      select() { return this; },
      eq() { return this; },
      gt: async () => ({ count: opts.activeCount ?? 0, error: opts.activeError ?? null }),
    };

    const itemsNextBuilder = {
      select() { return this; },
      in() { return this; },
      order() { return this; },
      limit: async () => ({ data: opts.nextRows ?? [], error: opts.nextError ?? null }),
    };

    const client = {
      rpc,
      from: (table: string) => {
        if (table === 'catalog_import_items') {
          itemsQueryCall += 1;
          return itemsQueryCall === 1 ? itemsActiveBuilder : itemsNextBuilder;
        }
        return bookBuilder;
      },
      storage: {
        from: () => ({
          upload: vi.fn(async () => ({ error: null })),
          getPublicUrl: () => ({ data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/book-covers/test.webp' } }),
        }),
      },
    };
    return client;
  }

  it('catalogWorkerToken throws when SUPABASE_SERVICE_ROLE_KEY is missing and signs deterministically when set', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(() => catalogWorkerToken()).toThrow('Import worker is not configured.');

    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
    const token1 = catalogWorkerToken();
    const token2 = catalogWorkerToken();
    expect(token1).toMatch(/^[a-f0-9]{64}$/);
    expect(token1).toBe(token2);
  });

  it('stops without revalidating or querying items when idle and not a continuation', async () => {
    const client = makeSchedulerClient({ claimed: [] });
    mocks.createAdminClient.mockReturnValue(client);

    scheduleCatalogImport(false);
    expect(mocks.afterCallbacks).toHaveLength(1);
    await mocks.afterCallbacks[0]();

    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it('stops when continuation finds another active lease holding work', async () => {
    const client = makeSchedulerClient({ claimed: [], activeCount: 1 });
    mocks.createAdminClient.mockReturnValue(client);

    scheduleCatalogImport(true);
    await mocks.afterCallbacks[0]();

    expect(mocks.revalidateTag).toHaveBeenCalledTimes(3);
    expect(mocks.revalidateTag).toHaveBeenCalledWith('catalog', { expire: 0 });
    expect(mocks.revalidateTag).toHaveBeenCalledWith('books', { expire: 0 });
    expect(mocks.revalidateTag).toHaveBeenCalledWith('public-books', { expire: 0 });
  });

  it('revalidates and schedules continuation POST to /api/catalog/import-jobs/process when queued/processing items remain', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T00:00:00Z'));
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'secret-key');
    vi.stubEnv('VERCEL_URL', 'lumina.vercel.app');

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ accepted: true }), { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const client = makeSchedulerClient({
      claimed: [
        {
          ...baseItem,
          mode: 'create',
          book_id: null,
          requested_copies: 1,
          copies_applied: false,
        },
      ],
      activeCount: 0,
      nextRows: [{ status: 'processing', lease_until: '2026-11-14T00:00:02Z' }],
    });
    mocks.createAdminClient.mockReturnValue(client);

    scheduleCatalogImport(false);
    const pending = Promise.resolve(mocks.afterCallbacks[0]());
    await vi.advanceTimersByTimeAsync(2_000);
    await pending;

    expect(mocks.revalidateTag).toHaveBeenCalledWith('catalog', { expire: 0 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://lumina.vercel.app/api/catalog/import-jobs/process',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: `Bearer ${catalogWorkerToken()}` },
      })
    );
  });

  it('uses localhost fallback and logs error cleanly if active query, next query, or continuation fetch fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-14T00:00:00Z'));
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'secret-key');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '');
    vi.stubEnv('VERCEL_URL', '');

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue(new Response('error', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    // 1. Continuation HTTP 500 error
    mocks.createAdminClient.mockReturnValue(
      makeSchedulerClient({
        claimed: [],
        activeCount: 0,
        nextRows: [{ status: 'queued', next_attempt_at: '2026-11-14T00:00:00Z' }],
      })
    );
    scheduleCatalogImport(true);
    const pending = Promise.resolve(mocks.afterCallbacks[0]());
    await vi.advanceTimersByTimeAsync(1_000);
    await pending;

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/catalog/import-jobs/process',
      expect.anything()
    );
    expect(errSpy).toHaveBeenCalledWith(
      'Catalog import worker paused; saved progress can resume.',
      'Import continuation returned HTTP 500.'
    );

    // 2. activeError throws and is caught
    mocks.createAdminClient.mockReturnValue(
      makeSchedulerClient({ claimed: [], activeError: { message: 'Active check failed' } })
    );
    scheduleCatalogImport(true);
    await mocks.afterCallbacks[1]();
    expect(errSpy).toHaveBeenCalledWith(
      'Catalog import worker paused; saved progress can resume.',
      'Active check failed'
    );

    // 3. nextError throws and is caught
    mocks.createAdminClient.mockReturnValue(
      makeSchedulerClient({ claimed: [], activeCount: 0, nextError: { message: 'Next query failed' } })
    );
    scheduleCatalogImport(true);
    await mocks.afterCallbacks[2]();
    expect(errSpy).toHaveBeenCalledWith(
      'Catalog import worker paused; saved progress can resume.',
      'Next query failed'
    );

    // 4. No remaining items exits cleanly without calling fetch
    fetchMock.mockClear();
    mocks.createAdminClient.mockReturnValue(
      makeSchedulerClient({ claimed: [], activeCount: 0, nextRows: [] })
    );
    scheduleCatalogImport(true);
    await mocks.afterCallbacks[3]();
    expect(fetchMock).not.toHaveBeenCalled();

    errSpy.mockRestore();
  });
});
