import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderClient, cleanupClients } from './helpers/render';
import { CatalogTable, type CatalogReservationInfo } from '@/components/library/CatalogTable';
import type { Book } from '@/lib/types';

vi.mock('@/lib/actions/reservations', () => ({ getBookAvailabilityStatus: vi.fn(), cancelReservation: vi.fn() }));
vi.mock('@/lib/actions/catalog', () => ({ getBookPublicDetails: vi.fn(() => new Promise(() => {})), getBookAdminDetails: vi.fn(), getCategories: async () => [] }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel: vi.fn() }) }));

const book = (over: Partial<Book>): Book => ({
  id: 'b1', title: 'Clean Code', author: 'Robert Martin', isbn: '978-1', available_copies: 2, total_copies: 3,
  categories: null, section: null, location: null, cover_url: null, tags: [],
  ...over,
} as Book);

const render = (books: Book[], reserved = new Map<string, CatalogReservationInfo>()) =>
  renderClient(<CatalogTable books={books} reservedBooksMap={reserved} onReserveSuccess={vi.fn()} onCancelSuccess={vi.fn()} />);

const mobileRows = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[role="button"][tabindex="0"]')];

afterEach(() => cleanupClients());

describe('CatalogTable phone layout', () => {
  it('renders one compact row per book with title, author and copies, without the labelled field grid', async () => {
    const { container } = await render([book({}), book({ id: 'b2', title: 'Refactoring', author: 'Fowler', available_copies: 0, total_copies: 1 })]);
    const rows = mobileRows(container);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Clean Code');
    expect(rows[0]).toHaveTextContent('Robert Martin');
    expect(rows[0]).toHaveTextContent('2 / 3');
    expect(rows[1]).toHaveTextContent('0 / 1');
    expect(rows[0].querySelector('.grid-cols-2')).toBeNull();
    expect(rows[0]).not.toHaveTextContent('ISBN');
  });

  it('keeps the reserve button out of phone rows but in the desktop table', async () => {
    const { container } = await render([book({})]);
    expect(mobileRows(container)[0].querySelector('button')).toBeNull();
    const desktopButton = container.querySelector('table button')!;
    expect(desktopButton).toHaveTextContent('Reserve for Pickup');
    expect(desktopButton).toHaveClass('h-8', 'text-xs');
    expect(desktopButton).not.toHaveClass('min-h-11');
  });

  it('shows the hold state on a phone row: Ready or queue position', async () => {
    const reserved = new Map<string, CatalogReservationInfo>([
      ['b1', { status: 'READY', queuePosition: 1 }],
      ['b2', { status: 'ACTIVE', queuePosition: 4 }],
    ]);
    const { container } = await render([book({}), book({ id: 'b2', title: 'Refactoring', available_copies: 0 })], reserved);
    const [ready, queued] = mobileRows(container);
    expect(ready).toHaveTextContent('Ready');
    expect(queued).toHaveTextContent('#4');
  });

  it('opens the book dialog when a phone row is tapped', async () => {
    const { container } = await render([book({})]);
    await act(async () => mobileRows(container)[0].click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('opens the book dialog from the keyboard', async () => {
    const { container } = await render([book({})]);
    await act(async () => {
      mobileRows(container)[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('labels a title with no copies and no hold as Unavailable in the desktop table', async () => {
    const { container } = await render([book({ available_copies: 0, total_copies: 0 })]);
    expect(container.querySelector('table')).toHaveTextContent('Unavailable');
    expect(container.querySelector('table button')).toBeNull();
  });
});
