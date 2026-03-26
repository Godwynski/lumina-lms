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
  limit: number = 20
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

  const { data, count, error } = await dbQuery
    .order('title', { ascending: true })
    .range(from, to);
    
  if (error) throw new Error(error.message);
  
  return { 
    books: data || [], 
    total: count || 0,
    hasMore: count ? from + (data?.length || 0) < count : false
  };
}

// Cached version of the public book search
export const getPublicBooksCached = unstable_cache(
  fetchPublicBooks,
  ['public-books-search'],
  { revalidate: 60, tags: ['public-books'] }
);

export async function reportMissingBook(bookId: string, notes?: string) {
  // In a real app, this would insert into a 'reports' or 'tasks' table for staff
  const supabase = await createClient();
  // Here we assume a simple tasks table exists, or we just log it if we don't have the table defined
  // Since we didn't add a 'tasks' table in the migration, we'll just return success for now.
  logger.warn('catalog', `Student reported missing book ID: ${bookId}`, { notes });
  void supabase; // supabase is required for auth context in real usage
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
