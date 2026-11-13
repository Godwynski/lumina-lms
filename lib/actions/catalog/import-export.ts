'use server';

import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { enqueueCatalogEnrichment, type EnrichmentBook } from '@/lib/catalog-import-worker';
import { scheduleCatalogImport } from '@/lib/catalog-import-scheduler';
import { logAuditActivity } from '@/lib/audit';
import { revalidateTag } from 'next/cache';
import { assertStaffCatalogAccess } from './auth';
import { getOrCreateCategoryByName } from './categories';

export interface ImportBookRow {
  title?: string;
  author?: string;
  isbn?: string | number;
  category?: string;
  category_name?: string;
  published_year?: string;
  description?: string;
  stock?: string | number;
  copiesCount?: string | number;
  cover_url?: string;
  tags?: string | string[];
  location?: string;
  section?: string;
  dewey_decimal?: string | number;
}

export interface GoogleOrOpenLibraryBookDetails {
  title: string;
  author: string;
  publisher: string | null;
  published_year: number | null;
  description: string | null;
  dewey_decimal: string | null;
  tags: string[];
}

/**
 * Fetches all books with their categories for high-performance client-side Excel/CSV export.
 */
export async function getBooksForExport() {
  const supabase = await assertStaffCatalogAccess();
  const { data, error } = await supabase
    .from('books')
    .select(`
      id, title, author, isbn, dewey_decimal, description, 
      published_year, cover_url, tags, location, section, is_active, created_at,
      categories(name)
    `)
    .order('title');

  if (error) {
    logger.error('catalog', 'Failed to fetch books for export', { error: error.message });
    throw new Error(`Failed to fetch books for export: ${error.message}`);
  }

  return data;
}

const MAX_BATCH_SIZE = 500;
const MAX_COPIES_PER_ROW = 50;
const PAGE_SIZE = 1000; // PostgREST returns at most 1,000 rows per request
const COPY_INSERT_CHUNK = 1000;

/**
 * Imports catalog rows in bulk: one insert for the new books, then their copies in chunks.
 * Books that already exist (same ISBN, or same title + author) are skipped unless
 * `addCopiesToDuplicates` is set, so running the same file twice never doubles the stock.
 */
