'use server';

import { z } from 'zod';
import { createSafeAction } from '@/lib/actions/action-utils';
import { revalidateTag } from 'next/cache';
import { BookSchema } from '@/lib/validations/catalog';
import { logger } from '@/lib/logger';
import { assertStaffCatalogAccess } from './auth';
import { fetchBooksCore } from '@/lib/actions/books-core';
import { getBookOrdering } from '@/lib/catalog-sort';
import { copyAcquisitionSchema, hasCopyAcquisition } from '@/lib/copy-acquisition';
import { createAdminClient } from '@/lib/supabase/admin';

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
  const supabase = await assertStaffCatalogAccess(true);
  const { books, total } = await fetchBooksCore(
    { query, categoryId, page, pageSize, status, ...getBookOrdering(sort, Boolean(query.trim())) },
    '*, categories!left(name)',
    supabase
  );
  return { data: books, count: total };
}

const CreateBookSchema = z.object({
  bookData: BookSchema,
  copiesCount: z.number().int().min(0).max(100).default(1),
  acquisition: copyAcquisitionSchema.optional(),
});

export const createBook = createSafeAction(
  CreateBookSchema,
  async ({ bookData, copiesCount, acquisition }, { supabase }) => {
    const withAcquisition = copiesCount > 0 && hasCopyAcquisition(acquisition);
    const { data, error } = withAcquisition
      ? await createAdminClient().rpc('create_book_with_acquisition', {
        p_book: bookData, p_count: copiesCount, p_acquisition: acquisition,
      })
      : await supabase.from('books').insert([bookData]).select().single();
      
    if (error) {
      logger.error('catalog', 'Failed to insert book record', { error });
      throw new Error(`Failed to create book record: ${error.message}`);
    }

    const bookId = data.id as string;
    let copyIds: string[] = withAcquisition ? data.copyIds : [];
    if (copiesCount > 0 && !withAcquisition) {
      const copies = Array.from({ length: copiesCount }).map(() => ({
        book_id: bookId,
        status: 'AVAILABLE'
      }));

      const { data: created, error: copiesError } = await supabase
        .from('book_copies')
        .insert(copies)
        .select('id');

      if (copiesError) {
        logger.error('catalog', `Book created but copies failed for ID: ${bookId}`, { error: copiesError.message });
        await supabase.from('books').delete().eq('id', bookId);
        throw new Error('Failed to initialize book copies. Transaction rolled back.');
      }
      copyIds = created?.map(copy => copy.id) ?? [];
    }

    // Fetch the updated book record with correct counts (synced by triggers)
    const { data: updatedData, error: refreshError } = await supabase
      .from('books')
      .select('*, categories(name)')
      .eq('id', bookId)
      .single();

    if (refreshError) {
      logger.error('catalog', 'Failed to refresh book record after copy sync', { error: refreshError });
    }

    const finalData = updatedData || (withAcquisition ? { ...bookData, id: bookId, total_copies: copiesCount, available_copies: copiesCount } : data);

    logger.info('catalog', `Book created: ${bookData.title}`, { bookId: finalData.id, isbn: bookData.isbn });
    revalidateTag('catalog', 'max');
    revalidateTag('books', 'max');
    revalidateTag('public-books', 'max');
    
    return [finalData, {
      reason: `Created new book: ${bookData.title}`,
      newValue: { ...bookData, copies_created: copiesCount },
      details: { isbn: bookData.isbn, ...(copyIds.length > 0 ? { copyIds } : {}), ...(withAcquisition ? { acquisition } : {}) }
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
    revalidateTag('public-books', 'max');
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
    revalidateTag('public-books', 'max');
    
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
    revalidateTag('public-books', 'max');
    
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
