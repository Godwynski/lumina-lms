import { vi, type Mock } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MockFn = Mock<(...args: any[]) => any>;

export interface MockSupabaseQueryBuilder {
  select: MockFn;
  insert: MockFn;
  update: MockFn;
  delete: MockFn;
  upsert: MockFn;
  eq: MockFn;
  neq: MockFn;
  in: MockFn;
  is: MockFn;
  gt: MockFn;
  gte: MockFn;
  lt: MockFn;
  lte: MockFn;
  like: MockFn;
  ilike: MockFn;
  not: MockFn;
  or?: MockFn;
  textSearch: MockFn;
  order: MockFn;
  limit: MockFn;
  range: MockFn;
  single: MockFn;
  maybeSingle: MockFn;
  setResolveValue: (data: unknown, error?: unknown, count?: number | null) => void;
  then: <TResult1 = { data: unknown; error: unknown; count: number | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown; count: number | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) => Promise<TResult1 | TResult2>;
  [key: string]: unknown;
}

export interface MockSupabaseClientInstance {
  from: MockFn;
  rpc: MockFn;
  auth: {
    getUser: MockFn;
    getSession: MockFn;
    signOut: MockFn;
    [key: string]: unknown;
  };
  storage: {
    from: MockFn;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface MockSupabaseClientHelper {
  client: MockSupabaseClientInstance;
  from: MockFn;
  rpc: MockFn;
  auth: {
    getUser: MockFn;
    getSession: MockFn;
    signOut: MockFn;
    [key: string]: unknown;
  };
  storage: {
    from: MockFn;
    [key: string]: unknown;
  };
  setTableResponse: (table: string, data: unknown, error?: unknown, count?: number | null) => void;
  setRpcResponse: (data: unknown, error?: unknown, rpcName?: string) => void;
  getTableBuilder: (table: string) => MockSupabaseQueryBuilder;
}

/**
 * Creates a chainable query builder mock that supports standard Supabase query operations.
 * Resolves data, error, and optional count when awaited or when .single()/.maybeSingle() is called.
 */
export function createMockQueryBuilder(
  resolvedData: unknown = null,
  resolvedError: unknown = null,
  resolvedCount: number | null = null
): MockSupabaseQueryBuilder {
  let currentData = resolvedData;
  let currentError = resolvedError;
  let currentCount = resolvedCount;

  const builder: MockSupabaseQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: currentData, error: currentError })
    ),
    maybeSingle: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: currentData, error: currentError })
    ),
    setResolveValue(data: unknown, error: unknown = null, count: number | null = null) {
      currentData = data;
      currentError = error;
      currentCount = count;
      builder.single.mockImplementation(() =>
        Promise.resolve({ data: currentData, error: currentError })
      );
      builder.maybeSingle.mockImplementation(() =>
        Promise.resolve({ data: currentData, error: currentError })
      );
    },
    then<TResult1 = { data: unknown; error: unknown; count: number | null }, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: unknown; error: unknown; count: number | null }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ) {
      return Promise.resolve({
        data: currentData,
        error: currentError,
        count: currentCount,
      }).then(onfulfilled, onrejected);
    },
  };

  return builder;
}

/**
 * Creates a mock Supabase client with chainable query builder and RPC mocks,
 * along with helper methods to easily configure per-table or per-RPC responses.
 */
export function createMockSupabaseClient(overrides?: {
  client?: Record<string, unknown>;
  queryBuilder?: Record<string, unknown>;
  auth?: Record<string, unknown>;
}): MockSupabaseClientHelper {
  const tableBuilders = new Map<string, MockSupabaseQueryBuilder>();
  const rpcResponses = new Map<string, { data: unknown; error: unknown }>();
  let defaultRpcResponse: { data: unknown; error: unknown } = { data: null, error: null };

  const getTableBuilder = (table: string): MockSupabaseQueryBuilder => {
    if (!tableBuilders.has(table)) {
      tableBuilders.set(table, createMockQueryBuilder());
    }
    return tableBuilders.get(table)!;
  };

  const from = vi.fn().mockImplementation((table: string) => {
    return getTableBuilder(table);
  });

  const rpc = vi.fn().mockImplementation((rpcName: string, ..._args: unknown[]) => {
    if (rpcResponses.has(rpcName)) {
      return Promise.resolve(rpcResponses.get(rpcName)!);
    }
    return Promise.resolve(defaultRpcResponse);
  });

  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides?.auth,
  };

  const storageBucketMock = {
    list: vi.fn().mockResolvedValue({ data: [], error: null }),
    getPublicUrl: vi.fn().mockReturnValue({
      data: { publicUrl: 'https://placeholder.supabase.co/storage/asset.png' },
    }),
    upload: vi.fn().mockResolvedValue({ data: { path: 'asset.png' }, error: null }),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
    download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
  };

  const storage = {
    from: vi.fn().mockReturnValue(storageBucketMock),
  };

  const client: MockSupabaseClientInstance = {
    from,
    rpc,
    auth,
    storage,
    ...overrides?.client,
  };

  const setTableResponse = (
    table: string,
    data: unknown,
    error: unknown = null,
    count: number | null = null
  ) => {
    const builder = getTableBuilder(table);
    builder.setResolveValue(data, error, count);
  };

  const setRpcResponse = (data: unknown, error: unknown = null, rpcName?: string) => {
    if (rpcName) {
      rpcResponses.set(rpcName, { data, error: error ?? null });
    } else {
      defaultRpcResponse = { data, error: error ?? null };
    }
  };

  return {
    client,
    from,
    rpc,
    auth,
    storage,
    setTableResponse,
    setRpcResponse,
    getTableBuilder,
  };
}
