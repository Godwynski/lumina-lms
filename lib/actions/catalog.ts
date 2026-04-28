'use server';
import { createSafeAction } from './action-utils';
import { cache } from 'react';
import { BookSchema } from '../validations/catalog';
import { logger } from '../logger';
import { createClient, createSafeClient } from '@/lib/supabase/server';
import { z } from 'zod';

async function assertStaffCatalogAccess() {
  const { getMe } = await import('@/lib/auth-helpers');
  const me = await getMe();
  const role = me?.role;

  if (!role || !['admin', 'librarian', 'staff'].includes(role)) {
    throw new Error('Unauthorized or Forbidden');
  }

  return await createClient();
}

// --- Categories ---

/**
 * Fetches all inventory categories. Results are cached via Next.js unstable_cache.
 * @returns Array of categories.
 */
export const getCategories = async () => {
  const { unstable_cache } = await import('next/cache');
  return unstable_cache(
    cache(async () => {
      const supabase = createSafeClient();
      const { data, error } = await supabase.from('categories').select('id, name, slug, description, is_active, created_at').order('name');
      if (error) throw new Error(error.message);
      return data;
    }),
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
 * @returns Object with book list and total count.
 */
export async function getBooks(query: string = '', categoryId?: string, page: number = 1, pageSize: number = 10, sort: string = 'title_asc') {
  const supabase = await assertStaffCatalogAccess();
  
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let dbQuery = supabase
    .from('books')
    .select(`*, categories(name)`, { count: 'exact' })
    .eq('is_active', true);
  
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

export const getBookById = async (id: string) => {
  const { unstable_cache } = await import('next/cache');
  return unstable_cache(
    async (id: string) => {
      const supabase = createSafeClient();
      const { data, error } = await supabase
        .from('books')
        .select(`*, categories(name)`)
        .eq('id', id)
        .single();
        
      if (error) throw new Error(error.message);
      return data;
    },
    ['catalog-book-detail'],
    { revalidate: 3600, tags: ['books'] }
  )(id);
};

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
      
    if (error) throw new Error('Failed to create book record. Please check if ISBN is unique.');

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

    logger.info('catalog', `Book created: ${bookData.title}`, { bookId: data.id, isbn: bookData.isbn });
    const { revalidateTag } = await import('next/cache');
    revalidateTag('catalog', 'default');
    revalidateTag('books', 'default');
    
    return data;
  },
  { 
    auditAction: "create", 
    auditEntity: "book", 
    allowedRoles: ['admin', 'librarian', 'staff'] 
  }
);

export const updateBook = createSafeAction(
  z.object({ id: z.string(), bookData: BookSchema.partial() }),
  async ({ id, bookData }, { supabase }) => {
    const { data, error } = await supabase
      .from('books')
      .update(bookData)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw new Error(error.message);
    
    logger.info('catalog', `Book updated: ${id}`, { updates: bookData });
    const { revalidateTag } = await import('next/cache');
    revalidateTag('catalog', 'default');
    revalidateTag(`book-${id}`, 'default');
    
    return data;
  },
  { 
    auditAction: "update", 
    auditEntity: "book", 
    allowedRoles: ['admin', 'librarian', 'staff'] 
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
    const { revalidateTag } = await import('next/cache');
    revalidateTag('catalog', 'default');
    revalidateTag('books', 'default');
    
    return data;
  },
  { 
    auditAction: "archive", 
    auditEntity: "book", 
    allowedRoles: ['admin', 'librarian', 'staff'] 
  }
);


// --- Book Copies ---

export async function getBookCopies(bookId: string) {
  const supabase = await assertStaffCatalogAccess();
  const { data, error } = await supabase
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
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  // Normalize: attach only the active reservation (READY or ACTIVE with copy_id assigned)  
  return (data ?? []).map((copy) => {
    const copyData = copy as Record<string, unknown>;
    const raws = Array.isArray(copyData.reservations) ? copyData.reservations : copyData.reservations ? [copyData.reservations] : [];
    const activeRes = raws.find(
      (r: { status: string }) => r.status === 'READY' || r.status === 'ACTIVE'
    ) ?? null;
    const rest = { ...copyData };
    delete rest.reservations;
    return { ...rest, reservation: activeRes };
  });
}



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
    
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/catalog');
    revalidatePath(`/catalog/${data.book_id}`);
    
    return data;
  },
  { 
    auditAction: "update_status", 
    auditEntity: "book_copy", 
    allowedRoles: ['admin', 'librarian', 'staff'] 
  }
);

/**
 * Fetches the full reservation queue for a book (READY + ACTIVE), enriched with
 * the reserver's profile: name, student ID, email, avatar_url.
 * READY entries appear first (the current hold), then ACTIVE sorted by queue_position.
 */
export async function getBookReservationQueue(bookId: string) {
  const supabase = await assertStaffCatalogAccess();

  const { data, error } = await supabase
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
    .order('status', { ascending: false }) // READY before ACTIVE alphabetically
    .order('queue_position', { ascending: true })
    .order('reserved_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

