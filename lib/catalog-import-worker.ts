import { createAdminClient } from '@/lib/supabase/admin';
import { lookupISBN } from '@/lib/isbn-lookup';
import { fetchImage, ImageFetchError } from '@/lib/fetch-image';
import sharp from 'sharp';

type Client = ReturnType<typeof createAdminClient>;
export interface ImportItem {
  id: string; job_id: string; isbn: string | null; book_id: string | null; mode: 'create' | 'enrich';
  requested_copies: number; copies_applied: boolean; attempts: number; lease: string;
  metadata_status: 'pending' | 'complete' | 'missing'; cover_status: 'pending' | 'complete' | 'missing';
  covers: string[]; cover_source: string | null; title: string | null;
}
export interface EnrichmentBook { id: string; isbn: string | null; title: string; cover_url?: string | null }

export async function enqueueCatalogEnrichment(books: EnrichmentBook[], actor: string | null, label = 'Catalog metadata and covers', client = createAdminClient()) {
  if (!books.length) return null;
  if (books.length > 500) throw new Error('Maximum batch size is 500 books.');
  const id = crypto.randomUUID();
  const { error } = await client.rpc('catalog_import_enqueue', {
    p_job: id, p_actor: actor, p_label: label,
    p_items: books.map(book => ({ mode: 'enrich', requested_copies: 0, book_id: book.id, isbn: book.isbn?.replace(/[\s-]/g, '').toUpperCase() || null, cover_source: book.cover_url || null, title: book.title })),
  });
  if (error) throw new Error(error.message);
  return id;
}

