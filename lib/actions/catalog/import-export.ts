'use server';

import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { enqueueCatalogEnrichment, type EnrichmentBook } from '@/lib/catalog-import-worker';
import { scheduleCatalogImport } from '@/lib/catalog-import-scheduler';
import { logAuditActivity } from '@/lib/audit';
import { revalidateTag } from 'next/cache';
import { assertStaffCatalogAccess } from './auth';
import { getBookOrdering } from '@/lib/catalog-sort';
import { assertRole } from '@/lib/auth-helpers';
import { copyAcquisitionSchema, hasCopyAcquisition, type CopyAcquisition, type CopyLifecycle } from '@/lib/copy-acquisition';
import { toCsv } from '@/lib/csv';

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
  rowNumber?: number;
  acquisition?: CopyAcquisition;
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

export interface ExportBooksFilters {
  query?: string;
  categoryId?: string;
  status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
  sort?: string;
}

/**
 * Fetches books with their categories for client-side Excel/CSV/report export,
 * honoring any active inventory filters.
 */
export async function getBooksForExport(filters?: ExportBooksFilters) {
  const supabase = await assertStaffCatalogAccess();
  let dbQuery = supabase
    .from('books')
    .select(`
      id, title, author, isbn, dewey_decimal, description, 
      published_year, cover_url, tags, location, section, is_active, created_at,
      total_copies, available_copies,
      categories(name)
    `);

  if (filters) {
    const status = filters.status || 'ACTIVE';
    if (status !== 'ALL') {
      dbQuery = dbQuery.eq('is_active', status === 'ACTIVE');
    }

    const cleanQuery = filters.query?.trim();
    if (cleanQuery) {
      const pattern = `%${cleanQuery.replace(/[%_(),.:*\\"]/g, '_')}%`;
      if (cleanQuery.length < 3) {
        dbQuery = dbQuery.ilike('title', pattern);
      } else {
        dbQuery = dbQuery.or(`title.ilike.${pattern},author.ilike.${pattern},isbn.ilike.${pattern}`);
      }
    }

    if (filters.categoryId && filters.categoryId !== 'all') {
      const categoryIds = filters.categoryId.split(',').filter(Boolean);
      if (categoryIds.length > 0) {
        dbQuery = dbQuery.in('category_id', categoryIds);
      }
    }

    const { sortBy, sortOrder } = getBookOrdering(filters.sort || 'title_asc', false);
    const sortColumn = sortBy === 'availability' ? 'available_copies' : sortBy === 'relevance' ? 'title' : sortBy;
    const ascending = sortOrder === 'asc';
    dbQuery = dbQuery.order(sortColumn, { ascending }).order('id', { ascending });
  } else {
    dbQuery = dbQuery.order('title');
  }

  const { data, error } = await dbQuery;

  if (error) {
    logger.error('catalog', 'Failed to fetch books for export', { error: error.message });
    throw new Error(`Failed to fetch books for export: ${error.message}`);
  }

  return data;
}

const MAX_BATCH_SIZE = 500;
const MAX_COPIES_PER_ROW = 50;
const PAGE_SIZE = 1000; // PostgREST returns at most 1,000 rows per request

interface CopyRecordExportRow {
  accession_number: string | null;
  status: string | null;
  books: { title: string; author: string | null; isbn: string | null } | null;
  book_copy_lifecycle: CopyLifecycle | null;
}

/** Staff register with one row per copy, including copies of archived titles. */
export async function getCopyRecordsForExport() {
  await assertRole(['librarian', 'super_admin']);
  const supabase = createAdminClient();
  const rows: unknown[][] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('book_copies')
      .select(`
        accession_number, status, books(title, author, isbn),
        book_copy_lifecycle(acquisition_method, acquired_on, purchase_price, disposition_on, sale_amount, last_lost_on)
      `)
      .order('accession_number')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      logger.error('catalog', 'Failed to export copy records', { error: error.message });
      throw new Error('Failed to export copy records.');
    }
    // PostgREST embeds an object for each of these to-one relationships.
    const page = data as unknown as CopyRecordExportRow[];
    for (const copy of page) {
      const book = copy.books;
      const lifecycle = copy.book_copy_lifecycle;
      rows.push([
        copy.accession_number, book?.title, book?.author, book?.isbn, copy.status,
        lifecycle?.acquisition_method, lifecycle?.acquired_on, lifecycle?.purchase_price,
        lifecycle?.disposition_on, lifecycle?.sale_amount, lifecycle?.last_lost_on,
      ]);
    }
    if (page.length < PAGE_SIZE) break;
  }

  return toCsv([
    'Accession number', 'Title', 'Author', 'ISBN', 'Status', 'Acquisition method',
    'Acquisition date', 'Price per copy', 'Disposition date', 'Proceeds', 'Last loss date',
  ], rows);
}

/**
 * Applies new titles and copies in one transaction.
 * Books that already exist (same ISBN, or same title + author) are skipped unless
 * `addCopiesToDuplicates` is set, so running the same file twice never doubles the stock.
 */
