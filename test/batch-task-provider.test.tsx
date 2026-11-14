import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BatchTaskProvider, useBatchTask } from '@/components/providers/BatchTaskProvider';

const { refresh, preferences } = vi.hoisted(() => ({ refresh: vi.fn(), preferences: { role: 'librarian', profile: { status: 'ACTIVE' } } }));
vi.mock('@/components/providers/PreferencesProvider', () => ({ usePreferences: () => preferences }));
vi.mock('next/navigation', () => { const router = { refresh }; return { useRouter: () => router }; });
vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
let root: Root;
let host: HTMLDivElement;
let jobs: unknown[];
let fetchMock: ReturnType<typeof vi.fn>;
function Probe() {
  const task = useBatchTask();
  return <><button onClick={() => task.startISBNLookup(['9780743273565', '9780743273565'])}>Start test</button><span data-testid="processing">{String(task.isISBNProcessing)}</span></>;
}
const item = { id: 'item1', isbn: '9780743273565', book_id: 'book1', status: 'review', metadata_status: 'complete', cover_status: 'missing', title: 'Test book', attempts: 3, error: 'Cover unavailable', next_attempt_at: null };
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  preferences.role = 'librarian'; preferences.profile.status = 'ACTIVE';
  const storage = new Map<string, string>(); vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
  jobs = [{ id: 'job1', label: 'ISBN import', created_at: '2026-11-13', items: [item] }];
  fetchMock = vi.fn(async (_url, options) => ({ ok: true, json: async () => options?.method === 'POST' ? { jobId: 'job1' } : { jobs } }));
  vi.stubGlobal('fetch', fetchMock);
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('recovers review items, shows missing covers, and dismisses without deleting the persistent job', async () => {
  await act(async () => root.render(<BatchTaskProvider><Probe /></BatchTaskProvider>));
  expect(host.textContent).toContain('1 need review');
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Expand import details"]')!.click());
  expect(host.textContent).toContain('Metadata: complete');
  expect(host.textContent).toContain('Cover: missing');
  expect(host.textContent).toContain('Retry failed items');
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Dismiss completed import"]')!.click());
  expect(host.textContent).not.toContain('Catalog import needs attention');
  expect(localStorage.getItem('catalog-import-dismissed-job')).toBe('job1');
  expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'DELETE')).toBe(true);
});
it('polls an unfinished job and stops polling once it finishes', async () => {
  jobs = [{ id: 'job1', label: 'ISBN import', items: [{ ...item, status: 'queued', cover_status: 'pending' }] }];
  await act(async () => root.render(<BatchTaskProvider><Probe /></BatchTaskProvider>));
  expect(host.querySelector('[data-testid="processing"]')).toHaveTextContent('true');
  expect(fetchMock.mock.calls.some(([url]) => url === '/api/catalog/import-jobs/process')).toBe(true);
  jobs = [{ id: 'job1', label: 'ISBN import', items: [{ ...item, status: 'complete', cover_status: 'complete' }] }];
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(host.textContent).toContain('Catalog import complete');
  expect(host.querySelector('[data-testid="processing"]')).toHaveTextContent('false');
  const count = fetchMock.mock.calls.length;
  await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
  expect(fetchMock).toHaveBeenCalledTimes(count);
});



it('shows provider waiting time instead of an active spinner and wakes when the retry is due', async () => {
  vi.setSystemTime(new Date('2026-11-13T03:30:00Z'));
  jobs = [{ id: 'job1', label: 'ISBN import', items: [{ ...item, status: 'retry', next_attempt_at: '2026-11-13T03:30:06Z', cover_status: 'complete' }] }];
  await act(async () => root.render(<BatchTaskProvider><Probe /></BatchTaskProvider>));
  expect(host.textContent).toContain('Waiting for provider');
  expect(host.textContent).toContain('Manila time');
  expect(host.querySelector('.animate-spin')).toBeNull();
  const wakes = () => fetchMock.mock.calls.filter(([url]) => url === '/api/catalog/import-jobs/process').length;
  const before = wakes();
  await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
  expect(host.textContent).not.toContain('Waiting for provider');
  expect(host.textContent).toContain('Catalog import in progress');
  expect(wakes()).toBeGreaterThan(before);
});

