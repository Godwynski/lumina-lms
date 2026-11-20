import { act, Suspense } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BookDetailModal } from '@/components/catalog/BookDetailModal';
import { StudentBookDetailClient } from '@/app/(authenticated)/student-catalog/[id]/StudentBookDetailClient';
import { StudentBookCard } from '@/components/library/StudentBookCard';
import { isOutOfService } from '@/components/catalog/types';
import type { Book } from '@/lib/types';

const { publicDetails, adminDetails } = vi.hoisted(() => ({ publicDetails: vi.fn(), adminDetails: vi.fn() }));
vi.mock('@/lib/actions/catalog', () => ({ getBookPublicDetails: publicDetails, getBookAdminDetails: adminDetails, getCategories: async () => [] }));
vi.mock('@/lib/actions/reservations', () => ({ cancelReservation: vi.fn() }));
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
  it('opens the full Catalog page from the header and keeps the reservation action in the footer', async () => {
    publicDetails.mockResolvedValue({ book: { ...baseBook, section: 'General', location: 'Shelf A2', available_copies: 2, total_copies: 3 }, availability: noHold });
    await act(async () => root.render(<BookDetailModal bookId="b" open variant="student" onOpenChange={vi.fn()} />));
    const dialog = document.querySelector('[role="dialog"]')!;
    const footer = dialog.querySelector('footer');
    const header = dialog.querySelector('[data-slot="dialog-header"]');
    const fullPageLink = header?.querySelector('a[href="/student-catalog/b"]');
    expect(fullPageLink).toHaveAccessibleName('Open full page');
    expect(dialog.querySelectorAll('a[href="/student-catalog/b"]')).toHaveLength(1);
    expect(dialog.querySelector('[aria-label="Expand dialog"]')).toBeNull();
    expect(footer?.querySelector('a')).toBeNull();
    expect(footer).toHaveTextContent('Reserve for Pickup');
    expect(dialog.textContent?.match(/on shelf/gi)).toHaveLength(1);
    expect(dialog.querySelector('dl')).toHaveTextContent('Shelf locationShelf A2');
  });

  it('shows the return date with the waitlist action, then shows the queue position for an existing hold', async () => {
    const book = { ...baseBook, available_copies: 0, total_copies: 2 };
    publicDetails.mockResolvedValueOnce({ book, availability: { ...noHold, nextAvailableDate: '2027-01-15' } });
    await act(async () => root.render(<BookDetailModal bookId="b" open variant="student" onOpenChange={vi.fn()} />));
    expect(document.querySelector('footer')).toHaveTextContent('Join Waitlist');
    expect(document.querySelector('[role="dialog"]')).toHaveTextContent(/Expected return Jan.*15/i);

    publicDetails.mockResolvedValueOnce({ book, availability: { ...noHold, hasReservation: true, queuePosition: 2, reservationId: 'hold' } });
    await act(async () => root.render(<BookDetailModal bookId="other-book" open variant="student" onOpenChange={vi.fn()} />));
    expect(document.querySelector('[role="dialog"]')).toHaveTextContent('Queue position #2');
    expect(document.querySelector('footer')).toHaveTextContent('Cancel reservation');
    expect(document.querySelector('footer')).not.toHaveTextContent('Join Waitlist');
  });

  it('uses the Inventory header to expand and restore the dialog without losing its content', async () => {
    adminDetails.mockResolvedValue({ book: { ...baseBook, available_copies: 2, total_copies: 3 }, copies: [], queue: [] });
    await act(async () => root.render(<BookDetailModal bookId="b" open variant="super_admin" onOpenChange={vi.fn()} />));
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog).toHaveTextContent('Book Details');
    const expand = dialog.querySelector<HTMLButtonElement>('[data-slot="dialog-header"] [aria-label="Expand dialog"]')!;
    expect(dialog.querySelectorAll('[aria-label="Expand dialog"]')).toHaveLength(1);
    expect(dialog.querySelector('a[href="/student-catalog/b"]')).toBeNull();
    await act(async () => expand.click());
    expect(dialog).toHaveClass('h-[100dvh]');
    expect(dialog).toHaveTextContent('Clean Systems');
    await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-label="Restore dialog size"]')!.click());
    expect(dialog).not.toHaveClass('h-[100dvh]');
    expect(dialog.querySelector('[aria-label="Expand dialog"]')).toBeInTheDocument();
  });

  it('returns to the standard size after closing an expanded dialog', async () => {
    adminDetails.mockResolvedValue({ book: { ...baseBook, available_copies: 1, total_copies: 1 }, copies: [], queue: [] });
    const onOpenChange = vi.fn();
    await act(async () => root.render(<BookDetailModal bookId="b" open variant="super_admin" onOpenChange={onOpenChange} />));
    await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Expand dialog"]')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')!.click());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    await act(async () => root.render(<BookDetailModal bookId="b" open={false} variant="super_admin" onOpenChange={onOpenChange} />));
    await act(async () => root.render(<BookDetailModal bookId="b" open variant="super_admin" onOpenChange={onOpenChange} />));
    expect(document.querySelector('[aria-label="Expand dialog"]')).toBeInTheDocument();
  });

  it('shows the description and DDC, and closes on Escape after tabbing', async () => {
    publicDetails.mockResolvedValue({ book: { ...baseBook, available_copies: 2, total_copies: 3 }, availability: { ...noHold, outOfServiceCount: 0 } });
    const onOpenChange = vi.fn();
    await act(async () => root.render(<BookDetailModal bookId="b" open variant="student" onOpenChange={onOpenChange} />));
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog).toHaveTextContent('A book about systems.');
    expect(dialog).toHaveTextContent('005.1');
    expect(dialog).toHaveTextContent('Reserve for Pickup');

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
    expect(dialog.querySelector('footer button')).toBeNull();
  });

  it('keeps the waitlist for a title with copies on loan, and shows cancel for an existing hold on a maintenance-only title', async () => {
    publicDetails.mockResolvedValue({ book: { ...baseBook, available_copies: 0, total_copies: 2 }, availability: { ...noHold, outOfServiceCount: 1 } });
    await act(async () => root.render(<BookDetailModal bookId="b" open variant="student" onOpenChange={vi.fn()} />));
    expect(document.querySelector('[role="dialog"]')).toHaveTextContent('Join Waitlist');
    expect(document.querySelector('[role="dialog"]')).toHaveTextContent('Currently Unavailable');
  });
});

