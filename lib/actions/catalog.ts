'use server';
import type { Book, BookCopyWithReservation } from '@/lib/types';
import { SupabaseClient } from '@supabase/supabase-js';

interface RawCopy {
  id: string;
  book_id: string;
  status: string;
  condition: string;
  qr_string: string;
  created_at: string;
  reservations?: Array<{
    id: string;
    status: string;
    queue_position: number;
    hold_expires_at: string;
    profiles: Record<string, unknown> | null;
  }>;
}

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
import { createSafeAction } from './action-utils';
import { revalidateTag, revalidatePath } from 'next/cache';
import { unstable_cache } from 'next/cache';
import { BookSchema } from '../validations/catalog';
import { logger } from '../logger';
import { createSafeClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { getPublicBookById } from './public-catalog';
import { getBookAvailabilityStatus } from './reservations';
import { getMe } from '@/lib/auth-helpers';

async function assertStaffCatalogAccess() {
  const me = await getMe();
  if (!me || !me.isStaff) throw new Error('Unauthorized');
  
  // Only admin, librarian, and student assistant can access the catalog inventory
  if (me.role !== 'super_admin' && me.role !== 'librarian' && me.role !== 'student_assistant') {
    throw new Error('Access denied: Inventory management is restricted to authorized staff roles.');
  }

  return me.supabase;
}

// --- Categories ---

/**
 * Fetches all inventory categories. Results are cached via Next.js unstable_cache.
 * @returns Array of categories.
 */
export const getCategories = async () => {
  return unstable_cache(
    async () => {
      const supabase = createSafeClient();
      const { data, error } = await supabase.from('categories').select('id, name, slug, description, is_active, created_at').order('name');
      if (error) throw new Error(error.message);
      return data;
    },
    ['catalog-categories'],
    { revalidate: 3600, tags: ['categories'] }
  )();
};


// --- Books ---

/**
 * Retrieves a paginated list of books with optional filtering.
 * @param query - Search term for title, author, or ISBN.
 * @param categoryId - Filter by a specific category ID.
 * @param page - Current page for pagination.
 * @param pageSize - Number of items per page.
 * @param status - Filter by active status ('ACTIVE', 'ARCHIVED', or 'ALL').
 * @returns Object with book list and total count.
 */
export async function getBooks(
  query: string = '', 
  categoryId?: string, 
  page: number = 1, 
  pageSize: number = 10, 
  sort: string = 'title_asc',
  status: 'ACTIVE' | 'ARCHIVED' | 'ALL' = 'ACTIVE'
) {
  const supabase = await assertStaffCatalogAccess();
  
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let dbQuery = supabase
    .from('books')
    .select(`*, categories!left(name)`, { count: 'exact' });

  // Apply status filter
  if (status === 'ACTIVE') {
    dbQuery = dbQuery.eq('is_active', true);
  } else if (status === 'ARCHIVED') {
    dbQuery = dbQuery.eq('is_active', false);
  }
  
  if (query) {
    const cleanQuery = query.trim();
    if (cleanQuery) {
      if (cleanQuery.length < 3) {
        dbQuery = dbQuery.or(`title.ilike.%${cleanQuery}%,author.ilike.%${cleanQuery}%,isbn.ilike.%${cleanQuery}%`);
      } else {
        const terms = cleanQuery.split(/\s+/).filter(Boolean);
        const formattedQuery = terms.map(t => `${t}:*`).join(' & ');
        dbQuery = dbQuery.textSearch('search_vector', formattedQuery);
      }
    }
  }
  
  if (categoryId) {
    dbQuery = dbQuery.eq('category_id', categoryId);
  }
  
  // Apply server-side sorting
  switch (sort) {
    case 'newest':
      dbQuery = dbQuery.order('created_at', { ascending: false });
      break;
    case 'title_desc':
      dbQuery = dbQuery.order('title', { ascending: false });
      break;
    case 'availability_desc':
      dbQuery = dbQuery.order('available_copies', { ascending: false });
      break;
    case 'availability_asc':
      dbQuery = dbQuery.order('available_copies', { ascending: true });
      break;
    case 'title_asc':
    default:
      dbQuery = dbQuery.order('title', { ascending: true });
      break;
  }

  const { data, error, count } = await dbQuery.range(from, to);

  if (error) throw new Error(error.message);
  return { data, count: count || 0 };
}


const CreateBookSchema = z.object({
  bookData: BookSchema,
  copiesCount: z.number().min(0).default(1)
});

export const createBook = createSafeAction(
  CreateBookSchema,
  async ({ bookData, copiesCount }, { supabase }) => {
    const { data, error } = await supabase
      .from('books')
      .insert([bookData])
      .select()
      .single();
      
    if (error) {
      logger.error('catalog', 'Failed to insert book record', { error });
      throw new Error(`Failed to create book record: ${error.message}`);
    }

    // Automatically create copies
    if (copiesCount > 0) {
      const copies = Array.from({ length: copiesCount }).map(() => ({
        book_id: data.id,
        status: 'AVAILABLE'
      }));

      const { error: copiesError } = await supabase
        .from('book_copies')
        .insert(copies);

      if (copiesError) {
        logger.error('catalog', `Book created but copies failed for ID: ${data.id}`, { error: copiesError.message });
        await supabase.from('books').delete().eq('id', data.id);
        throw new Error('Failed to initialize book copies. Transaction rolled back.');
      }
    }

    // Fetch the updated book record with correct counts (synced by triggers)
    const { data: updatedData, error: refreshError } = await supabase
      .from('books')
      .select('*, categories(name)')
      .eq('id', data.id)
      .single();

    if (refreshError) {
      logger.error('catalog', 'Failed to refresh book record after copy sync', { error: refreshError });
    }

    const finalData = updatedData || data;

    logger.info('catalog', `Book created: ${bookData.title}`, { bookId: finalData.id, isbn: bookData.isbn });
    revalidateTag('catalog', 'max');
    revalidateTag('books', 'max');
    
    return [finalData, {
      reason: `Created new book: ${bookData.title}`,
      newValue: { ...bookData, copies_created: copiesCount },
      details: { isbn: bookData.isbn }
    }];
  },
  { 
    auditAction: "create", 
    auditEntity: "book", 
    allowedRoles: ['super_admin', 'librarian']
  }
);

export const updateBook = createSafeAction(
  z.object({ id: z.string(), bookData: BookSchema.partial() }),
  async ({ id, bookData }, { supabase }) => {
    // 1. Fetch old data for audit log
    const { data: oldData } = await supabase
      .from('books')
      .select('*')
      .eq('id', id)
      .single();

    // 2. Perform update
    const { data, error } = await supabase
      .from('books')
      .update(bookData)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw new Error(error.message);
    
    logger.info('catalog', `Book updated: ${id}`, { updates: bookData });
    revalidateTag('catalog', 'max');
    revalidateTag(`book-${id}`, 'max');
    
    return [data, {
      reason: `Updated book: ${data.title}`,
      oldValue: oldData,
      newValue: data,
      details: { updatedFields: Object.keys(bookData) }
    }];
  },
  { 
    auditAction: "update", 
    auditEntity: "book", 
    allowedRoles: ['super_admin', 'librarian']
  }
);

export const softDeleteBook = createSafeAction(
  z.string(),
  async (id, { supabase }) => {
    // Check for active borrowed copies
    const { count, error: countError } = await supabase
      .from('book_copies')
      .select('*', { count: 'exact', head: true })
      .eq('book_id', id)
      .eq('status', 'BORROWED');
      
    if (countError) throw new Error(countError.message);
    
    if (count && count > 0) {
      throw new Error('Cannot delete book: There are active borrowed copies.');
    }

    const { data, error } = await supabase
      .from('books')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw new Error(error.message);
    
    logger.warn('catalog', `Book soft-deleted: ${id}`);
    revalidateTag('catalog', 'max');
    revalidateTag('books', 'max');
    
    return [data, {
      reason: `Archived book: ${data.title}`,
      newValue: { is_active: false },
      oldValue: { is_active: true }
    }];
  },
  { 
    auditAction: "archive", 
    auditEntity: "book", 
    allowedRoles: ['super_admin', 'librarian']
  }
);

export const restoreBook = createSafeAction(
  z.string(),
  async (id, { supabase }) => {
    const { data, error } = await supabase
      .from('books')
      .update({ is_active: true })
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw new Error(error.message);
    
    logger.info('catalog', `Book restored: ${id}`);
    revalidateTag('catalog', 'max');
    revalidateTag('books', 'max');
    
    return [data, {
      reason: `Restored book: ${data.title}`,
      newValue: { is_active: true },
      oldValue: { is_active: false }
    }];
  },
  { 
    auditAction: "restore", 
    auditEntity: "book", 
    allowedRoles: ['super_admin', 'librarian']
  }
);


// --- Book Copies ---




export const addBookCopies = createSafeAction(
  z.object({
    bookId: z.string(),
    copiesCount: z.number().min(1).max(50)
  }),
  async ({ bookId, copiesCount }, { supabase }) => {
    const copies = Array.from({ length: copiesCount }).map(() => ({
      book_id: bookId,
      status: 'AVAILABLE'
    }));

    const { error } = await supabase
      .from('book_copies')
      .insert(copies);

    if (error) {
      logger.error('catalog', `Failed to add copies for book ID: ${bookId}`, { error: error.message });
      throw new Error('Failed to add book copies.');
    }

    revalidateTag('catalog', 'max');
    revalidateTag(`book-${bookId}`, 'max');
    revalidatePath(`/catalog/${bookId}`);
    
    return [null, {
      reason: `Added ${copiesCount} copies to book ID: ${bookId}`,
      details: { copiesCount }
    }];
  },
  { 
    auditAction: "create", 
    auditEntity: "book_copy", 
    allowedRoles: ['super_admin', 'librarian']
  }
);

export const updateBookCopyStatus = createSafeAction(
  z.object({ 
    id: z.string(), 
    status: z.enum(['AVAILABLE', 'BORROWED', 'MAINTENANCE', 'LOST']) 
  }),
  async ({ id, status }, { supabase }) => {
    const { data, error } = await supabase
      .from('book_copies')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw new Error(error.message);

    // If a copy is manually marked as AVAILABLE, MAINTENANCE, or LOST, 
    // we must close any lingering ACTIVE/OVERDUE borrowing records to prevent DB inconsistency.
    if (['AVAILABLE', 'MAINTENANCE', 'LOST'].includes(status)) {
      await supabase
        .from('borrowing_records')
        .update({ 
          status: 'RETURNED', 
          returned_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('book_copy_id', id)
        .in('status', ['ACTIVE', 'OVERDUE']);
    }
    
    
    revalidatePath('/catalog');
    revalidatePath(`/catalog/${data.book_id}`);
    
    return [data, {
      reason: `Changed book copy status to ${status}`,
      newValue: { status },
      details: { copyId: id }
    }];
  },
  { 
    auditAction: "update_status", 
    auditEntity: "book_copy", 
    allowedRoles: ['super_admin', 'librarian']
  }
);

/**
 * Fetches the full reservation queue for a book (READY + ACTIVE), enriched with
 * the reserver's profile: name, student ID, email, avatar_url.
 * READY entries appear first (the current hold), then ACTIVE sorted by queue_position.
 */
/**
 * Consolidated action for student view.
 */
export async function getBookPublicDetails(bookId: string) {
  const [book, availability] = await Promise.all([
    getPublicBookById(bookId),
    getBookAvailabilityStatus(bookId),
  ]);
  return { book: book as Book, availability };
}

export interface AdminReservationQueueEntry {
  id: string;
  status: string;
  queue_position: number;
  hold_expires_at: string | null;
  reserved_at: string;
  user_id: string;
  profiles: {
    full_name: string | null;
    email: string | null;
    student_id: string | null;
  } | {
    full_name: string | null;
    email: string | null;
    student_id: string | null;
  }[] | null;
}

/**
 * Consolidated action to fetch all data needed for the admin management view in one round-trip.
 * Combines book copies (with active reservations) and the full reservation queue.
 */
export async function getBookAdminDetails(bookId: string) {
  const supabase = await assertStaffCatalogAccess();

  const [bookResponse, copiesResponse, queueResponse] = await Promise.all([
    supabase
      .from('books')
      .select(`*, categories(name)`)
      .eq('id', bookId)
      .single(),
    supabase
      .from('book_copies')
      .select(`
        id, book_id, status, condition, qr_string, created_at,
        reservations!copy_id (
          id,
          status,
          queue_position,
          hold_expires_at,
          profiles!user_id (
            id,
            full_name,
            email,
            student_id
          )
        )
      `)
      .eq('book_id', bookId)
      .order('created_at', { ascending: false }),
    supabase
      .from('reservations')
      .select(`
        id,
        status,
        queue_position,
        hold_expires_at,
        reserved_at,
        copy_id,
        profiles!user_id (
          id,
          full_name,
          email,
          student_id,
          avatar_url
        ),
        book_copies!copy_id (
          qr_string
        )
      `)
      .eq('book_id', bookId)
      .in('status', ['READY', 'ACTIVE'])
      .order('status', { ascending: false })
      .order('queue_position', { ascending: true })
      .order('reserved_at', { ascending: true })
  ]);

  if (bookResponse.error) throw new Error(bookResponse.error.message);
  if (copiesResponse.error) throw new Error(copiesResponse.error.message);
  if (queueResponse.error) throw new Error(queueResponse.error.message);

  const normalizedCopies = ((copiesResponse.data ?? []) as unknown as RawCopy[]).map((copy) => {
    const activeRes = copy.reservations?.find(
      (r) => r.status === 'READY' || r.status === 'ACTIVE'
    );
    return {
      id: copy.id,
      book_id: copy.book_id,
      status: copy.status,
      condition: copy.condition,
      qr_string: copy.qr_string,
      created_at: copy.created_at,
      reservation: activeRes ? {
        id: activeRes.id,
        status: activeRes.status,
        queue_position: activeRes.queue_position,
        hold_expires_at: activeRes.hold_expires_at,
        profiles: activeRes.profiles || null
      } : null
    };
  }) as BookCopyWithReservation[];

  return {
    book: bookResponse.data as unknown as Book,
    copies: normalizedCopies,
    queue: (queueResponse.data ?? []) as unknown as AdminReservationQueueEntry[]
  };
}

// Helper to resolve or create a category in a transaction or simple query
async function getOrCreateCategoryByName(supabase: SupabaseClient, name: string) {
  const cleanName = name.trim();
  if (!cleanName) return null;

  // 1. Try to find existing category (case insensitive)
  const { data: existing, error } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', cleanName)
    .maybeSingle();

  if (error) {
    logger.error('catalog', `Error finding category: ${cleanName}`, { error: error.message });
  }

  if (existing) {
    return existing.id;
  }

  // 2. If it doesn't exist, create it!
  const slug = cleanName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const { data: created, error: createError } = await supabase
    .from('categories')
    .insert([{
      name: cleanName,
      slug,
      is_active: true,
      description: `Category created during batch import of books.`
    }])
    .select('id')
    .single();

  if (createError) {
    logger.error('catalog', `Error creating category: ${cleanName}`, { error: createError.message });
    throw new Error(`Failed to create category "${cleanName}": ${createError.message}`);
  }

  // Revalidate categories cache
  revalidateTag('categories', 'max');

  return created.id;
}

// Helper to download remote cover image, compress to WebP, and upload to Supabase
async function uploadCoverFromUrl(supabase: SupabaseClient, url: string): Promise<string | null> {
  if (!url || !url.startsWith("http")) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const bytes = await res.arrayBuffer();
    let buffer: Buffer = Buffer.from(bytes);

    // Convert to WebP using Sharp (dynamically imported to prevent serverless module resolution issues)
    try {
      const sharp = (await import("sharp")).default;
      buffer = await sharp(buffer)
        .webp({ quality: 85 })
        .toBuffer();
    } catch (err) {
      logger.error('catalog', 'Sharp conversion failed, uploading raw buffer', { error: err });
    }

    const crypto = await import("crypto");
    const uuid = crypto.randomUUID();
    const filename = `${uuid}.webp`;

    const { error: uploadError } = await supabase
      .storage
      .from('book-covers')
      .upload(filename, buffer, {
        contentType: "image/webp",
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      logger.error('catalog', `Supabase cover upload failed: ${uploadError.message}`);
      return null;
    }

    const { data: { publicUrl } } = supabase
      .storage
      .from('book-covers')
      .getPublicUrl(filename);

    return publicUrl;
  } catch (error) {
    logger.error('catalog', `Failed to upload cover from URL: ${url}`, { error });
    return null;
  }
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

/**
 * Processes a batch of book metadata rows for import.
 * Supports duplicate resolution (updates copy count) and auto-category creation.
 */
export async function batchImportBooks(books: ImportBookRow[]) {
  const supabase = await assertStaffCatalogAccess();
  
  let importedCount = 0;
  let copiesAddedCount = 0;
  let duplicateCount = 0;
  const logs: string[] = [];

  // Fetch all existing books to perform highly efficient in-memory duplicate checks
  const { data: existingBooks, error: fetchError } = await supabase
    .from('books')
    .select('id, isbn, title, author');

  if (fetchError) {
    throw new Error(`Failed to perform duplicate check database prep: ${fetchError.message}`);
  }

  // Build high-speed lookup maps
  const isbnMap = new Map<string, string>(); // cleanedIsbn -> bookId
  const titleAuthorMap = new Map<string, string>(); // "title|||author" -> bookId

  (existingBooks || []).forEach(b => {
    if (b.isbn) {
      const cleanIsbn = b.isbn.trim().replace(/[- ]/g, '');
      isbnMap.set(cleanIsbn, b.id);
    }
    if (b.title && b.author) {
      const key = `${b.title.trim().toLowerCase()}|||${b.author.trim().toLowerCase()}`;
      titleAuthorMap.set(key, b.id);
    }
  });

  // Resolve categories in batches to avoid duplicates
  const categoryCache = new Map<string, string>(); // categoryName -> categoryId

  for (let i = 0; i < books.length; i++) {
    const row = books[i];
    const indexStr = `Row ${i + 1}`;

    try {
      const title = row.title?.trim();
      const author = row.author?.trim();

      if (!title || !author) {
        logs.push(`[${indexStr}] Skipped: Missing title or author`);
        continue;
      }

      // Check duplicates
      let existingBookId: string | null = null;
      let duplicateReason = '';

      const isbn = row.isbn ? String(row.isbn).trim() : '';
      const cleanIsbn = isbn.replace(/[- ]/g, '');

      if (cleanIsbn && isbnMap.has(cleanIsbn)) {
        existingBookId = isbnMap.get(cleanIsbn)!;
        duplicateReason = `matching ISBN (${isbn})`;
      } else {
        const key = `${title.toLowerCase()}|||${author.toLowerCase()}`;
        if (titleAuthorMap.has(key)) {
          existingBookId = titleAuthorMap.get(key)!;
          duplicateReason = `matching Title & Author ("${title}" by ${author})`;
        }
      }

      const stock = parseInt(String(row.stock || row.copiesCount || '1'), 10);
      const copiesToCreate = isNaN(stock) || stock < 0 ? 1 : stock;

      if (existingBookId) {
        duplicateCount++;
        // Duplicate found: increment copies of existing book
        if (copiesToCreate > 0) {
          const copies = Array.from({ length: copiesToCreate }).map(() => ({
            book_id: existingBookId,
            status: 'AVAILABLE'
          }));

          const { error: copyError } = await supabase
            .from('book_copies')
            .insert(copies);

          if (copyError) {
            logs.push(`[${indexStr}] Warning: Book duplicate found (${duplicateReason}), but failed to add ${copiesToCreate} copies: ${copyError.message}`);
          } else {
            copiesAddedCount += copiesToCreate;
            logs.push(`[${indexStr}] Duplicate resolved: Combined copies with existing book (${duplicateReason}) and added ${copiesToCreate} copies.`);
          }
        } else {
          logs.push(`[${indexStr}] Skipped duplicate: Found matching book (${duplicateReason}) and copy count was 0.`);
        }
        continue;
      }

      // No duplicate: Resolve or create category
      let categoryId: string | null = null;
      const categoryName = row.category?.trim() || row.category_name?.trim();
      if (categoryName) {
        if (categoryCache.has(categoryName)) {
          categoryId = categoryCache.get(categoryName)!;
        } else {
          categoryId = await getOrCreateCategoryByName(supabase, categoryName);
          if (categoryId) {
            categoryCache.set(categoryName, categoryId);
          }
        }
      }

      // Process tags
      let tagsArray: string[] = [];
      if (row.tags) {
        if (Array.isArray(row.tags)) {
          tagsArray = row.tags.map((t: unknown) => String(t).trim());
        } else if (typeof row.tags === 'string') {
          tagsArray = row.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
        }
      }

      // Insert new Book
      const bookInsert = {
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
        is_active: true
      };

      const { data: newBook, error: insertError } = await supabase
        .from('books')
        .insert([bookInsert])
        .select()
        .single();

      if (insertError) {
        logs.push(`[${indexStr}] Failed to import: ${insertError.message}`);
        continue;
      }

      // Update lookup caches immediately
      if (isbn) isbnMap.set(cleanIsbn, newBook.id);
      titleAuthorMap.set(`${title.toLowerCase()}|||${author.toLowerCase()}`, newBook.id);

      importedCount++;

      // Create copies
      if (copiesToCreate > 0) {
        const copies = Array.from({ length: copiesToCreate }).map(() => ({
          book_id: newBook.id,
          status: 'AVAILABLE'
        }));

        const { error: copyError } = await supabase
          .from('book_copies')
          .insert(copies);

        if (copyError) {
          logs.push(`[${indexStr}] Imported new book "${title}" but failed to add copies: ${copyError.message}`);
        } else {
          copiesAddedCount += copiesToCreate;
          logs.push(`[${indexStr}] Successfully imported: "${title}" by ${author} (${copiesToCreate} copies).`);
        }
      } else {
        logs.push(`[${indexStr}] Successfully imported: "${title}" by ${author} (0 copies).`);
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      logs.push(`[${indexStr}] Failed due to system error: ${errMsg}`);
    }
  }

  revalidateTag('catalog', 'max');
  revalidateTag('books', 'max');

  return {
    success: true,
    imported: importedCount,
    copiesAdded: copiesAddedCount,
    duplicates: duplicateCount,
    logs
  };
}

/**
 * Searches a single ISBN from Google Books and Open Library.
 * If found, downloads and compresses its cover, inserts the book, creates 1 copy, and returns details.
 */
export async function lookupAndImportISBN(isbn: string) {
  const supabase = await assertStaffCatalogAccess();
  const cleanIsbn = isbn.trim().replace(/[- ]/g, '');

  if (!cleanIsbn) {
    return { success: false, isbn, error: 'Invalid ISBN number provided' };
  }

  // 1. Check if ISBN already exists in the database
  const { data: existingBook, error: checkError } = await supabase
    .from('books')
    .select('id, title, author')
    .eq('isbn', cleanIsbn)
    .maybeSingle();

  if (checkError) {
    return { success: false, isbn, error: `Database duplicate lookup failed: ${checkError.message}` };
  }

  if (existingBook) {
    // If the book already exists, just add 1 copy
    const { error: copyError } = await supabase
      .from('book_copies')
      .insert([{ book_id: existingBook.id, status: 'AVAILABLE' }]);

    if (copyError) {
      return { success: false, isbn, error: `Book already exists, but failed to create new copy: ${copyError.message}` };
    }

    revalidateTag('catalog', 'max');
    revalidateTag('books', 'max');

    return { 
      success: true, 
      isbn, 
      status: 'exists', 
      bookId: existingBook.id, 
      title: existingBook.title, 
      author: existingBook.author,
      message: `Book already exists ("${existingBook.title}"). Added 1 new copy to inventory.`
    };
  }

  // 2. Fetch from Google Books API
  let bookDetails: GoogleOrOpenLibraryBookDetails | null = null;
  let externalCoverUrl: string | null = null;
  let categoryName: string | null = null;

  try {
    const googleBooksRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`);
    if (googleBooksRes.ok) {
      const data = await googleBooksRes.json();
      if (data.items && data.items.length > 0) {
        const info = data.items[0].volumeInfo;
        bookDetails = {
          title: info.title,
          author: info.authors ? info.authors.join(', ') : 'Unknown Author',
          publisher: info.publisher || null,
          published_year: info.publishedDate ? parseInt(info.publishedDate.split('-')[0], 10) : null,
          description: info.description || null,
          dewey_decimal: info.industryIdentifiers?.find((id: { type: string; identifier: string }) => id.type === 'OTHER')?.identifier || null,
          tags: info.categories || []
        };
        categoryName = info.categories && info.categories.length > 0 ? info.categories[0] : null;
        if (info.imageLinks) {
          externalCoverUrl = info.imageLinks.thumbnail || info.imageLinks.smallThumbnail || null;
        }
      }
    }
  } catch (err) {
    logger.warn('catalog', `Google Books API check failed for ISBN: ${cleanIsbn}`, { error: err });
  }

  // 3. Fallback to Open Library API
  if (!bookDetails) {
    try {
      const openLibRes = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`);
      if (openLibRes.ok) {
        const data = await openLibRes.json();
        const bookKey = `ISBN:${cleanIsbn}`;
        if (data[bookKey]) {
          const info = data[bookKey];
          bookDetails = {
            title: info.title,
            author: info.authors ? (info.authors as Array<{ name: string }>).map((a) => a.name).join(', ') : 'Unknown Author',
            publisher: info.publishers ? (info.publishers as Array<{ name: string }>).map((p) => p.name).join(', ') : null,
            published_year: info.published_date ? parseInt(info.published_date.split(' ').pop() || '', 10) : null,
            description: info.notes || null,
            dewey_decimal: null,
            tags: info.subjects ? (info.subjects as Array<{ name: string }>).map((s) => s.name) : []
          };
          if (info.subjects && info.subjects.length > 0) {
            categoryName = info.subjects[0].name;
          }
          if (info.cover) {
            externalCoverUrl = info.cover.large || info.cover.medium || info.cover.small || null;
          }
        }
      }
    } catch (err) {
      logger.warn('catalog', `Open Library API check failed for ISBN: ${cleanIsbn}`, { error: err });
    }
  }

  if (!bookDetails) {
    return { success: false, isbn, error: 'Book metadata not found in any public APIs' };
  }

  // 4. Resolve or create category
  let categoryId: string | null = null;
  if (categoryName) {
    try {
      categoryId = await getOrCreateCategoryByName(supabase, categoryName);
    } catch (catErr) {
      logger.error('catalog', `Failed to create category during ISBN import: ${categoryName}`, { error: catErr });
    }
  }

  // 5. Ingest cover image into Supabase Storage
  let finalCoverUrl: string | null = null;
  if (externalCoverUrl) {
    finalCoverUrl = await uploadCoverFromUrl(supabase, externalCoverUrl);
  }

  // 6. Insert book record
  const bookInsert = {
    title: bookDetails.title,
    author: bookDetails.author,
    isbn: cleanIsbn,
    category_id: categoryId,
    description: bookDetails.description,
    published_year: bookDetails.published_year,
    cover_url: finalCoverUrl,
    tags: bookDetails.tags,
    dewey_decimal: bookDetails.dewey_decimal,
    is_active: true
  };

  const { data: newBook, error: insertError } = await supabase
    .from('books')
    .insert([bookInsert])
    .select()
    .single();

  if (insertError) {
    return { success: false, isbn, error: `Failed to insert new book record: ${insertError.message}` };
  }

  // 7. Create 1 copy
  const { error: copyError } = await supabase
    .from('book_copies')
    .insert([{ book_id: newBook.id, status: 'AVAILABLE' }]);

  if (copyError) {
    // Soft roll-back
    await supabase.from('books').delete().eq('id', newBook.id);
    return { success: false, isbn, error: `Book record was created, but copy generation failed: ${copyError.message}. Rolled back.` };
  }

  revalidateTag('catalog', 'max');
  revalidateTag('books', 'max');

  return {
    success: true,
    isbn,
    status: 'imported',
    bookId: newBook.id,
    title: newBook.title,
    author: newBook.author,
    message: `Successfully imported "${newBook.title}" by ${newBook.author} with 1 copy.`
  };
}
