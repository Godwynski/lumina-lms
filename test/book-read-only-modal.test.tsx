import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { BookDetailModal } from '@/components/catalog/BookDetailModal';
const { publicDetails, adminDetails } = vi.hoisted(() => ({ publicDetails: vi.fn(), adminDetails: vi.fn() }));
vi.mock('@/lib/actions/catalog', () => ({ getBookPublicDetails: publicDetails, getBookAdminDetails: adminDetails }));
vi.mock('@/lib/actions/reservations', () => ({ cancelReservation: vi.fn() }));
vi.mock('@/components/common/ReserveTitleButton', () => ({ ReserveTitleButton: () => <button>Reserve title</button> }));
vi.mock('@/components/catalog/AdminManagementContent', () => ({ AdminManagementContent: () => <div>Admin tools</div> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: vi.fn() }) }));
it('reuses book information without reservation or administration actions', async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  publicDetails.mockResolvedValue({ book: { id: 'b', title: 'Read-only Book', author: 'Author', description: 'Book description', tags: [], available_copies: 2, total_copies: 3 }, availability: { hasReservation: false } });
  const el = document.body.appendChild(document.createElement('div'));
  const root = createRoot(el);
  try {
    await act(async () => root.render(<BookDetailModal bookId="b" open variant="read_only" onOpenChange={vi.fn()} />));
    expect(document.querySelector('[role="dialog"]')).toHaveTextContent('Read-only Book');
    expect(document.querySelector('[role="dialog"]')).toHaveTextContent('Book description');
    expect(document.body).not.toHaveTextContent('Reserve title');
    expect(document.body).not.toHaveTextContent('Admin tools');
    expect(adminDetails).not.toHaveBeenCalled();
  } finally { act(() => root.unmount()); el.remove(); }
});

it('updates the cover when switching books and falls back on image failure', async () => {
  const el = document.body.appendChild(document.createElement('div'));
  const root = createRoot(el);
  const result = (id: string, cover: string) => ({ book: { id, title: id, author: 'Author', cover_url: cover, tags: [], available_copies: 1, total_copies: 1 }, availability: { hasReservation: false } });
  const show = async (id: string, cover: string) => {
    publicDetails.mockResolvedValue(result(id, cover));
    await act(async () => root.render(<BookDetailModal bookId={id} open variant="read_only" onOpenChange={vi.fn()} />));
  };
  try {
    await show('first', '/first-cover.png');
    expect(document.querySelector('img[alt="first"]')).toHaveAttribute('src', expect.stringContaining('/first-cover.png'));
    await show('second', '/second-cover.png');
    expect(document.querySelector('img[alt="second"]')).toHaveAttribute('src', expect.stringContaining('/second-cover.png'));
    await act(async () => document.querySelector('img[alt="second"]')!.dispatchEvent(new Event('error')));
    expect(document.querySelector('img[alt="second"]')).toHaveAttribute('src', expect.stringContaining('/images/default-book-cover.png'));
  } finally { act(() => root.unmount()); el.remove(); }
});
