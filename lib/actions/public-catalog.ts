'use server'

import { createClient, createSafeClient } from '@/lib/supabase/server';
import { unstable_cache } from 'next/cache';
import { logger } from '../logger';

// Data fetching function for search, intended to be wrapped by cache
async function fetchPublicBooks(
  query: string,
  categoryId?: string,
  section?: string,
  availableOnly: boolean = false,
  page: number = 1,
  limit: number = 20,
  sortBy: 'title' | 'author' | 'availability' = 'title'
) {
  const supabase = createSafeClient();
  
  // Data Masking: Explicitly select safe fields for students/public
  let dbQuery = supabase
    .from('books')
    .select('id, title, author, isbn, category_id, tags, section, cover_url, total_copies, available_copies, categories(name)', { count: 'exact' })
    .eq('is_active', true);
  
  if (query) {
    dbQuery = dbQuery.textSearch('search_vector', query.split(' ').join(' | '));
  }
  
  if (categoryId) {
    dbQuery = dbQuery.eq('category_id', categoryId);
  }

  if (section) {
    dbQuery = dbQuery.eq('section', section);
  }

  if (availableOnly) {
    dbQuery = dbQuery.gt('available_copies', 0);
  }
  
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let finalQuery = dbQuery;
  
  if (sortBy === 'author') {
    finalQuery = finalQuery.order('author', { ascending: true });
  } else if (sortBy === 'availability') {
    finalQuery = finalQuery.order('available_copies', { ascending: false });
  } else {
    finalQuery = finalQuery.order('title', { ascending: true });
  }

  const { data, count, error } = await finalQuery
    .range(from, to);
    
  if (error) throw new Error(error.message);
  
  return { 
    books: data || [], 
    total: count || 0,
    hasMore: count ? from + (data?.length || 0) < count : false
  };
}

// Cached version: each unique set of filters gets its own cache entry
export async function getPublicBooksCached(
  query: string,
  categoryId?: string,
  section?: string,
  availableOnly: boolean = false,
  page: number = 1,
  limit: number = 20,
  sortBy: 'title' | 'author' | 'availability' = 'title'
) {
  return unstable_cache(
    () => fetchPublicBooks(query, categoryId, section, availableOnly, page, limit, sortBy),
    // Dynamic cache key — each unique combination of params is cached separately
    ['public-books', query, categoryId ?? '', section ?? '', String(availableOnly), String(page), String(limit), sortBy],
    { revalidate: 60, tags: ['public-books'] }
  )();
}


export async function reportMissingBook(bookId: string, notes?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { error } = await supabase
    .from('reports')
    .insert({
      book_id: bookId,
      user_id: user.id,
      notes,
    });

  if (error) {
    logger.error('catalog', `Failed to insert report for book ${bookId}`, { error });
    return { success: false, error: 'Failed to submit report' };
  }

  logger.info('catalog', `Student reported missing book ID: ${bookId}`, { notes });
  return { success: true };
}

export async function getCategories() {
  const supabase = createSafeClient();
  const { data, error } = await supabase
    .from('categories')
    .select('id, name')
    .order('name');
    
  if (error) throw new Error(error.message);
  return data;
}

export async function getPublicBookById(id: string) {
  const supabase = createSafeClient();
  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, isbn, category_id, tags, section, location, cover_url, total_copies, available_copies, categories(name)')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export const getCategoriesCached = unstable_cache(
  getCategories,
  ['public-categories'],
  { revalidate: 3600, tags: ['public-books'] }
);
