import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { processCatalogImportChunk, type ImportItem } from '@/lib/catalog-import-worker';
import { lookupISBN } from '@/lib/isbn-lookup';
import { fetchImage, ImageFetchError } from '@/lib/fetch-image';

vi.mock('@/lib/isbn-lookup', () => ({ lookupISBN: vi.fn() }));
vi.mock('@/lib/fetch-image', () => ({ fetchImage: vi.fn(), ImageFetchError: class extends Error { constructor(message: string, public status?: number) { super(message); } } }));
vi.mock('sharp', () => ({ default: () => ({ rotate() { return this; }, resize() { return this; }, webp() { return this; }, toBuffer: async () => Buffer.from('webp') }) }));
const baseItem = { id: 'item', lease: 'lease', job_id: 'job', isbn: '9781492040347', book_id: 'book', mode: 'enrich', requested_copies: 0, copies_applied: true, attempts: 1, metadata_status: 'complete', cover_status: 'pending', covers: [], cover_source: null, title: 'Book' } as ImportItem;
const fullBook = { id: 'book', title: 'Book', author: 'Author', description: 'Description', published_year: 2020, dewey_decimal: '005', tags: [], cover_url: null };

function fakeClient(item: ImportItem, book: Record<string, unknown>) {
  const rpc = vi.fn(async (name: string) => ({ data: name === 'catalog_import_claim' ? [item] : name === 'catalog_import_apply_book' ? book.id : true, error: null }));
  const builder = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: book, error: null }), single: async () => ({ data: book, error: null }) };
  const upload = vi.fn(async () => ({ error: null }));
  const client = { rpc, from: () => builder, storage: { from: () => ({ upload, getPublicUrl: () => ({ data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/book-covers/test.webp' } }) }) } };
  return { client: client as unknown as NonNullable<Parameters<typeof processCatalogImportChunk>[0]>, rpc, upload };
}

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co'); });
afterEach(() => vi.unstubAllEnvs());

it('applies existing stock without relying on an online metadata response', async () => {
  const { client, rpc } = fakeClient({ ...baseItem, mode: 'create', book_id: null, requested_copies: 2, copies_applied: false }, { ...fullBook, cover_url: 'https://project.supabase.co/storage/v1/object/public/book-covers/existing.webp' });
  await processCatalogImportChunk(client);
  expect(rpc).toHaveBeenCalledWith('catalog_import_apply_book', expect.objectContaining({ p_data: {} }));
  expect(lookupISBN).not.toHaveBeenCalled();
  expect(rpc).toHaveBeenCalledWith('catalog_import_finish', expect.objectContaining({ p_status: 'complete' }));
});

it('tries the sixth cover source when earlier candidates return 404', async () => {
  const candidates = Array.from({ length: 6 }, (_, i) => `https://covers.example/${i}.jpg`);
  const { client, rpc, upload } = fakeClient({ ...baseItem, covers: candidates }, { ...fullBook });
  vi.mocked(fetchImage).mockImplementation(async url => {
    if (url !== candidates[5]) throw new ImageFetchError('Missing image', 404);
    return { buffer: Buffer.from('image'), contentType: 'image/jpeg' };
  });
  await processCatalogImportChunk(client);
  expect(fetchImage).toHaveBeenCalledTimes(6);
  expect(upload).toHaveBeenCalledOnce();
  expect(rpc).toHaveBeenCalledWith('catalog_import_finish', expect.objectContaining({ p_status: 'complete', p_cover: 'complete' }));
});

it('marks exhausted metadata requests as missing rather than permanently pending', async () => {
  const { client, rpc } = fakeClient({ ...baseItem, attempts: 4, metadata_status: 'pending' }, { ...fullBook, description: null, cover_url: 'https://project.supabase.co/storage/v1/object/public/book-covers/existing.webp' });
  vi.mocked(lookupISBN).mockResolvedValue({ success: false, reason: 'unavailable', error: 'Try later', retryAfterMs: 60_000 });
  await processCatalogImportChunk(client);
  expect(rpc).toHaveBeenCalledWith('catalog_import_finish', expect.objectContaining({ p_status: 'review', p_metadata: 'missing', p_cover: 'complete' }));
});