describe('Catalog book page', () => {
  it('shows a single shelf status alongside the book description, DDC and reservation action', async () => {
    const book = { ...baseBook, section: 'General', location: 'Shelf A2', available_copies: 2, total_copies: 3 };
    await act(async () => root.render(
      <Suspense fallback="Loading">
        <StudentBookDetailClient id="b" bookPromise={Promise.resolve(book)} availabilityPromise={Promise.resolve(noHold)} />
      </Suspense>
    ));
    expect(el.querySelector('h2')).toHaveTextContent('Clean Systems');
    expect(el.textContent?.match(/on shelf/gi)).toHaveLength(1);
    expect(el).toHaveTextContent('A book about systems.');
    expect(el).toHaveTextContent('005.1');
    expect(el.querySelector('dl')).toHaveTextContent('Shelf locationShelf A2');
    expect(el.querySelector('button')).toHaveAccessibleName('Reserve for Pickup');
  });
});

describe('isOutOfService', () => {
  it('is true only when nothing is on the shelf or on loan', () => {
    expect(isOutOfService({ available_copies: 0, total_copies: 1 }, { outOfServiceCount: 1 })).toBe(true);
    expect(isOutOfService({ available_copies: 0, total_copies: 2 }, { outOfServiceCount: 1 })).toBe(false);
    expect(isOutOfService({ available_copies: 1, total_copies: 2 }, { outOfServiceCount: 1 })).toBe(false);
    expect(isOutOfService({ available_copies: 0, total_copies: 1 }, {})).toBe(false);
    expect(isOutOfService({ available_copies: 0, total_copies: 0 }, { outOfServiceCount: 0 })).toBe(true);
  });
});