export async function batchImportBooks(
  books: ImportBookRow[],
  options: { addCopiesToDuplicates?: boolean } = {}
) {
  const { supabase, user } = await assertRole(['librarian', 'super_admin']);

  if (books.length > MAX_BATCH_SIZE) {
    throw new Error(`Maximum batch size is ${MAX_BATCH_SIZE} rows per import.`);
  }

  const getRowNumber = (row: ImportBookRow, index: number) =>
    row.rowNumber && Number.isSafeInteger(row.rowNumber) && row.rowNumber > 0 ? row.rowNumber : index + 1;
  const acquisitionByRow = books.map((row, index) => {
    if (row.acquisition == null) return null;
    const acquisition = copyAcquisitionSchema.safeParse(row.acquisition);
    if (!acquisition.success) {
      throw new Error(`Row ${getRowNumber(row, index)}: ${acquisition.error.issues[0].message}`);
    }
    return hasCopyAcquisition(acquisition.data) ? acquisition.data : null;
  });

  // Every existing book, page by page, so the duplicate check also sees books past the first 1,000.
  const existingBooks: { id: string; isbn: string | null; title: string | null; author: string | null; cover_url?: string | null }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('books')
      .select('id, isbn, title, author, cover_url')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Failed to perform duplicate check database prep: ${error.message}`);
    }
    const page = Array.isArray(data) ? data : [];
    existingBooks.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  // Lookup maps: value is an existing book id, or a pending row index (new in this file).
  const cleanIsbnOf = (isbn: string) => isbn.replace(/[\s-]/g, '').toUpperCase();
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
  const newBooks: {
    row: string;
    acquisitions: (CopyAcquisition | null)[];
    book: Record<string, unknown>;
    categoryName?: string;
  }[] = [];
  const copyRows: { book_id: string; acquisition?: CopyAcquisition }[] = [];
  const enrichmentBooks = new Map<string, EnrichmentBook>();
  const existingById = new Map(existingBooks.map(book => [book.id, book]));

  for (let i = 0; i < books.length; i++) {
    const row = books[i];
    const indexStr = `Row ${getRowNumber(row, i)}`;
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
    const acquisition = acquisitionByRow[i];
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
      } else if (row.cover_url && !newBooks[match].book.cover_url) {
        newBooks[match].book.cover_url = row.cover_url;
      }
      duplicateCount++;
      const reason = cleanIsbn && isbnMap.has(cleanIsbn) ? `matching ISBN (${isbn})` : `matching Title & Author ("${title}" by ${author})`;
      if (!options.addCopiesToDuplicates || copies === 0) {
        logs.push(`[${indexStr}] Skipped duplicate (${reason}).`);
      } else if (typeof match === 'number') {
        const pendingCopies = newBooks[match].acquisitions;
        const accepted = Math.min(copies, MAX_COPIES_PER_ROW - pendingCopies.length);
        pendingCopies.push(...Array.from({ length: accepted }, () => acquisition));
        logs.push(`[${indexStr}] Duplicate of an earlier row (${reason}): adding ${accepted} of ${copies} requested copies.`);
      } else {
        for (let copy = 0; copy < copies; copy++) {
          copyRows.push(acquisition ? { book_id: match, acquisition } : { book_id: match });
        }
        logs.push(`[${indexStr}] Duplicate (${reason}): adding ${copies} copies to the existing book.`);
      }
      continue;
    }

    const categoryName = row.category?.trim() || row.category_name?.trim();
    const categoryId = categoryName ? categoryCache.get(categoryName.toLowerCase()) ?? null : null;

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
      acquisitions: Array.from({ length: copies }, () => acquisition),
      ...(!categoryId && categoryName ? { categoryName } : {}),
      book: {
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

  let applied: { books: (EnrichmentBook & { author: string; copyIds: string[] })[]; copyIds: string[] } = { books: [], copyIds: [] };
  if (newBooks.length > 0 || copyRows.length > 0) {
    const { data, error } = await createAdminClient().rpc('apply_catalog_spreadsheet', {
      p_books: newBooks.map(({ book, acquisitions, categoryName }) => ({
        book, acquisitions, ...(categoryName ? { categoryName } : {}),
      })),
      p_copies: copyRows,
    });
    if (error) throw new Error(`Import failed. No books or copies were saved. ${error.message}`);
    if (!data) throw new Error('Could not verify the spreadsheet import result.');
    applied = data;
  }

  const bookIds = new Set(copyRows.map(copy => copy.book_id));
  const { copyIds } = applied;
  const importedCount = applied.books.length;
  const copiesAddedCount = copyIds.length;
  for (const [index, { id, title, author, isbn, cover_url, copyIds: bookCopyIds }] of applied.books.entries()) {
    bookIds.add(id);
    enrichmentBooks.set(id, { id, isbn, title, cover_url });
    logs.push(`[${newBooks[index].row}] Imported "${title}" by ${author} (${bookCopyIds.length} copies).`);
  }

  await logAuditActivity(
    user.id,
    'book',
    null,
    'batch_import',
    `Batch import: ${importedCount} books created, ${copiesAddedCount} copies added, ${duplicateCount} duplicates.`,
    { rows: books.length, imported: importedCount, copiesAdded: copiesAddedCount, duplicates: duplicateCount, addCopiesToDuplicates: Boolean(options.addCopiesToDuplicates), bookIds: [...bookIds], copyIds }
  );

  let enrichmentJobId: string | undefined;
  if (enrichmentBooks.size) {
    try {
      enrichmentJobId = await enqueueCatalogEnrichment([...enrichmentBooks.values()], user.id) || undefined;
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
  if (newBooks.some(book => book.categoryName)) revalidateTag('categories', 'max');

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
