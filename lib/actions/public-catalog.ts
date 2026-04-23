'use server'

import { createClient, createSafeClient } from '@/lib/supabase/server';
import { unstable_cache } from 'next/cache';
import { logger } from '../logger';
import { fetchBooksCore, fetchCategoriesCore } from './books-core';

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
  return fetchBooksCore({
    query,
    categoryId,
    section,
    availableOnly,
    page,
    pageSize: limit,
    sortBy,
    sortOrder: sortBy === 'availability' ? 'desc' : 'asc'
  }, 'id, title, author, isbn, category_id, tags, section, cover_url, total_copies, available_copies, categories(name)');
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
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

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
  return fetchCategoriesCore();
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