describe('StudentBookCard', () => {
  const defaultCover = '/images/default-book-cover.png';
  const remoteCover = 'https://covers.example.test/book.png';

  it('labels a title with zero remaining copies as unavailable and hides reservation entry', async () => {
    const book = { ...baseBook, available_copies: 0, total_copies: 0 } as unknown as Book;
    await act(async () => root.render(<StudentBookCard book={book} />));
    expect(el).toHaveTextContent('Unavailable');
    expect(el.querySelector('button[aria-label*="Reserve"]')).toBeNull();
    expect(el).not.toHaveTextContent('Join Queue');
  });

  async function renderCard(coverUrl: string | null) {
    const book = { ...baseBook, cover_url: coverUrl, available_copies: 1, total_copies: 1 } as unknown as Book;
    await act(async () => root.render(<StudentBookCard book={book} />));
  }

  async function loadCover(image: HTMLImageElement, width: number, height: number) {
    Object.defineProperties(image, {
      naturalWidth: { value: width },
      naturalHeight: { value: height },
    });
    await act(async () => image.dispatchEvent(new Event('load')));
  }

  function expectDefaultCover(image: HTMLImageElement) {
    const request = new URL(image.src);
    expect(request.pathname).toBe('/_next/image');
    expect(request.searchParams.get('url')).toBe(defaultCover);
    expect(image).toHaveAttribute('sizes', '64px');
  }

  it('keeps a valid remote cover lazy and reveals it after loading', async () => {
    await renderCard(remoteCover);
    const image = el.querySelector('img')!;
    expect(image).toHaveAttribute('src', remoteCover);
    expect(image).toHaveAttribute('alt', 'Cover of Clean Systems');
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveClass('opacity-0');

    await loadCover(image, 300, 450);
    expect(el.querySelector('img')).toHaveAttribute('src', remoteCover);
    expect(el.querySelector('img')).toHaveClass('opacity-100');
  });

  it.each([null, '', '   '])('uses the local default for a missing or blank cover (%j)', async (coverUrl) => {
    await renderCard(coverUrl);
    const image = el.querySelector('img')!;
    expectDefaultCover(image);
    expect(image).toHaveAttribute('loading', 'lazy');

    await loadCover(image, 300, 450);
    expectDefaultCover(el.querySelector('img')!);
    expect(el.querySelector('img')).toHaveClass('opacity-100');
  });

  it('replaces a broken remote cover with the local default', async () => {
    await renderCard(remoteCover);
    await act(async () => el.querySelector('img')!.dispatchEvent(new Event('error')));
    expectDefaultCover(el.querySelector('img')!);
  });

  it.each([[1, 1], [1, 20], [20, 1]])('replaces a %i by %i remote image with the local default', async (width, height) => {
    await renderCard(remoteCover);
    await loadCover(el.querySelector('img')!, width, height);
    expectDefaultCover(el.querySelector('img')!);
  });

  it('keeps the book icon when the local default fails', async () => {
    await renderCard(null);
    const image = el.querySelector('img')!;
    expectDefaultCover(image);
    const coverFrame = image.parentElement!;

    await act(async () => image.dispatchEvent(new Event('error')));
    expect(coverFrame.querySelector('img')).toBeNull();
    expect(coverFrame.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('tries a replacement cover after an earlier URL fails', async () => {
    await renderCard(remoteCover);
    await act(async () => el.querySelector('img')!.dispatchEvent(new Event('error')));
    expectDefaultCover(el.querySelector('img')!);

    const replacementCover = 'https://covers.example.test/replacement.png';
    await renderCard(replacementCover);
    await loadCover(el.querySelector('img')!, 300, 450);
    expect(el.querySelector('img')).toHaveAttribute('src', replacementCover);
    expect(el.querySelector('img')).toHaveClass('opacity-100');
  });

  it('waits for a replacement to load when the earlier cover finishes decoding late', async () => {
    await renderCard(remoteCover);
    const image = el.querySelector('img')!;
    const decode = Promise.withResolvers<void>();
    Object.defineProperty(image, 'decode', { value: () => decode.promise });
    await loadCover(image, 300, 450);

    const replacementCover = 'https://covers.example.test/replacement.png';
    await renderCard(replacementCover);
    await act(async () => decode.resolve());
    expect(el.querySelector('img')).toHaveAttribute('src', replacementCover);
    expect(el.querySelector('img')).toHaveClass('opacity-0');
  });
});
