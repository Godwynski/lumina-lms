'use server';
import type { Book, BookCopyWithReservation } from '@/lib/types';
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
  if (me.role !== 'admin' && me.role !== 'librarian' && me.role !== 'student_assistant') {
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
    allowedRoles: ['admin', 'librarian']
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
    allowedRoles: ['admin', 'librarian']
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
    allowedRoles: ['admin', 'librarian']
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
    allowedRoles: ['admin', 'librarian']
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
    allowedRoles: ['admin', 'librarian']
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
    allowedRoles: ['admin', 'librarian']
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

  const normalizedCopies = (copiesResponse.data ?? []).map((copy) => {
    const copyData = copy as Record<string, unknown>;
    const raws = Array.isArray(copyData.reservations) ? copyData.reservations : copyData.reservations ? [copyData.reservations] : [];
    const activeRes = raws.find(
      (r: { status: string }) => r.status === 'READY' || r.status === 'ACTIVE'
    ) ?? null;
    const rest = { ...copyData };
    delete rest.reservations;
    return { ...rest, reservation: activeRes } as unknown as BookCopyWithReservation;
  });

  return {
    book: bookResponse.data as unknown as Book,
    copies: normalizedCopies,
    queue: (queueResponse.data ?? []) as unknown as AdminReservationQueueEntry[]
  };
}
