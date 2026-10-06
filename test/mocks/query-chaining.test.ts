import { describe, it, expect } from 'vitest';
import {
  createMockQueryBuilder,
  createMockSupabaseClient,
} from './supabase';

describe('Empirical Verification: Query Builder Chaining (.or and .textSearch)', () => {
  it('1. Chaining order: .or() followed by .textSearch() returns builder identity', () => {
    const builder = createMockQueryBuilder({ id: 1 });
    // @ts-expect-error verifying builder.or chaining
    const chained = builder.or('title.ilike.%term%,author.ilike.%term%').textSearch('search_vector', 'term:*');
    expect(chained).toBe(builder);
    expect(builder.or).toHaveBeenCalledWith('title.ilike.%term%,author.ilike.%term%');
    expect(builder.textSearch).toHaveBeenCalledWith('search_vector', 'term:*');
  });

  it('2. Reverse chaining: .textSearch() followed by .or() returns builder identity', () => {
    const builder = createMockQueryBuilder({ id: 1 });
    const chained = (builder.textSearch('search_vector', 'term:*') as typeof builder).or?.(
      'title.ilike.%term%,author.ilike.%term%'
    );
    expect(chained).toBe(builder);
    expect(builder.textSearch).toHaveBeenCalledWith('search_vector', 'term:*');
    expect(builder.or).toHaveBeenCalledWith('title.ilike.%term%,author.ilike.%term%');
  });

  it('3. Repeated .or() and .textSearch() calls preserve chaining and record all invocations', () => {
    const builder = createMockQueryBuilder();
    // @ts-expect-error testing repeated or and textSearch
    builder
      .or('status.eq.AVAILABLE,status.eq.RESERVED')
      .or('category.eq.fiction,category.eq.history')
      .textSearch('fts', 'query1:*')
      .textSearch('fts', 'query2:*');

    expect(builder.or).toHaveBeenCalledTimes(2);
    expect(builder.textSearch).toHaveBeenCalledTimes(2);
    expect(builder.or).toHaveBeenNthCalledWith(1, 'status.eq.AVAILABLE,status.eq.RESERVED');
    expect(builder.or).toHaveBeenNthCalledWith(2, 'category.eq.fiction,category.eq.history');
    expect(builder.textSearch).toHaveBeenNthCalledWith(1, 'fts', 'query1:*');
    expect(builder.textSearch).toHaveBeenNthCalledWith(2, 'fts', 'query2:*');
  });

  it('4. Deep composition interleaving with standard filter and modifier methods', () => {
    const builder = createMockQueryBuilder([{ id: 101, title: 'Deep Chaining' }], null, 1);
    const chained = builder
      .select('id, title, author')
      .eq('is_active', true)
      .neq('is_archived', true)
      .or('title.ilike.%deep%,author.ilike.%deep%')
      .textSearch('search_vector', 'deep:*')
      .in('category_id', ['c1', 'c2'])
      .order('title', { ascending: true })
      .range(0, 9)
      .limit(10);

    expect(chained).toBe(builder);
    expect(builder.select).toHaveBeenCalledWith('id, title, author');
    expect(builder.eq).toHaveBeenCalledWith('is_active', true);
    expect(builder.neq).toHaveBeenCalledWith('is_archived', true);
    expect(builder.or).toHaveBeenCalledWith('title.ilike.%deep%,author.ilike.%deep%');
    expect(builder.textSearch).toHaveBeenCalledWith('search_vector', 'deep:*');
    expect(builder.in).toHaveBeenCalledWith('category_id', ['c1', 'c2']);
    expect(builder.order).toHaveBeenCalledWith('title', { ascending: true });
    expect(builder.range).toHaveBeenCalledWith(0, 9);
    expect(builder.limit).toHaveBeenCalledWith(10);
  });

  it('5. Supports optional configuration objects (e.g., referencedTable for .or, config for .textSearch)', () => {
    const builder = createMockQueryBuilder();
    // @ts-expect-error testing options parameters
    builder
      .or('title.ilike.%test%,author.ilike.%test%', { referencedTable: 'book_copies.books' })
      .textSearch('search_vector', 'test:*', { config: 'english', type: 'websearch' });

    expect(builder.or).toHaveBeenCalledWith('title.ilike.%test%,author.ilike.%test%', {
      referencedTable: 'book_copies.books',
    });
    expect(builder.textSearch).toHaveBeenCalledWith('search_vector', 'test:*', {
      config: 'english',
      type: 'websearch',
    });
  });

  it('6. Direct await resolution returns configured data, error, and count after chaining', async () => {
    const mockData = [{ id: 'b-99', title: 'Awaited Book' }];
    const builder = createMockQueryBuilder(mockData, null, 1);

    const res = await builder
      .select('*')
      .or('title.ilike.%test%')
      .textSearch('search_vector', 'test:*');

    expect(res).toEqual({
      data: mockData,
      error: null,
      count: 1,
    });
  });

  it('7. Terminal operations .single() and .maybeSingle() resolve correctly after .or and .textSearch', async () => {
    const singleData = { id: 'single-1', title: 'Single Book' };
    const builder = createMockQueryBuilder(singleData);

    // @ts-expect-error testing terminal single
    const singleRes = await builder.or('id.eq.single-1').textSearch('search_vector', 'single:*').single();
    expect(singleRes).toEqual({ data: singleData, error: null });

    // @ts-expect-error testing terminal maybeSingle
    const maybeRes = await builder.or('id.eq.single-1').textSearch('search_vector', 'single:*').maybeSingle();
    expect(maybeRes).toEqual({ data: singleData, error: null });
  });

  it('8. Emulates lib/actions/catalog.ts query workflow via createMockSupabaseClient', async () => {
    const clientHelper = createMockSupabaseClient();
    const books = [
      { id: 'b1', title: 'Refactoring', author: 'Martin Fowler' },
      { id: 'b2', title: 'Design Patterns', author: 'GoF' },
    ];
    clientHelper.setTableResponse('books', books, null, 2);

    // Emulate catalog.ts lines 118-144
    let query = clientHelper.client
      .from('books')
      .select('id, title, author', { count: 'exact' })
      .eq('is_active', true);

    const queryTerm = 'refact';
    if (queryTerm.length < 3) {
      query = query.or(`title.ilike.%${queryTerm}%,author.ilike.%${queryTerm}%`);
    } else {
      query = query.textSearch('search_vector', `${queryTerm}:*`);
    }
    query = query.in('category_id', ['cat-1']);
    query = query.order('title', { ascending: true });
    query = query.range(0, 9);

    const res = await query;
    expect(res.data).toEqual(books);
    expect(res.count).toBe(2);
    expect(res.error).toBeNull();
  });

  it('9. Emulates lib/actions/history.ts referencedTable query workflow via createMockSupabaseClient', async () => {
    const clientHelper = createMockSupabaseClient();
    const records = [{ id: 'br-1', book_copy_id: 'bc-1', status: 'BORROWED' }];
    clientHelper.setTableResponse('borrowing_records', records, null, 1);

    // Emulate history.ts line 71
    let query = clientHelper.client.from('borrowing_records').select('*');
    query = query.or('title.ilike.%test%,author.ilike.%test%', { referencedTable: 'book_copies.books' });
    query = query.order('borrowed_at', { ascending: false });

    const res = await query;
    expect(res.data).toEqual(records);
    expect(res.error).toBeNull();
  });

  it('10. Propagates errors cleanly when table configured with error state', async () => {
    const clientHelper = createMockSupabaseClient();
    const mockError = { message: 'PostgREST syntax error near or()', code: 'PGRST100' };
    clientHelper.setTableResponse('books', null, mockError);

    let query = clientHelper.client.from('books').select('*');
    query = query.or('malformed.filter');
    query = query.textSearch('search_vector', 'bad query');

    const res = await query;
    expect(res.data).toBeNull();
    expect(res.error).toEqual(mockError);
  });
});
