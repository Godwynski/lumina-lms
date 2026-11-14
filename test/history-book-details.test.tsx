import { Suspense, act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import HistoryContent from '@/app/(authenticated)/history/HistoryContent';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams('view=logs') }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: vi.fn() }) }));
vi.mock('@/components/catalog/BookDetailModal', () => ({ BookDetailModal: (p: { bookId: string; variant: string }) => <div data-testid="book-modal">{p.bookId}:{p.variant}</div> }));
it.each(['librarian', 'student_assistant'] as const)('opens details with borrower links appropriate for %s', async (role) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const el = document.body.appendChild(document.createElement('div'));
  const root = createRoot(el);
  const historyPromise = Promise.resolve({ totalCount: 1, records: [{ id: 'loan', book_copy_id: 'copy', user_id: 'borrower', status: 'ACTIVE' as const, borrowed_at: '2026-11-01', due_date: '2026-11-20', returned_at: null, books: { id: 'book-1', title: 'Sample Book', author: 'Author', cover_url: null }, profiles: { id: 'borrower', full_name: 'Sample Borrower', email: 'borrower@school.edu', student_id: 'STU-123' } }] });
  try {
    await act(async () => root.render(<Suspense><HistoryContent historyPromise={historyPromise} page={1} statusFilter="all" searchQuery="" userRole={role} /></Suspense>));
    const book = el.querySelector<HTMLButtonElement>('button[aria-label="View book details: Sample Book"]');
    expect(book).not.toBeNull();
    await act(async () => book!.click());
    expect(el.querySelector('[data-testid="book-modal"]')).toHaveTextContent('book-1:read_only');
    const borrower = el.querySelector<HTMLButtonElement>('button[aria-label="View borrower: Sample Borrower"]');
    expect(borrower).not.toBeNull();
    await act(async () => borrower!.click());
    expect(document.querySelector('[role="dialog"]')).toHaveTextContent('borrower@school.edu');
    expect(!!document.querySelector('a[href="/users/borrower"]')).toBe(role === 'librarian');
  } finally { act(() => root.unmount()); el.remove(); }
});