it('hides a waiting import across refreshes while the saved job continues', async () => {
  vi.setSystemTime(new Date('2026-11-13T03:30:00Z'));
  jobs = [{ id: 'job1', label: 'ISBN import', items: [item, { ...item, id: 'waiting', status: 'retry', next_attempt_at: '2026-11-13T04:06:00Z' }] }];
  await act(async () => root.render(<BatchTaskProvider><Probe /></BatchTaskProvider>));
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Expand import details"]')!.click());
  expect(Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Retry failed items')).toBeEnabled();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Hide import progress"]')!.click());
  expect(host.querySelector('aside')).toBeNull();
  expect(host.querySelector('[data-testid="processing"]')).toHaveTextContent('true');
  expect(localStorage.getItem('catalog-import-dismissed-job')).toBe('job1');
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(host.querySelector('aside')).toBeNull();
  act(() => root.unmount());
  root = createRoot(host);
  await act(async () => root.render(<BatchTaskProvider><Probe /></BatchTaskProvider>));
  expect(host.querySelector('aside')).toBeNull();
  expect(host.querySelector('[data-testid="processing"]')).toHaveTextContent('true');
  expect(fetchMock.mock.calls.every(([, options]) => options?.method !== 'DELETE')).toBe(true);
});

it('sends retries to the server without importing books again in the browser', async () => {
  await act(async () => root.render(<BatchTaskProvider><Probe /></BatchTaskProvider>));
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Expand import details"]')!.click());
  const retry = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Retry failed items')!;
  await act(async () => retry.click());
  expect(fetchMock.mock.calls.some(([url, options]) => url === '/api/catalog/import-jobs' && options?.body === JSON.stringify({ retryJobId: 'job1' }))).toBe(true);
});
it('queues duplicate entries intact with a request id', async () => {
  jobs = [];
  await act(async () => root.render(<BatchTaskProvider><Probe /></BatchTaskProvider>));
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Start test')!.click());
  const call = fetchMock.mock.calls.find(([url, options]) => url === '/api/catalog/import-jobs' && options?.method === 'POST');
  expect(JSON.parse(call![1].body)).toEqual({ isbns: ['9780743273565', '9780743273565'], requestId: expect.any(String) });
});

it.each(['student', 'student_assistant'])('does not fetch, poll, or submit imports for %s', async role => {
  preferences.role = role;
  await act(async () => root.render(<BatchTaskProvider><Probe /></BatchTaskProvider>));
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Start test')!.click());
  await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(6000); });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(host.querySelector('[data-testid="processing"]')).toHaveTextContent('false');
  expect(host.querySelector('aside')).toBeNull();
});
it('clears cached staff jobs and stops polling after demotion', async () => {
  jobs = [{ id: 'job1', label: 'ISBN import', items: [{ ...item, status: 'queued' }] }];
  await act(async () => root.render(<BatchTaskProvider><Probe /></BatchTaskProvider>));
  expect(host.querySelector('aside')).not.toBeNull();
  preferences.role = 'student';
  await act(async () => root.render(<BatchTaskProvider><Probe /></BatchTaskProvider>));
  const count = fetchMock.mock.calls.length;
  await act(async () => { window.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(6000); });
  expect(fetchMock).toHaveBeenCalledTimes(count);
  expect(host.querySelector('aside')).toBeNull();
  expect(host.querySelector('[data-testid="processing"]')).toHaveTextContent('false');
});
it('does not load jobs for an inactive librarian', async () => {
  preferences.profile.status = 'SUSPENDED';
  await act(async () => root.render(<BatchTaskProvider><Probe /></BatchTaskProvider>));
  expect(fetchMock).not.toHaveBeenCalled();
});

it('ignores a staff request that finishes after demotion', async () => {
  let finish: (value: unknown) => void = () => {};
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => root.render(<BatchTaskProvider><Probe /></BatchTaskProvider>));
  preferences.role = 'student';
  await act(async () => root.render(<BatchTaskProvider><Probe /></BatchTaskProvider>));
  await act(async () => finish({ ok: true, json: async () => ({ jobs }) }));
  expect(host.querySelector('aside')).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('shows the title for spreadsheet enrichment without an ISBN', async () => {
  jobs = [{ id: 'job1', label: 'Spreadsheet enrichment', items: [{ ...item, isbn: null }] }];
  await act(async () => root.render(<BatchTaskProvider><Probe /></BatchTaskProvider>));
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Expand import details"]')!.click());
  expect(host.textContent).toContain('Test book: review.');
  expect(host.textContent).not.toContain('null');
});
