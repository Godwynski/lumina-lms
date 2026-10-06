import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createMockQueryBuilder,
  createMockSupabaseClient,
} from './supabase';
import {
  createMockCookieStore,
  setMockCookies,
  resetNextCacheMocks,
  cookies,
  revalidatePath,
  revalidateTag,
  unstable_cache,
  after,
} from './next-cache';

describe('Milestone 1 Empirical Stress Tests: Hermetic Mocks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetNextCacheMocks();
  });

  describe('1. Supabase Query Builder Chaining & Compositions', () => {
    it('supports arbitrary deep chaining of filters, modifiers, and actions returning this', () => {
      const builder = createMockQueryBuilder({ id: 1 });

      const chained = builder
        .select('id, title, status')
        .eq('status', 'ACTIVE')
        .neq('archived', true)
        .in('category_id', ['cat1', 'cat2'])
        .is('deleted_at', null)
        .gt('page_count', 50)
        .gte('rating', 4.5)
        .lt('price', 100)
        .lte('discount', 20)
        .like('title', '%Lumina%')
        .ilike('author', '%doe%')
        .not('is_restricted', 'is', true)
        .order('created_at', { ascending: false })
        .limit(25)
        .range(0, 24)
        .insert({ title: 'New Book' })
        .update({ status: 'BORROWED' })
        .upsert({ id: 1, title: 'Upsert Book' })
        .delete();

      expect(chained).toBe(builder);
      expect(builder.select).toHaveBeenCalledWith('id, title, status');
      expect(builder.eq).toHaveBeenCalledWith('status', 'ACTIVE');
      expect(builder.neq).toHaveBeenCalledWith('archived', true);
      expect(builder.in).toHaveBeenCalledWith('category_id', ['cat1', 'cat2']);
      expect(builder.is).toHaveBeenCalledWith('deleted_at', null);
      expect(builder.gt).toHaveBeenCalledWith('page_count', 50);
      expect(builder.gte).toHaveBeenCalledWith('rating', 4.5);
      expect(builder.lt).toHaveBeenCalledWith('price', 100);
      expect(builder.lte).toHaveBeenCalledWith('discount', 20);
      expect(builder.like).toHaveBeenCalledWith('title', '%Lumina%');
      expect(builder.ilike).toHaveBeenCalledWith('author', '%doe%');
      expect(builder.not).toHaveBeenCalledWith('is_restricted', 'is', true);
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(builder.limit).toHaveBeenCalledWith(25);
      expect(builder.range).toHaveBeenCalledWith(0, 24);
      expect(builder.insert).toHaveBeenCalledWith({ title: 'New Book' });
      expect(builder.update).toHaveBeenCalledWith({ status: 'BORROWED' });
      expect(builder.upsert).toHaveBeenCalledWith({ id: 1, title: 'Upsert Book' });
      expect(builder.delete).toHaveBeenCalled();
    });

    it('supports .or() and .textSearch() query compositions required by catalog.ts and books-core.ts', () => {
      const builder = createMockQueryBuilder();
      // @ts-expect-error Checking runtime presence of .or and .textSearch
      const chained = builder.or('title.ilike.%test%,author.ilike.%test%').textSearch('search_vector', 'test:*');
      expect(chained).toBe(builder);
    });

    it('resolves directly via await with thenable protocol returning data, error, count', async () => {
      const payload = [{ id: 1, title: 'Clean Architecture' }];
      const builder = createMockQueryBuilder(payload, null, 1);

      const result = await builder.select('*');

      expect(result).toEqual({
        data: payload,
        error: null,
        count: 1,
      });
    });

    it('can be awaited multiple times with stable resolution', async () => {
      const payload = { role: 'librarian' };
      const builder = createMockQueryBuilder(payload);

      const res1 = await builder;
      const res2 = await builder;

      expect(res1.data).toEqual(payload);
      expect(res2.data).toEqual(payload);
    });

    it('supports chained .then() transformations and error callbacks', async () => {
      const builder = createMockQueryBuilder({ count: 42 });

      const mapped = await builder.then((res) => (res.data as { count: number }).count * 2);
      expect(mapped).toBe(84);
    });

    it('supports single() and maybeSingle() terminal operations', async () => {
      const singleData = { id: 10, name: 'Main Library' };
      const builder = createMockQueryBuilder(singleData);

      const singleRes = await builder.single();
      expect(singleRes).toEqual({ data: singleData, error: null });

      const maybeRes = await builder.maybeSingle();
      expect(maybeRes).toEqual({ data: singleData, error: null });
    });

    it('dynamically updates single() and maybeSingle() when setResolveValue is called', async () => {
      const builder = createMockQueryBuilder(null);

      const initialRes = await builder.single();
      expect(initialRes.data).toBeNull();

      builder.setResolveValue({ updated: true }, { message: 'fake error' }, 5);

      const updatedSingle = await builder.single();
      expect(updatedSingle).toEqual({
        data: { updated: true },
        error: { message: 'fake error' },
      });

      const updatedMaybe = await builder.maybeSingle();
      expect(updatedMaybe).toEqual({
        data: { updated: true },
        error: { message: 'fake error' },
      });

      const updatedThenable = await builder;
      expect(updatedThenable).toEqual({
        data: { updated: true },
        error: { message: 'fake error' },
        count: 5,
      });
    });
  });

  describe('2. Multi-table Independence & Client Helper', () => {
    it('maintains independent builders per table and preserves configurations', async () => {
      const mockSupabase = createMockSupabaseClient();

      mockSupabase.setTableResponse('books', [{ id: 'b1', title: 'Book 1' }]);
      mockSupabase.setTableResponse('profiles', { id: 'p1', role: 'student' });
      mockSupabase.setTableResponse('borrowing_records', [], null, 0);

      const booksRes = await mockSupabase.client.from('books').select('*');
      const profileRes = await mockSupabase.client.from('profiles').select('*').single();
      const borrowRes = await mockSupabase.client.from('borrowing_records').select('*');

      expect(booksRes.data).toEqual([{ id: 'b1', title: 'Book 1' }]);
      expect(profileRes.data).toEqual({ id: 'p1', role: 'student' });
      expect(borrowRes.count).toBe(0);

      // Verify that calling from() repeatedly returns the same builder instance for that table
      const b1 = mockSupabase.getTableBuilder('books');
      const b2 = mockSupabase.client.from('books');
      expect(b1).toBe(b2);
    });

    it('simulates database error states correctly per table', async () => {
      const mockSupabase = createMockSupabaseClient();
      const dbError = { message: 'relation "secret_table" does not exist', code: '42P01' };

      mockSupabase.setTableResponse('secret_table', null, dbError);

      const res = await mockSupabase.client.from('secret_table').select('*');
      expect(res.data).toBeNull();
      expect(res.error).toEqual(dbError);

      const singleRes = await mockSupabase.client.from('secret_table').select('*').single();
      expect(singleRes.data).toBeNull();
      expect(singleRes.error).toEqual(dbError);
    });
  });

  describe('3. RPC Mocking & Isolation', () => {
    it('returns default RPC response when no specific RPC response is configured', async () => {
      const mockSupabase = createMockSupabaseClient();
      const res = await mockSupabase.client.rpc('some_rpc', { arg: 1 });
      expect(res).toEqual({ data: null, error: null });
    });

    it('handles named RPC responses independently', async () => {
      const mockSupabase = createMockSupabaseClient();

      mockSupabase.setRpcResponse({ checkoutId: 'chk_123' }, null, 'checkout_book');
      mockSupabase.setRpcResponse(null, { message: 'Copy not found' }, 'return_book');

      const checkoutRes = await mockSupabase.client.rpc('checkout_book', { copy_id: 'c1' });
      expect(checkoutRes).toEqual({ data: { checkoutId: 'chk_123' }, error: null });

      const returnRes = await mockSupabase.client.rpc('return_book', { copy_id: 'c2' });
      expect(returnRes).toEqual({ data: null, error: { message: 'Copy not found' } });
    });

    it('stress tests RPC response ordering: setting default after named RPC', async () => {
      const mockSupabase = createMockSupabaseClient();

      // Set named RPC first
      mockSupabase.setRpcResponse({ special: true }, null, 'named_proc');

      // Set default RPC response afterwards
      mockSupabase.setRpcResponse({ defaultVal: true }, null);

      // Test default RPC
      const fallbackRes = await mockSupabase.client.rpc('unregistered_proc');
      expect(fallbackRes.data).toEqual({ defaultVal: true });

      // Verify whether named_proc still resolves its specific response!
      const namedRes = await mockSupabase.client.rpc('named_proc');
      expect(namedRes.data).toEqual({ special: true });
    });

    it('stress tests RPC response ordering: setting named RPC after default RPC', async () => {
      const mockSupabase = createMockSupabaseClient();

      // Set default RPC first
      mockSupabase.setRpcResponse({ defaultVal: true }, null);

      // Set named RPC afterwards
      mockSupabase.setRpcResponse({ special: true }, null, 'named_proc');

      const fallbackRes = await mockSupabase.client.rpc('unregistered_proc');
      expect(fallbackRes.data).toEqual({ defaultVal: true });

      const namedRes = await mockSupabase.client.rpc('named_proc');
      expect(namedRes.data).toEqual({ special: true });
    });
  });

  describe('4. Auth & Storage Sub-clients', () => {
    it('provides mock auth client with default resolutions and custom overrides', async () => {
      const mockSupabase = createMockSupabaseClient();
      const userRes = await mockSupabase.auth.getUser();
      expect(userRes).toEqual({ data: { user: null }, error: null });

      const sessionRes = await mockSupabase.auth.getSession();
      expect(sessionRes).toEqual({ data: { session: null }, error: null });

      const signOutRes = await mockSupabase.auth.signOut();
      expect(signOutRes).toEqual({ error: null });

      // Overrides test
      const customClient = createMockSupabaseClient({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'admin-user-id', email: 'admin@school.edu' } },
            error: null,
          }),
        },
      });

      const customUser = await customClient.auth.getUser();
      expect(customUser.data.user?.id).toBe('admin-user-id');
    });

    it('provides mock storage client with bucket operations', async () => {
      const mockSupabase = createMockSupabaseClient();
      const storageBucket = mockSupabase.storage.from('library-cards');

      const urlRes = storageBucket.getPublicUrl('card-1.png');
      expect(urlRes.data.publicUrl).toBe('https://placeholder.supabase.co/storage/asset.png');

      const listRes = await storageBucket.list('cards');
      expect(listRes).toEqual({ data: [], error: null });

      const uploadRes = await storageBucket.upload('card-2.png', new Blob());
      expect(uploadRes).toEqual({ data: { path: 'asset.png' }, error: null });

      const downloadRes = await storageBucket.download('card-2.png');
      expect(downloadRes.data).toBeInstanceOf(Blob);

      const removeRes = await storageBucket.remove(['card-2.png']);
      expect(removeRes).toEqual({ data: [], error: null });
    });
  });

  describe('5. Next Cache & Server Mocks', () => {
    it('tracks revalidatePath and revalidateTag invocations', () => {
      revalidatePath('/dashboard', 'layout');
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard', 'layout');

      revalidateTag('catalog');
      expect(revalidateTag).toHaveBeenCalledWith('catalog');
    });

    it('unstable_cache wraps target function transparently', async () => {
      const compute = vi.fn((a: number, b: number) => a + b);
      const cachedCompute = unstable_cache(compute, ['key-part'], { tags: ['tag1'] });

      const result = cachedCompute(10, 32);
      expect(result).toBe(42);
      expect(compute).toHaveBeenCalledWith(10, 32);
    });

    it('executes after() callbacks immediately', () => {
      const sideEffect = vi.fn();
      after(sideEffect);
      expect(sideEffect).toHaveBeenCalledTimes(1);
    });

    it('supports full cookie lifecycle: set, get, getAll, has, delete, clear', async () => {
      const store = createMockCookieStore({ initial: 'value1' });

      expect(store.has('initial')).toBe(true);
      expect(store.get('initial')).toEqual({ name: 'initial', value: 'value1' });

      // String overload
      store.set('session_id', 'sess_999');
      expect(store.get('session_id')).toEqual({ name: 'session_id', value: 'sess_999' });

      // Object overload
      store.set({ name: 'theme', value: 'dark' });
      expect(store.get('theme')).toEqual({ name: 'theme', value: 'dark' });

      // getAll()
      const all = store.getAll();
      expect(all).toHaveLength(3);

      // getAll(name)
      const filtered = store.getAll('theme');
      expect(filtered).toEqual([{ name: 'theme', value: 'dark' }]);

      // delete()
      store.delete('theme');
      expect(store.has('theme')).toBe(false);
      expect(store.get('theme')).toBeUndefined();

      // clear()
      store.clear();
      expect(store.getAll()).toHaveLength(0);
    });

    it('setMockCookies updates the store resolved by cookies()', async () => {
      setMockCookies({ auth_token: 'jwt_xyz' });

      const cookieStore = await cookies();
      expect(cookieStore.get('auth_token')).toEqual({ name: 'auth_token', value: 'jwt_xyz' });
    });

    it('resetNextCacheMocks restores clean state across all mocks', async () => {
      revalidatePath('/test');
      revalidateTag('test-tag');
      setMockCookies({ foo: 'bar' });

      resetNextCacheMocks();

      expect(revalidatePath).not.toHaveBeenCalled();
      expect(revalidateTag).not.toHaveBeenCalled();

      const freshCookies = await cookies();
      expect(freshCookies.getAll()).toHaveLength(0);
    });
  });

  describe('6. Hermetic Environment Isolation', () => {
    it('has hermetic mock environment variables configured in setup.ts', () => {
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toContain('supabase.co');
      expect(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBeDefined();
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
    });

    it('executes in isolation without network calls', async () => {
      // Ensure global fetch is not called during mock queries
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const client = createMockSupabaseClient();
      client.setTableResponse('audit_logs', [{ id: 1 }]);

      const res = await client.client.from('audit_logs').select('*');
      expect(res.data).toEqual([{ id: 1 }]);
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });
  });
});
