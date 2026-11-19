'use server'

import { createSafeClient } from '@/lib/supabase/server';
import { unstable_cache } from 'next/cache';
import { fetchBooksCore, fetchCategoriesCore } from './books-core';
import { getBookOrdering, normalizeBookSort, type BookSort, type BookSortParam } from '@/lib/catalog-sort';

// Data fetching function for search, intended to be wrapped by cache
async function fetchPublicBooks(
  query: string,
  categoryId?: string,
  section?: string,
  availableOnly: boolean = false,
  page: number = 1,
  limit: number = 20,
  sort: BookSort = 'title_asc'
) {
  return fetchBooksCore({
    query,
    categoryId,
    section,
    availableOnly,
    page,
    pageSize: limit,
    ...getBookOrdering(sort, Boolean(query.trim())),
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
  sortBy: BookSortParam = 'title'
) {
  const sort = normalizeBookSort(sortBy);
  return unstable_cache(
    () => fetchPublicBooks(query, categoryId, section, availableOnly, page, limit, sort),
    // Dynamic cache key — each unique combination of params is cached separately
    ['public-books', query, categoryId ?? '', section ?? '', String(availableOnly), String(page), String(limit), sort],
    { revalidate: 60, tags: ['public-books'] }
  )();
}



async function getCategories() {
  return fetchCategoriesCore();
}

export async function getPublicBookById(id: string) {
  const supabase = createSafeClient();
  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, isbn, description, dewey_decimal, category_id, tags, section, location, cover_url, total_copies, available_copies, categories(name)')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export const getCategoriesCached = unstable_cache(
  getCategories,
  ['public-categories'],
  { revalidate: 3600, tags: ['public-books', 'categories'] }
);

