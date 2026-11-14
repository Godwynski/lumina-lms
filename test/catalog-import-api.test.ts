import { beforeEach, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/catalog/import-jobs/route';
import { POST as process } from '@/app/api/catalog/import-jobs/process/route';
import { getMe } from '@/lib/auth-helpers';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), wake: vi.fn() }));
vi.mock('@/lib/auth-helpers', () => ({ getMe: vi.fn() }));
vi.mock('@/lib/catalog-import-scheduler', () => ({ scheduleCatalogImport: mocks.wake, catalogWorkerToken: () => 'private-worker-token' }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({
  rpc: mocks.rpc,
  from: () => ({ update: mocks.update }),
}) }));
const request = (body: unknown) => new Request('http://localhost/api/catalog/import-jobs', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: () => ({ in: async () => ({ error: null }) }) });
  vi.mocked(getMe).mockResolvedValue({ user: { id: '00000000-0000-4000-8000-000000000099' }, role: 'librarian', profile: { status: 'ACTIVE' } } as unknown as Awaited<ReturnType<typeof getMe>>);
});

it('normalizes duplicate ISBNs into one item while preserving requested copies and request id', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  expect((await POST(request({ isbns: ['9781492040347', '978-1492040347'], requestId: id }))).status).toBe(201);
  expect(mocks.rpc).toHaveBeenCalledWith('catalog_import_enqueue', expect.objectContaining({ p_job: id, p_items: [{ isbn: '9781492040347', mode: 'create', requested_copies: 2 }] }));
  expect(mocks.wake).toHaveBeenCalledOnce();
});

it.each([{ isbns: ['bad'] }, { isbns: Array(501).fill('9781492040347') }, { isbns: Array(51).fill('9781492040347') }])('rejects invalid/oversized imports before writing', async body => {
  expect((await POST(request(body))).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it('retries saved items without clearing book references or copy application state', async () => {
  expect((await POST(request({ retryJobId: '00000000-0000-4000-8000-000000000001' }))).status).toBe(200);
  expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('book_id');
  expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('copies_applied');
  expect(mocks.rpc).not.toHaveBeenCalled();
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
  const response = await process(new Request('http://localhost/api/catalog/import-jobs/process', { method: 'POST', headers: { Authorization: 'Bearer private-worker-token' } }));
  expect(response.status).toBe(202);
  expect(mocks.wake).toHaveBeenCalledWith(true);
});
