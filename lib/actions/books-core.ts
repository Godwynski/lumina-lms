import { createSafeClient } from '@/lib/supabase/server';
import { Book } from '@/lib/types';
import { sanitizeFilterInput } from '@/lib/utils';

interface BookSearchParams {
  query?: string;
  categoryId?: string;
  section?: string;
  availableOnly?: boolean;
  page?: number;
  pageSize?: number;
  /** 'relevance' ranks title matches first (needs a search query). */
  sortBy?: 'relevance' | 'title' | 'author' | 'availability' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
}

/**
 * Common book search query builder logic used by both staff and students.
 */
export async function fetchBooksCore(
  params: BookSearchParams,
  columns: string = '*',
  supabase: ReturnType<typeof createSafeClient> = createSafeClient()
) {
  const {
    query = '',
    categoryId,
    section,
    availableOnly = false,
    page = 1,
    pageSize = 20,
    sortBy = 'title',
    sortOrder = 'asc',
    status = 'ACTIVE'
  } = params;

  if (sortBy === 'relevance' && query.trim()) {
    const ranked = await fetchBooksRanked(params, columns, supabase);
    if (ranked) return ranked;
    // Ranking function unavailable: fall back to the regular search below.
  }

  let dbQuery = supabase
    .from('books')
    .select(columns, { count: 'exact' });

  if (status !== 'ALL') dbQuery = dbQuery.eq('is_active', status === 'ACTIVE');
  
  if (query) {
    const cleanQuery = query.trim();
    if (cleanQuery) {
      if (cleanQuery.length < 3) {
        // 1-2 characters: match titles only, so results aren't flooded by
        // authors/ISBNs that happen to contain those letters.
        const safeQuery = sanitizeFilterInput(cleanQuery);
        dbQuery = dbQuery.ilike('title', `%${safeQuery}%`);
      } else {
        // For longer queries, use Full Text Search with prefix support
        // We transform "lord of" into "lord:* & of:*"
        const terms = cleanQuery.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
        const formattedQuery = terms.map(t => `${t}:*`).join(' & ');
        
        // Use 'to_tsquery' style search via default type
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
    dbQuery = dbQuery.order('available_copies', { ascending: sortOrder === 'asc' });
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
 * "Best match" search. The `search_book_ids` SQL function ranks matches
 * (exact ISBN, exact title, title prefix, title words, author, other) and
 * pages them; we then load those books with the caller's usual columns and
 * keep the ranked order. Returns null if the function fails (e.g. not deployed).
 */
async function fetchBooksRanked(
  params: BookSearchParams,
  columns: string,
  supabase: ReturnType<typeof createSafeClient>
) {
  const {
    query = '',
    categoryId,
    section,
    availableOnly = false,
    page = 1,
    pageSize = 20,
    status = 'ACTIVE',
  } = params;

  const categoryIds = categoryId && categoryId !== 'all' ? categoryId.split(',').filter(Boolean) : null;
  const from = (page - 1) * pageSize;

  const { data: ranked, error: rankError } = await supabase.rpc('search_book_ids', {
    p_query: query.trim(),
    p_status: status,
    p_category_ids: categoryIds && categoryIds.length > 0 ? categoryIds : null,
    p_section: section || null,
    p_available_only: availableOnly,
    p_offset: from,
    p_limit: pageSize,
  });

  if (rankError) {
    console.warn('[books] search_book_ids failed, using plain search:', rankError.message);
    return null;
  }

  const rows = (ranked ?? []) as { id: string; total_count: number | string }[];
  // total_count is the same on every row; an empty page past the end has no rows.
  let total = rows.length > 0 ? Number(rows[0].total_count) : 0;
  if (rows.length === 0 && page > 1) {
    const { data: first } = await supabase.rpc('search_book_ids', {
      p_query: query.trim(),
      p_status: status,
      p_category_ids: categoryIds && categoryIds.length > 0 ? categoryIds : null,
      p_section: section || null,
      p_available_only: availableOnly,
      p_offset: 0,
      p_limit: 1,
    });
    const firstRows = (first ?? []) as { total_count: number | string }[];
    total = firstRows.length > 0 ? Number(firstRows[0].total_count) : 0;
  }

  if (rows.length === 0) {
    return { books: [] as Book[], total, hasMore: false };
  }

  const ids = rows.map((r) => r.id);
  const { data, error } = await supabase.from('books').select(columns).in('id', ids);
  if (error) throw new Error(error.message);

  const byId = new Map(((data ?? []) as unknown as Book[]).map((b) => [b.id, b]));
  const books = ids.map((id) => byId.get(id)).filter((b): b is Book => Boolean(b));

  return {
    books,
    total,
    hasMore: from + rows.length < total,
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
