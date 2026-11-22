import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { AuditLogClient } from '@/components/admin/AuditLogClient';
import { clickElement, typeIntoInput } from '@/test/helpers/render';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
const { useSWRMock } = vi.hoisted(() => ({ useSWRMock: vi.fn() }));
vi.mock('swr', () => ({ default: useSWRMock }));
vi.mock('@/components/catalog/BookDetailModal', () => ({ BookDetailModal: () => null }));
vi.mock('@/components/admin/AuditLogExportModal', () => ({ AuditLogExportModal: () => null }));

it('keeps selectors inside the filter modal and restores them when reopened', async () => {
  useSWRMock.mockReturnValue({ data: { logs: [], total: 0, options: [] }, mutate: vi.fn() });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState(null, '', '/audit?bookId=00000000-0000-4000-8000-000000000001&studentId=00000000-0000-4000-8000-000000000002');
  const el = document.body.appendChild(document.createElement('div'));
  const root = createRoot(el);
  try {
    await act(async () => root.render(<AuditLogClient />));
    expect(el.querySelector('details')).toBeNull();
    expect(el.querySelector('[role="combobox"]')).toBeNull();
    const filters = [...el.querySelectorAll('button')].find(button => button.textContent?.startsWith('Filters'))!;
    await act(async () => filters.click());
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog).toHaveTextContent('Advanced Audit Filters');
    expect(dialog).toHaveTextContent('Book: Selected record');
    expect(dialog).toHaveTextContent('Student: Selected record');
    expect(dialog).toHaveTextContent('Copy: All');
    expect(dialog.querySelectorAll('[role="combobox"]')).toHaveLength(2);
    expect(dialog.querySelectorAll('input[type="date"]')).toHaveLength(2);
    await act(async () => [...dialog.querySelectorAll('button')].find(button => button.textContent === 'Done')!.click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(window.location.search).toContain('studentId=');
    await act(async () => filters.click());
    expect(document.querySelector('[role="dialog"]')).toHaveTextContent('Student: Selected record');
  } finally {
    act(() => root.unmount());
    el.remove();
    window.history.replaceState(null, '', '/');
  }
});

it('sorts the audit timestamp in either layout, preserves filters, and shows the total only in the footer', async () => {
  const entries = [
    { id: 'recent', created_at: '2026-11-12T10:00:00Z' },
    { id: 'oldest', created_at: '2026-11-01T10:00:00Z' },
  ].map((entry) => ({ ...entry, action: 'create', entity_type: 'book', profiles: null }));
  useSWRMock.mockImplementation((key: string) => ({
    data: { logs: key.includes('sort=oldest') ? entries.toReversed() : entries, total: 24 },
    mutate: vi.fn(),
  }));
  window.history.replaceState(null, '', '/audit?query=book&actionType=create&page=2');
  const el = document.body.appendChild(document.createElement('div'));
  const root = createRoot(el);
  try {
    const render = () => act(async () => root.render(<AuditLogClient />));
    await render();
    expect(el.querySelector('th[aria-sort="descending"]')).toHaveTextContent('Timestamp');
    expect(el.querySelector('p[role="status"]')).toHaveClass('sr-only');
    expect(el).toHaveTextContent('Showing 21-24 of 24');
    const toggle = el.querySelector<HTMLButtonElement>('th[aria-sort="descending"] button')!;
    await act(async () => toggle.click());
    await render();
    expect(window.location.search).toBe('?query=book&actionType=create&sort=oldest');
    expect(useSWRMock).toHaveBeenLastCalledWith(expect.stringContaining('limit=20&offset=0'), expect.any(Function), expect.any(Object));
    expect(el.querySelector('th[aria-sort="ascending"]')).toHaveTextContent('Timestamp');
    expect(el.querySelector('tbody tr')).toHaveTextContent('2026-11-01');

    const select = el.querySelector<HTMLSelectElement>('select[aria-label="Sort by"]')!;
    expect(select).toHaveValue('oldest');
    await act(async () => {
      select.value = 'newest';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await render();
    expect(window.location.search).toBe('?query=book&actionType=create');
    expect(el.querySelector('tbody tr')).toHaveTextContent('2026-11-12');
  } finally {
    act(() => root.unmount());
    el.remove();
    window.history.replaceState(null, '', '/');
  }
});

it.each(['library', '', 'all'])('requests one sorted audit page with the pending search %j', async (query) => {
  const { default: useSWR, SWRConfig } = await vi.importActual<typeof import('swr')>('swr');
  useSWRMock.mockImplementation(useSWR);
  const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => Response.json({
    logs: [{ id: 'entry', created_at: '2026-11-01T10:00:00Z', action: 'create', entity_type: 'book', profiles: null }],
    total: 42,
  }));
  vi.stubGlobal('fetch', fetch);
  vi.useFakeTimers();
  window.history.replaceState(null, '', '/audit?query=book&actionType=create&page=2');
  const el = document.body.appendChild(document.createElement('div'));
  const root = createRoot(el);
  const options = { provider: () => new Map(), shouldRetryOnError: false };
  const render = () => act(async () => root.render(<SWRConfig value={options}><AuditLogClient /></SWRConfig>));

  try {
    await render();
    expect(el.querySelector('tbody tr')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockClear();

    await typeIntoInput(el.querySelector<HTMLInputElement>('input[aria-label="Search audit records"]'), query);
    expect(fetch).not.toHaveBeenCalled();
    await clickElement(el.querySelector('th[aria-sort="descending"] button'));
    await render();
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    await render();

    const params = new URLSearchParams({ limit: '20', offset: '0', sort: 'oldest' });
    if (query) params.set('query', query);
    params.set('actionType', 'create');
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([`/api/admin/audit-logs?${params}`]);
    expect(new URLSearchParams(window.location.search).get('page')).toBeNull();
  } finally {
    act(() => root.unmount());
    el.remove();
    window.history.replaceState(null, '', '/');
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});
