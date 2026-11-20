import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookDetailModal } from '@/components/catalog/BookDetailModal';
import { StudentBookCard } from '@/components/library/StudentBookCard';
import { isOutOfService } from '@/components/catalog/types';
import type { Book } from '@/lib/types';

const { publicDetails } = vi.hoisted(() => ({ publicDetails: vi.fn() }));
vi.mock('@/lib/actions/catalog', () => ({ getBookPublicDetails: publicDetails, getBookAdminDetails: vi.fn() }));
vi.mock('@/lib/actions/reservations', () => ({ cancelReservation: vi.fn() }));
vi.mock('@/components/common/ReserveTitleButton', () => ({ ReserveTitleButton: () => <button>Reserve title</button> }));
vi.mock('@/components/catalog/AdminManagementContent', () => ({ AdminManagementContent: () => <div>Admin tools</div> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: vi.fn() }) }));

const baseBook = { id: 'b', title: 'Clean Systems', author: 'Martin', description: 'A book about systems.', dewey_decimal: '005.1', isbn: '978-1', tags: [], categories: null, section: null, location: null, cover_url: null };
const noHold = { hasReservation: false, isReady: false, queuePosition: null, holdExpiresAt: null, reservationId: null, nextAvailableDate: null };

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  el = document.body.appendChild(document.createElement('div'));
  root = createRoot(el);
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  vi.clearAllMocks();
});

describe('BookDetailModal (student)', () => {
  it('shows the description and DDC, and closes on Escape after tabbing', async () => {
    publicDetails.mockResolvedValue({ book: { ...baseBook, available_copies: 2, total_copies: 3 }, availability: { ...noHold, outOfServiceCount: 0 } });
    const onOpenChange = vi.fn();
    await act(async () => root.render(<BookDetailModal bookId="b" open variant="student" onOpenChange={onOpenChange} />));
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog).toHaveTextContent('A book about systems.');
    expect(dialog).toHaveTextContent('005.1');
    expect(dialog).toHaveTextContent('Reserve title');

    const focused = (document.activeElement ?? dialog) as HTMLElement;
    await act(async () => {
      focused.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      (document.activeElement ?? dialog).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('marks a title whose only copies are in maintenance as temporarily unavailable, with no waitlist', async () => {
    publicDetails.mockResolvedValue({ book: { ...baseBook, available_copies: 0, total_copies: 1 }, availability: { ...noHold, outOfServiceCount: 1 } });
    await act(async () => root.render(<BookDetailModal bookId="b" open variant="student" onOpenChange={vi.fn()} />));
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog).toHaveTextContent('Temporarily Unavailable');
    expect(dialog).toHaveTextContent('0 borrowed');
    expect(dialog).toHaveTextContent('1 unavailable');
    expect(dialog).not.toHaveTextContent('Fully Borrowed');
    expect(dialog).not.toHaveTextContent('Reserve title');
  });

  it('keeps the waitlist for a title with copies on loan, and shows cancel for an existing hold on a maintenance-only title', async () => {
    publicDetails.mockResolvedValue({ book: { ...baseBook, available_copies: 0, total_copies: 2 }, availability: { ...noHold, outOfServiceCount: 1 } });
    await act(async () => root.render(<BookDetailModal bookId="b" open variant="student" onOpenChange={vi.fn()} />));
    expect(document.querySelector('[role="dialog"]')).toHaveTextContent('Reserve title');
    expect(document.querySelector('[role="dialog"]')).toHaveTextContent('Currently Unavailable');
  });
});

describe('isOutOfService', () => {
  it('is true only when nothing is on the shelf or on loan', () => {
    expect(isOutOfService({ available_copies: 0, total_copies: 1 }, { outOfServiceCount: 1 })).toBe(true);
    expect(isOutOfService({ available_copies: 0, total_copies: 2 }, { outOfServiceCount: 1 })).toBe(false);
    expect(isOutOfService({ available_copies: 1, total_copies: 2 }, { outOfServiceCount: 1 })).toBe(false);
    expect(isOutOfService({ available_copies: 0, total_copies: 1 }, {})).toBe(false);
    expect(isOutOfService({ available_copies: 0, total_copies: 0 }, { outOfServiceCount: 0 })).toBe(false);
  });
});

describe('StudentBookCard', () => {
  it('gives an uploaded cover descriptive alt text', async () => {
    const book = { ...baseBook, cover_url: '/covers/x.png', available_copies: 1, total_copies: 1 } as unknown as Book;
    await act(async () => root.render(<StudentBookCard book={book} />));
    expect(document.querySelector('img')).toHaveAttribute('alt', 'Cover of Clean Systems');
  });
});
