'use server'

import { createClient, createSafeClient } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth-helpers';
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache';
import { cache } from 'react';
import { BookSchema, CategorySchema } from '../validations/catalog';
import { logger } from '../logger';

async function assertStaffCatalogAccess() {
  const role = await getUserRole();

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
export const getCategories = unstable_cache(
  cache(async () => {
    const supabase = createSafeClient();
    const { data, error } = await supabase.from('categories').select('id, name, description, created_at').order('name');
    if (error) throw new Error(error.message);
    return data;
  }),
  ['catalog-categories'],
  { revalidate: 3600, tags: ['categories'] }
);

export async function createCategory(name: string, description?: string) {
  const supabase = await assertStaffCatalogAccess();

  const validated = CategorySchema.parse({ name, description });

  const { data, error } = await supabase
    .from('categories')
    .insert([{ name: validated.name, description: validated.description }])
    .select()
    .single();
    
  if (error) throw new Error(error.message);
  return data;
}

// --- Books ---

/**
 * Retrieves a paginated list of books with optional filtering.
 * @param query - Search term for title, author, or ISBN.
 * @param categoryId - Filter by a specific category ID.
 * @param page - Current page for pagination.
 * @param pageSize - Number of items per page.
 * @returns Object with book list and total count.
 */
export async function getBooks(query: string = '', categoryId?: string, page: number = 1, pageSize: number = 10) {
  const supabase = await assertStaffCatalogAccess();
  
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let dbQuery = supabase
    .from('books')
    .select(`*, categories(name)`, { count: 'exact' })
    .eq('is_active', true);
  
  if (query) {
    dbQuery = dbQuery.textSearch('search_vector', query.split(' ').join(' | '));
  }
  
  if (categoryId) {
    dbQuery = dbQuery.eq('category_id', categoryId);
  }
  
  const { data, error, count } = await dbQuery
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  return { data, count: count || 0 };
}

export const getBookById = unstable_cache(
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
);

export async function createBook(bookData: unknown, copiesCount: number = 1) {
  const supabase = await assertStaffCatalogAccess();

  const validated = BookSchema.parse(bookData);

  // Use a transaction-like approach via RPC or grouped inserts
  // For Supabase/Postgres, an RPC is the most robust way to ensure atomicity
  // but if RPC isn't set up, we at least need to handle the cleanup or use a single call.
  // Here we use the standard approach but with improved error handling.
  
  const { data, error } = await supabase
    .from('books')
    .insert([validated])
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
      // Critical Gap Fix: If copies fail, we should ideally rollback. 
      // Since JS doesn't have cross-call transactions easily, we manually cleanup or warn.
      await supabase.from('books').delete().eq('id', data.id);
      throw new Error('Failed to initialize book copies. Transaction rolled back.');
    }
  }

  logger.info('catalog', `Book created: ${validated.title}`, { bookId: data.id, isbn: validated.isbn });
  revalidateTag('catalog', 'default');
  return data;
}

export async function updateBook(id: string, bookData: unknown) {
  const supabase = await assertStaffCatalogAccess();

  const validated = BookSchema.partial().parse(bookData);

  const { data, error } = await supabase
    .from('books')
    .update(validated)
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw new Error(error.message);
  logger.info('catalog', `Book updated: ${id}`, { updates: validated });
  revalidateTag('catalog', 'default');
  revalidateTag(`book-${id}`, 'default');
  return data;
}

export async function softDeleteBook(id: string) {
  const supabase = await assertStaffCatalogAccess();
  
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
  revalidateTag('catalog', 'default');
  return data;
}


// --- Book Copies ---

export async function getBookCopies(bookId: string) {
  const supabase = await assertStaffCatalogAccess();
  const { data, error } = await supabase
    .from('book_copies')
    .select('id, book_id, status, condition, qr_string, created_at')
    .eq('book_id', bookId)
    .order('created_at', { ascending: false });
    
  if (error) throw new Error(error.message);
  return data;
}

export async function createBookCopy(bookId: string, condition?: string) {
  const supabase = await assertStaffCatalogAccess();
  const { data, error } = await supabase
    .from('book_copies')
    .insert([{ book_id: bookId, condition }])
    .select()
    .single();
    
  if (error) throw new Error(error.message);
  revalidatePath('/catalog');
  revalidatePath(`/catalog/${bookId}`);
  return data;
}

export async function updateBookCopyStatus(id: string, status: 'AVAILABLE' | 'BORROWED' | 'MAINTENANCE' | 'LOST') {
  const supabase = await assertStaffCatalogAccess();
  const { data, error } = await supabase
    .from('book_copies')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
    
  if (error) throw new Error(error.message);
  revalidatePath('/catalog');
  revalidatePath(`/catalog/${data.book_id}`);
  return data;
}
