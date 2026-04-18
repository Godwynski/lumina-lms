import { createSafeClient } from '@/lib/supabase/server';
import { Book } from '@/lib/types';

export interface BookSearchParams {
  query?: string;
  categoryId?: string;
  section?: string;
  availableOnly?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: 'title' | 'author' | 'availability' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Common book search query builder logic used by both staff and students.
 */
export async function fetchBooksCore(params: BookSearchParams, columns: string = '*') {
  const {
    query = '',
    categoryId,
    section,
    availableOnly = false,
    page = 1,
    pageSize = 20,
    sortBy = 'title',
    sortOrder = 'asc'
  } = params;
  
  const supabase = createSafeClient();
  
  let dbQuery = supabase
    .from('books')
    .select(columns, { count: 'exact' })
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
  
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  if (sortBy === 'author') {
    dbQuery = dbQuery.order('author', { ascending: sortOrder === 'asc' });
  } else if (sortBy === 'availability') {
    dbQuery = dbQuery.order('available_copies', { ascending: sortOrder === 'desc' });
  } else if (sortBy === 'created_at') {
    dbQuery = dbQuery.order('created_at', { ascending: sortOrder === 'asc' });
  } else {
    dbQuery = dbQuery.order('title', { ascending: sortOrder === 'asc' });
  }

  const { data, count, error } = await dbQuery.range(from, to);
    
  if (error) throw new Error(error.message);
  
  return { 
    books: (data || []) as unknown as Book[], 
    total: count || 0,
    hasMore: count ? from + (data?.length || 0) < count : false
  };
}

/**
 * Common category fetcher.
 */
export async function fetchCategoriesCore() {
  const supabase = createSafeClient();
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, description, created_at')
    .order('name');
    
  if (error) throw new Error(error.message);
  return data || [];
}
