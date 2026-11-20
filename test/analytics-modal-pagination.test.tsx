import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { AnalyticsDetailModal } from '@/app/(authenticated)/analytics/AnalyticsDetailModal';
const { getDetail } = vi.hoisted(() => ({ getDetail: vi.fn() }));
vi.mock('@/lib/actions/analytics', () => ({ getAnalyticsDetail: getDetail }));
vi.mock('@/components/catalog/BookDetailModal', () => ({ BookDetailModal: () => null }));
vi.mock('@/components/common/BorrowerDetailsModal', () => ({ BorrowerDetailsModal: () => null }));
it('keeps close and pagination outside the scrolling records and loads the next page', async () => {
 (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
 const selection = { kind: 'hour' as const, key: '10 AM', title: 'Visits at 10 AM', from: '2026-11-01', to: '2026-11-13' };
 getDetail.mockImplementation(async (_selection, page) => ({ total: 21, rows: [{ id: String(page), occurred_at: '2026-11-12T02:00:00Z', borrower_name: null, borrower_id: null, book_id: null, status: 'CHECK_IN' }] }));
 const el = document.body.appendChild(document.createElement('div')); const root = createRoot(el);
 try {
  await act(async () => root.render(<AnalyticsDetailModal selection={selection} onClose={vi.fn()} />));
  const body = document.querySelector('[aria-label="Analytics records"]');
  expect(body).not.toBeNull();
  expect(body!.querySelector('button[aria-label="Next page"]')).toBeNull();
  const next = document.querySelector<HTMLButtonElement>('button[aria-label="Next page"]');
  expect(next).not.toBeNull();
  await act(async () => next!.click());
  expect(getDetail).toHaveBeenLastCalledWith(selection, 2);
  expect(document.querySelector('[role="dialog"]')).toHaveTextContent('Page 2 of 2');
  expect(next).toBeDisabled();
 } finally { act(() => root.unmount()); el.remove(); }
});
