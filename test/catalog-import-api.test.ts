import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/catalog/import-jobs/route';
import { POST as process } from '@/app/api/catalog/import-jobs/process/route';
import { getMe } from '@/lib/auth-helpers';
import { createMockQueryBuilder, createMockSupabaseClient } from '@/test/mocks/supabase';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), wake: vi.fn() }));
vi.mock('@/lib/auth-helpers', () => ({ getMe: vi.fn() }));
vi.mock('@/lib/catalog-import-scheduler', () => ({
  scheduleCatalogImport: mocks.wake,
  catalogWorkerToken: () => 'private-worker-token',
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: () => ({ update: mocks.update }),
  }),
}));

const request = (body: unknown) =>
  new Request('http://localhost/api/catalog/import-jobs', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('/api/catalog/import-jobs & /process', () => {
  let supaMock: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    supaMock = createMockSupabaseClient();
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.update.mockReturnValue({ eq: () => ({ in: async () => ({ error: null }) }) });
    vi.mocked(getMe).mockResolvedValue({
      user: { id: '00000000-0000-4000-8000-000000000099' },
      role: 'librarian',
      profile: { status: 'ACTIVE' },
      supabase: supaMock.client,
    } as unknown as Awaited<ReturnType<typeof getMe>>);
  });

  it('GET enforces auth and roles, lists recent import jobs with items, and propagates DB errors', async () => {
    vi.mocked(getMe).mockResolvedValueOnce(null);
    expect((await GET(new Request('http://localhost/api/catalog/import-jobs'))).status).toBe(401);

    vi.mocked(getMe).mockResolvedValueOnce({
      user: { id: 'sa-1' },
      role: 'student_assistant',
      profile: { status: 'ACTIVE' },
      supabase: supaMock.client,
    } as unknown as Awaited<ReturnType<typeof getMe>>);
    expect((await GET(new Request('http://localhost/api/catalog/import-jobs'))).status).toBe(403);

    const job1 = { id: 'job-1', label: 'ISBN import', created_at: '2026-11-14T00:00:00Z' };
    const job2 = { id: 'job-2', label: 'Enrichment', created_at: '2026-11-13T00:00:00Z' };
    const items1 = [{ id: 'it-1', isbn: '9781492040347', status: 'complete' }];

    supaMock.setTableResponse('catalog_import_jobs', [job1, job2], null);
    const itemsBuilder1 = createMockQueryBuilder(items1, null);
    const itemsBuilder2 = createMockQueryBuilder(null, null);
    let itemCalls = 0;
    supaMock.from.mockImplementation((table: string) => {
      if (table === 'catalog_import_items') {
        itemCalls += 1;
        return itemCalls === 1 ? itemsBuilder1 : itemsBuilder2;
      }
      return supaMock.getTableBuilder(table);
    });

    const okRes = await GET(new Request('http://localhost/api/catalog/import-jobs'));
    expect(okRes.status).toBe(200);
    expect(await okRes.json()).toEqual({
      jobs: [
        { ...job1, items: items1 },
        { ...job2, items: [] },
      ],
    });

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    supaMock.setTableResponse('catalog_import_jobs', null, { message: 'Jobs query failed' });
    const jobsErr = await GET(new Request('http://localhost/api/catalog/import-jobs'));
    expect(jobsErr.status).toBe(500);

    supaMock.setTableResponse('catalog_import_jobs', [job1], null);
    supaMock.from.mockImplementation((table: string) => {
      if (table === 'catalog_import_items') {
        return createMockQueryBuilder(null, { message: 'Items query failed' });
      }
      return supaMock.getTableBuilder(table);
    });
    const itemsErr = await GET(new Request('http://localhost/api/catalog/import-jobs'));
    expect(itemsErr.status).toBe(500);
    errSpy.mockRestore();
  });

  it('normalizes duplicate ISBNs into one item while preserving requested copies and request id', async () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect((await POST(request({ isbns: ['9781492040347', '978-1492040347'], requestId: id }))).status).toBe(201);
    expect(mocks.rpc).toHaveBeenCalledWith(
      'catalog_import_enqueue',
      expect.objectContaining({
        p_job: id,
        p_items: [{ isbn: '9781492040347', mode: 'create', requested_copies: 2 }],
      })
    );
    expect(mocks.wake).toHaveBeenCalledOnce();
  });

  it.each([{ isbns: ['bad'] }, { isbns: Array(501).fill('9781492040347') }, { isbns: Array(51).fill('9781492040347') }])(
    'rejects invalid/oversized imports before writing',
    async (body) => {
      expect((await POST(request(body))).status).toBe(400);
      expect(mocks.rpc).not.toHaveBeenCalled();
    }
  );

  it('rejects inactive staff, malformed JSON, and propagates RPC/retry update errors', async () => {
    vi.mocked(getMe).mockResolvedValueOnce({
      user: { id: 'lib-inactive' },
      role: 'librarian',
      profile: { status: 'INACTIVE' },
    } as unknown as Awaited<ReturnType<typeof getMe>>);
    expect((await POST(request({ isbns: ['9781492040347'] }))).status).toBe(403);

    expect((await POST(request('{not-json'))).status).toBe(400);

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.rpc.mockResolvedValueOnce({ error: { message: 'Enqueue RPC error' } });
    expect((await POST(request({ isbns: ['9781492040347'] }))).status).toBe(500);

    mocks.update.mockReturnValueOnce({
      eq: () => ({ in: async () => ({ error: { message: 'Retry update failed' } }) }),
    });
    expect(
      (await POST(request({ retryJobId: '00000000-0000-4000-8000-000000000001' }))).status
    ).toBe(500);
    errSpy.mockRestore();
  });

  it('retries saved items without clearing book references or copy application state', async () => {
    expect((await POST(request({ retryJobId: '00000000-0000-4000-8000-000000000001' }))).status).toBe(200);
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('book_id');
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('copies_applied');
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.wake).toHaveBeenCalledOnce();
  });

  it('denies anonymous requests to start imports or wake the worker', async () => {
    vi.mocked(getMe).mockResolvedValue(null);
    expect((await POST(request({ isbns: ['9781492040347'] }))).status).toBe(401);
    expect((await process(request({}))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.wake).not.toHaveBeenCalled();
  });

  it('permits a private worker continuation without a browser session', async () => {
    vi.mocked(getMe).mockResolvedValue(null);
    const response = await process(
      new Request('http://localhost/api/catalog/import-jobs/process', {
        method: 'POST',
        headers: { Authorization: 'Bearer private-worker-token' },
      })
    );
    expect(response.status).toBe(202);
    expect(mocks.wake).toHaveBeenCalledWith(true);
  });
});
