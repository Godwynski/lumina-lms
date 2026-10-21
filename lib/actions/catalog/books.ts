'use server';

import { z } from 'zod';
import { createSafeAction } from '@/lib/actions/action-utils';
import { revalidateTag } from 'next/cache';
import { BookSchema } from '@/lib/validations/catalog';
import { logger } from '@/lib/logger';
import { assertStaffCatalogAccess } from './auth';
import { sanitizeFilterInput } from '@/lib/utils';

/**
 * Retrieves a paginated list of books with optional filtering and search.
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
        const safeQuery = sanitizeFilterInput(cleanQuery);
        dbQuery = dbQuery.or(`title.ilike.%${safeQuery}%,author.ilike.%${safeQuery}%,isbn.ilike.%${safeQuery}%`);
      } else {
        const terms = cleanQuery.replace(/[^\w\s-]/g, ' ').split(/\s+/).filter(Boolean);
        const formattedQuery = terms.map(t => `${t}:*`).join(' & ');
        if (terms.length > 0) {
          dbQuery = dbQuery.textSearch('search_vector', formattedQuery);
        } else {
          const safeQuery = sanitizeFilterInput(cleanQuery);
          dbQuery = dbQuery.or(`title.ilike.%${safeQuery}%,author.ilike.%${safeQuery}%,isbn.ilike.%${safeQuery}%`);
        }
      }
    }
  }
  
  if (categoryId && categoryId !== 'all') {
    const categoryIds = categoryId.split(',').filter(Boolean);
    if (categoryIds.length > 0) {
      dbQuery = dbQuery.in('category_id', categoryIds);
    }
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

    // Check for active or ready reservations
    const { count: resCount, error: resError } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .eq('book_id', id)
      .in('status', ['ACTIVE', 'READY']);

    if (resError) throw new Error(resError.message);

    if (resCount && resCount > 0) {
      throw new Error('Cannot delete book: There are active or ready reservations waiting.');
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