export async function batchImportBooks(
  books: ImportBookRow[],
  options: { addCopiesToDuplicates?: boolean } = {}
) {
  const supabase = await assertStaffCatalogAccess();

  if (books.length > MAX_BATCH_SIZE) {
    throw new Error(`Maximum batch size is ${MAX_BATCH_SIZE} rows per import.`);
  }

  // Every existing book, page by page, so the duplicate check also sees books past the first 1,000.
  const existingBooks: { id: string; isbn: string | null; title: string | null; author: string | null; cover_url?: string | null }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('books')
      .select('id, isbn, title, author, cover_url')
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Failed to perform duplicate check database prep: ${error.message}`);
    }
    const page = Array.isArray(data) ? data : [];
    existingBooks.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  // Lookup maps: value is an existing book id, or a pending row index (new in this file).
  const cleanIsbnOf = (isbn: string) => isbn.replace(/[- ]/g, '');
  const titleKey = (title: string, author: string) => `${title.trim().toLowerCase()}|||${author.trim().toLowerCase()}`;
  const isbnMap = new Map<string, string | number>();
  const titleAuthorMap = new Map<string, string | number>();
  for (const b of existingBooks) {
    if (b.isbn) isbnMap.set(cleanIsbnOf(b.isbn.trim()), b.id);
    if (b.title && b.author) titleAuthorMap.set(titleKey(b.title, b.author), b.id);
  }

  const categoryCache = new Map<string, string>(); // lowerCategoryName -> categoryId
  const { data: existingCategories } = await supabase.from('categories').select('id, name');
  if (Array.isArray(existingCategories)) {
    existingCategories.forEach(c => {
      if (c && c.name) categoryCache.set(c.name.trim().toLowerCase(), c.id);
    });
  }

  const logs: string[] = [];
  let duplicateCount = 0;
  const newBooks: { row: string; key: string; copies: number; insert: Record<string, unknown> }[] = [];
  const copiesForExisting: { book_id: string; status: string }[] = [];
  const enrichmentBooks = new Map<string, EnrichmentBook>();
  const existingById = new Map(existingBooks.map(book => [book.id, book]));

  for (let i = 0; i < books.length; i++) {
    const row = books[i];
    const indexStr = `Row ${i + 1}`;
    const title = row.title?.trim();
    const author = row.author?.trim();

    if (!title || !author) {
      logs.push(`[${indexStr}] Skipped: Missing title or author`);
      continue;
    }

    const isbn = row.isbn ? String(row.isbn).trim() : '';
    const cleanIsbn = cleanIsbnOf(isbn);
    const key = titleKey(title, author);
    const stock = parseInt(String(row.stock ?? row.copiesCount ?? '1'), 10);
    const copies = isNaN(stock) ? 1 : Math.min(Math.max(stock, 0), MAX_COPIES_PER_ROW);
    if (!isNaN(stock) && stock > MAX_COPIES_PER_ROW) {
      logs.push(`[${indexStr}] Stock capped at ${MAX_COPIES_PER_ROW} copies (file said ${stock}).`);
    }

    const match = (cleanIsbn ? isbnMap.get(cleanIsbn) : undefined) ?? titleAuthorMap.get(key);
    if (match !== undefined) {
      if (typeof match === 'string') {
        const existing = existingById.get(match);
        enrichmentBooks.set(match, {
          id: match, isbn: existing?.isbn || isbn || null, title: existing?.title || title,
          cover_url: row.cover_url || enrichmentBooks.get(match)?.cover_url || existing?.cover_url || null,
        });
      } else if (row.cover_url && !newBooks[match].insert.cover_url) {
        newBooks[match].insert.cover_url = row.cover_url;
      }
      duplicateCount++;
      const reason = cleanIsbn && isbnMap.has(cleanIsbn) ? `matching ISBN (${isbn})` : `matching Title & Author ("${title}" by ${author})`;
      if (!options.addCopiesToDuplicates || copies === 0) {
        logs.push(`[${indexStr}] Skipped duplicate (${reason}).`);
      } else if (typeof match === 'number') {
        newBooks[match].copies = Math.min(newBooks[match].copies + copies, MAX_COPIES_PER_ROW);
        logs.push(`[${indexStr}] Duplicate of an earlier row (${reason}): copies added to it.`);
      } else {
        for (let c = 0; c < copies; c++) copiesForExisting.push({ book_id: match, status: 'AVAILABLE' });
        logs.push(`[${indexStr}] Duplicate (${reason}): adding ${copies} copies to the existing book.`);
      }
      continue;
    }

    let categoryId: string | null = null;
    const categoryName = row.category?.trim() || row.category_name?.trim();
    if (categoryName) {
      const lowerCat = categoryName.toLowerCase();
      categoryId = categoryCache.get(lowerCat) ?? (await getOrCreateCategoryByName(supabase, categoryName));
      if (categoryId) categoryCache.set(lowerCat, categoryId);
    }

    let tagsArray: string[] = [];
    if (Array.isArray(row.tags)) {
      tagsArray = row.tags.map((t: unknown) => String(t).trim());
    } else if (typeof row.tags === 'string') {
      tagsArray = row.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    }

    const index = newBooks.length;
    if (cleanIsbn) isbnMap.set(cleanIsbn, index);
    titleAuthorMap.set(key, index);
    newBooks.push({
      row: indexStr,
      key,
      copies,
      insert: {
        title,
        author,
        isbn: isbn || null,
        category_id: categoryId || null,
        description: row.description || null,
        published_year: row.published_year ? parseInt(row.published_year, 10) : null,
        cover_url: row.cover_url || null,
        tags: tagsArray,
        location: row.location || null,
        section: row.section || null,
        dewey_decimal: row.dewey_decimal ? String(row.dewey_decimal).trim() : null,
        is_active: true,
      },
    });
  }

  // One insert for all new books; match the returned ids back by title + author (unique in this batch).
  const copyRows = [...copiesForExisting];
  let importedCount = 0;
  if (newBooks.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('books')
      .insert(newBooks.map(b => b.insert))
      .select('id, title, author, isbn, cover_url');
    if (insertError) throw new Error(`Import failed, no books were added: ${insertError.message}`);

    const idByKey = new Map((inserted ?? []).map((b: { id: string; title: string; author: string }) => [titleKey(b.title, b.author), b.id]));
    for (const b of newBooks) {
      const id = idByKey.get(b.key);
      if (!id) continue;
      importedCount++;
      enrichmentBooks.set(id, { id, isbn: b.insert.isbn as string | null, title: String(b.insert.title), cover_url: b.insert.cover_url as string | null });
      for (let c = 0; c < b.copies; c++) copyRows.push({ book_id: id, status: 'AVAILABLE' });
      logs.push(`[${b.row}] Imported "${b.insert.title}" by ${b.insert.author} (${b.copies} copies).`);
    }
  }

  let copiesAddedCount = 0;
  for (let i = 0; i < copyRows.length; i += COPY_INSERT_CHUNK) {
    const chunk = copyRows.slice(i, i + COPY_INSERT_CHUNK);
    const { error: copyError } = await supabase.from('book_copies').insert(chunk);
    if (copyError) {
      logs.push(`Failed to add ${chunk.length} copies: ${copyError.message}`);
    } else {
      copiesAddedCount += chunk.length;
    }
  }

  const { data: authData } = await supabase.auth.getUser();
  await logAuditActivity(
    authData?.user?.id,
    'book',
    null,
    'batch_import',
    `Batch import: ${importedCount} books created, ${copiesAddedCount} copies added, ${duplicateCount} duplicates.`,
    { rows: books.length, imported: importedCount, copiesAdded: copiesAddedCount, duplicates: duplicateCount, addCopiesToDuplicates: Boolean(options.addCopiesToDuplicates) }
  );

  let enrichmentJobId: string | undefined;
  if (enrichmentBooks.size) {
    try {
      enrichmentJobId = await enqueueCatalogEnrichment([...enrichmentBooks.values()], authData?.user?.id || null) || undefined;
      if (enrichmentJobId) scheduleCatalogImport();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown queue error';
      logs.push(`Books saved, but metadata and cover enrichment could not be started: ${message}`);
      logger.warn('catalog', 'Batch import enrichment could not be started', { error });
    }
  }

  revalidateTag('public-books', 'max');
  revalidateTag('catalog', 'max');
  revalidateTag('books', 'max');

  return {
    success: true,
    imported: importedCount,
    copiesAdded: copiesAddedCount,
    duplicates: duplicateCount,
    ...(enrichmentJobId ? { enrichmentJobId } : {}),
    logs
  };
}

/** Queues a single ISBN import; metadata, cover and inventory writes run in the durable worker. */
export async function lookupAndImportISBN(isbn: string) {
  const supabase = await assertStaffCatalogAccess();
  const cleanIsbn = isbn.replace(/[\s-]/g, '').toUpperCase();
  if (!/^(?:\d{9}[\dX]|\d{13})$/.test(cleanIsbn)) {
    return { success: false, isbn, error: 'Invalid ISBN number provided' };
  }

  const jobId = crypto.randomUUID();
  try {
    const { data: authData } = await supabase.auth.getUser();
    const { error } = await createAdminClient().rpc('catalog_import_enqueue', {
      p_job: jobId, p_actor: authData?.user?.id || null, p_label: 'ISBN import',
      p_items: [{ mode: 'create', isbn: cleanIsbn, requested_copies: 1 }],
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    return { success: false, isbn: cleanIsbn, error: `Could not queue ISBN import: ${error instanceof Error ? error.message : 'Unknown queue error'}` };
  }
  try { scheduleCatalogImport(); }
  catch (error) { logger.warn('catalog', 'Saved ISBN import could not be started', { error }); }
  return { success: true, status: 'queued', isbn: cleanIsbn, jobId, message: 'ISBN import queued. Metadata and cover progress can be reviewed in batch tasks.' };
}
