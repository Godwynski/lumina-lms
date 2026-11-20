import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { AuditLogClient } from '@/components/admin/AuditLogClient';

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock('swr', () => ({ default: () => ({ data: { logs: [], total: 0, options: [] }, mutate: vi.fn() }) }));
vi.mock('@/components/catalog/BookDetailModal', () => ({ BookDetailModal: () => null }));
vi.mock('@/components/admin/AuditLogExportImportModal', () => ({ AuditLogExportImportModal: () => null }));

it('keeps selectors inside the filter modal and restores them when reopened', async () => {
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