const internalCover = (url: string | null) => !!url?.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/book-covers/`);
const incompleteMetadata = (book: Record<string, unknown>) => !book.title || !book.author || !book.description || !book.published_year || !book.dewey_decimal;

async function processItem(client: Client, item: ImportItem) {
  const started = Date.now();
  let metadata = item.metadata_status, cover = item.cover_status;
  let candidates = Array.isArray(item.covers) ? item.covers : [];
  let coverUrl: string | null = null, expectedCover: string | null = null;
  let retry = false, delay = 0;
  const problems: string[] = [];
  const finish = async (status: string) => {
    if (status === 'review' || status === 'failed') {
      if (metadata === 'pending') metadata = 'missing';
      if (cover === 'pending') cover = 'missing';
    }
    const { error } = await client.rpc('catalog_import_finish', {
      p_item: item.id, p_lease: item.lease, p_status: status, p_metadata: metadata, p_cover: cover,
      p_error: problems.join(' ') || null, p_covers: candidates,
      p_delay_ms: status === 'retry' ? Math.max(delay, 2000 * 2 ** (item.attempts - 1)) : 0,
      p_cover_url: coverUrl, p_expected_cover: expectedCover,
    });
    if (error) throw new Error(error.message);
  };
  try {
    let book: Record<string, unknown> | null = null;
    if (!item.book_id && item.mode === 'create') {
      // Existing stock does not depend on an external provider being online.
      const resolved = await client.rpc('catalog_import_apply_book', { p_item: item.id, p_lease: item.lease, p_data: {} });
      if (resolved.error) throw new Error(resolved.error.message);
      if (resolved.data) item.book_id = resolved.data as string;
    }
    if (item.book_id) {
      const result = await client.from('books').select('id,title,author,isbn,description,published_year,dewey_decimal,tags,cover_url').eq('id', item.book_id).maybeSingle();
      if (result.error) throw new Error(result.error.message);
      book = result.data;
      if (!book) { problems.push('The original book no longer exists.'); await finish('failed'); return; }
    }
    if (!book || (metadata !== 'complete' && incompleteMetadata(book)) || !candidates.length && !internalCover(book.cover_url as string | null)) {
      if (item.isbn) {
        const lookup = await lookupISBN(item.isbn);
        if (lookup.success) {
          candidates = [...new Set([...candidates, item.cover_source, ...(lookup.covers || [lookup.book.cover_url])].filter(Boolean))] as string[];
          const applied = await client.rpc('catalog_import_apply_book', { p_item: item.id, p_lease: item.lease, p_data: lookup.book });
          if (applied.error) throw new Error(applied.error.message);
          item.book_id = applied.data as string;
          const updated = await client.from('books').select('id,title,author,isbn,description,published_year,dewey_decimal,tags,cover_url').eq('id', item.book_id).single();
          if (updated.error) throw new Error(updated.error.message);
          book = updated.data;
          metadata = incompleteMetadata(book!) ? 'missing' : 'complete';
          if (metadata === 'missing') problems.push('Some metadata is unavailable from online sources.');
          if (lookup.transient && metadata !== 'complete') { retry = true; metadata = 'pending'; delay = Math.max(delay, lookup.retryAfterMs || 0); }
        } else {
          metadata = lookup.reason === 'unavailable' ? 'pending' : 'missing';
          problems.push(lookup.error);
          retry = lookup.reason === 'unavailable'; delay = Math.max(delay, lookup.retryAfterMs || 0);
          if (!book) { await finish(retry && item.attempts < 4 ? 'retry' : 'failed'); return; }
        }
      } else {
        metadata = incompleteMetadata(book || {}) ? 'missing' : 'complete';
        if (metadata === 'missing') problems.push('No ISBN supplied for metadata lookup.');
      }
    } else metadata = incompleteMetadata(book) ? 'missing' : 'complete';

    if (!book || !item.book_id) { problems.push('No book information found.'); await finish('failed'); return; }
    expectedCover = book.cover_url as string | null;
    if (internalCover(expectedCover)) cover = 'complete';
    else {
      candidates = [...new Set([...candidates, expectedCover, item.cover_source].filter(Boolean))] as string[];
      if (!candidates.length && item.isbn) candidates.push(`https://covers.openlibrary.org/b/isbn/${item.isbn}-L.jpg?default=false`);
      cover = 'missing';
      let transientCover = false;
      for (const candidate of [...candidates]) {
        if (Date.now() - started > 20_000) { transientCover = true; break; }
        try {
          const secure = new URL(candidate); if (secure.protocol === 'http:') secure.protocol = 'https:';
          const { buffer } = await fetchImage(secure.toString());
          const output = await sharp(buffer, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1200, height: 1800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
          const path = `imports/${item.id}/${item.lease}.webp`;
          const uploaded = await client.storage.from('book-covers').upload(path, output, { contentType: 'image/webp', upsert: true, cacheControl: '3600' });
          if (uploaded.error) throw new Error(uploaded.error.message);
          coverUrl = client.storage.from('book-covers').getPublicUrl(path).data.publicUrl;
          cover = 'complete'; break;
        } catch (error) {
          const temporary = error instanceof ImageFetchError ? !error.status || error.status === 429 || error.status >= 500 : true;
          transientCover ||= temporary;
          candidates = candidates.filter(url => url !== candidate);
          if (temporary) candidates.push(candidate);
          if (error instanceof ImageFetchError) delay = Math.max(delay, error.retryAfterMs || 0);
        }
      }
      if (cover !== 'complete') {
        retry ||= transientCover; cover = transientCover && item.attempts < 4 ? 'pending' : 'missing';
        problems.push(candidates.length ? 'Cover could not be downloaded from the available sources.' : 'No cover source is available.');
      }
    }
    await finish(retry && item.attempts < 4 ? 'retry' : metadata === 'complete' && cover === 'complete' ? 'complete' : 'review');
  } catch (error) {
    problems.push(error instanceof Error ? error.message : 'Import failed.');
    await finish(item.attempts < 4 ? 'retry' : 'failed');
  }
}

/** Two global leased slots, not two slots per browser. Safe to call after a refresh. */
export async function processCatalogImportChunk(client = createAdminClient()) {
  const { data, error } = await client.rpc('catalog_import_claim');
  if (error) throw new Error(error.message);
  const items = (data || []) as ImportItem[];
  await Promise.all(items.map(item => processItem(client, item)));
  return { processed: items.length };
}
