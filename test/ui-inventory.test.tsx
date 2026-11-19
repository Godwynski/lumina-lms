import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderClient, cleanupClients, clickElement, typeIntoInput } from './helpers/render';

const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouterRefresh = vi.fn();
const mockRouter = { push: mockRouterPush, replace: mockRouterReplace, refresh: mockRouterRefresh };
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
}));

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    fill: _fill,
    priority: _priority,
    unoptimized: _unoptimized,
    ...rest
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
    unoptimized?: boolean;
  }) => {
    void _fill;
    void _priority;
    void _unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt ?? ''} {...rest} />;
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/actions/catalog', () => ({
  getCategories: vi.fn().mockResolvedValue([{ id: 'cat-1', name: 'Computer Science' }]),
  createBook: vi.fn().mockResolvedValue({ success: true }),
  getBooksForExport: vi.fn().mockResolvedValue([]),
  batchImportBooks: vi.fn().mockResolvedValue({ success: true, imported: 0, copiesAdded: 0, duplicates: 0, logs: [] }),
  getBookAdminDetails: vi.fn().mockResolvedValue({ book: null, copies: [], queue: [] }),
}));

vi.mock('@/lib/actions/isbn-lookup', () => ({
  fetchISBNDetails: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => {
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    };
    return {
      channel: () => channel,
      removeChannel: vi.fn(),
    };
  },
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,MOCK_QR'),
  },
}));

import { AnimationProvider } from '@/components/providers/animation-provider';
import { BatchTaskProvider } from '@/components/providers/BatchTaskProvider';
import { PreferencesProvider } from '@/components/providers/PreferencesProvider';
import { InventoryTable } from '@/components/inventory/InventoryTable';
import { ModernInventoryClient } from '@/components/inventory/ModernInventoryClient';
import { StudentCatalogClient } from '@/app/(authenticated)/student-catalog/StudentCatalogClient';
import { QRPrinterModal } from '@/components/qr-printer-modal';
import { AddBookClient } from '@/app/(authenticated)/inventory/add/AddBookClient';
import type { Book, Category, ProfileData } from '@/lib/types';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    title: 'Design Patterns',
    author: 'Erich Gamma',
    isbn: '9780201633610',
    category_id: 'cat-1',
    categories: { name: 'Computer Science' },
    section: 'Computer Science',
    location: 'Shelf A-2',
    dewey_decimal: '005.1',
    available_copies: 0,
    total_copies: 2,
    is_active: true,
    cover_url: undefined,
    tags: [],
    description: null,
    published_year: 1994,
    ...overrides,
  };
}

function makeProfile(): ProfileData {
  return {
    id: 'staff-1',
    full_name: 'Librarian User',
    email: 'lib@alabang.sti.edu.ph',
    role: 'librarian',
    status: 'ACTIVE',
    student_id: null,
    department: 'Library',
    avatar_url: null,
    address: null,
    phone: null,
    updated_at: '2026-01-01T00:00:00Z',
    permissions: { manage_circulation: true, manage_attendance: true, view_admin_dashboard: true },
  };
}

describe('B5 Inventory & Add Book UI', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    mockRouterPush.mockReset();
    mockRouterReplace.mockReset();
    mockRouterRefresh.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ jobs: [] }), { status: 200 }))
    );
  });

  afterEach(() => {
    cleanupClients();
    vi.unstubAllGlobals();
  });

  it('InventoryTable renders no-results empty state on active filter without thead, and first-use state otherwise (F16)', async () => {
    const onClearFilters = vi.fn();
    const handle = await renderClient(
      <InventoryTable books={[]} canManage={true} hasActiveFilters={true} onClearFilters={onClearFilters} />
    );

    expect(handle.container).toHaveTextContent('No matches found');
    expect(handle.container).not.toHaveTextContent('Vault is Empty');
    expect(handle.container.querySelector('thead')).toBeNull();

    const clearBtn = Array.from(handle.container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Clear all filters')
    );
    expect(clearBtn).toBeDefined();
    await clickElement(clearBtn!);
    expect(onClearFilters).toHaveBeenCalledTimes(1);

    await handle.rerender(<InventoryTable books={[]} canManage={true} hasActiveFilters={false} />);
    expect(handle.container).toHaveTextContent('No books in inventory yet');
    expect(handle.container.querySelector('a[href="/inventory/add"]')).toHaveTextContent('Add Book');
  });

  it('InventoryTable renders unclipped Out of Stock badge and shelf location without duplicating section (F17, F40)', async () => {
    const book = makeBook({
      title: 'Design Patterns',
      section: 'Computer Science',
      location: 'Shelf CS-04',
      available_copies: 0,
      total_copies: 2,
      categories: { name: 'Computer Science' },
    });

    const { container } = await renderClient(<InventoryTable books={[book]} canManage={true} />);

    const outOfStockBadge = Array.from(container.querySelectorAll('table tbody td div')).find(
      (el) => el.textContent?.trim() === 'Out of Stock'
    );
    expect(outOfStockBadge).toBeDefined();
    expect(outOfStockBadge!.className).toContain('whitespace-nowrap');
    expect(outOfStockBadge!.className).not.toContain('h-5');

    const titleCell = container.querySelector('tbody td');
    expect(titleCell).toHaveTextContent('Design Patterns');
    expect(titleCell).toHaveTextContent('Shelf CS-04');
    expect(titleCell).not.toHaveTextContent('Computer Science');
  });

  it('ModernInventoryClient shows Add Book CTA and clears filters from filtered table empty state (F16, F40)', async () => {
    mockSearchParams = new URLSearchParams('q=zzzznonexistent9999&view=table');
    const categories: Category[] = [{ id: 'cat-1', name: 'Computer Science' }];

    const { container } = await renderClient(
      <AnimationProvider>
        <PreferencesProvider
          initialPreferences={{ theme: 'light', inventoryView: 'table' }}
          initialRole="librarian"
          initialProfile={makeProfile()}
        >
          <BatchTaskProvider>
            <ModernInventoryClient books={[]} totalItems={0} categories={categories} canManage={true} />
          </BatchTaskProvider>
        </PreferencesProvider>
      </AnimationProvider>
    );

    const addLink = container.querySelector('a[href="/inventory/add"]');
    expect(addLink).toHaveTextContent('Add Book');
    expect(container).toHaveTextContent('No matches found');

    const clearBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Clear all filters')
    );
    await clickElement(clearBtn!);
    expect(mockRouterReplace).toHaveBeenCalledWith('?view=table', { scroll: false });
  });

  it('sorts Inventory from a table header, preserves filters, and resets pagination for read-only staff', async () => {
    mockSearchParams = new URLSearchParams('q=Design&categoryId=cat-1&status=ARCHIVED&view=table&page=3&sort=author_asc');
    const inventory = () => (
      <AnimationProvider>
        <PreferencesProvider initialPreferences={{ inventoryView: 'table' }} initialRole="library_staff">
          <BatchTaskProvider>
            <ModernInventoryClient books={[makeBook()]} totalItems={35} categories={[]} canManage={false} />
          </BatchTaskProvider>
        </PreferencesProvider>
      </AnimationProvider>
    );
    const { container, rerender } = await renderClient(inventory());
    const authorHeader = () => Array.from(container.querySelectorAll('th')).find((cell) => cell.textContent?.includes('Author'));
    expect(authorHeader()).toHaveAttribute('aria-sort', 'ascending');
    expect(container.querySelector('a[href="/inventory/add"]')).toBeNull();
    expect(container.querySelector('button[aria-label="Batch operations"]')).toBeNull();

    await clickElement(authorHeader()?.querySelector('button'));
    expect(mockRouterReplace).toHaveBeenCalledWith('?q=Design&categoryId=cat-1&status=ARCHIVED&view=table&sort=author_desc', { scroll: false });

    mockSearchParams = new URLSearchParams('q=Design&categoryId=cat-1&status=ARCHIVED&view=table&sort=author_desc');
    await rerender(inventory());
    expect(authorHeader()).toHaveAttribute('aria-sort', 'descending');
    const copiesHeader = Array.from(container.querySelectorAll('th')).find((cell) => cell.textContent?.includes('Copies'));
    await clickElement(copiesHeader?.querySelector('button'));
    expect(mockRouterReplace).toHaveBeenLastCalledWith('?q=Design&categoryId=cat-1&status=ARCHIVED&view=table&sort=availability_desc', { scroll: false });
  });

  it('uses legacy Catalog sort links in the table and reflects the new order when switching to cards', async () => {
    mockSearchParams = new URLSearchParams('view=table&q=Design&category=cat-1&available=true&page=2&sort=title');
    const booksPromise = Promise.resolve({ books: [makeBook()], total: 35, hasMore: true });
    const categoriesPromise: Promise<Category[]> = Promise.resolve([{ id: 'cat-1', name: 'Computer Science' }]);
    const reservationsPromise = Promise.resolve([]);
    function catalog() {
      return (
        <AnimationProvider>
          <PreferencesProvider initialPreferences={{ catalogView: 'cards' }} initialRole="patron">
            <React.Suspense fallback={<div>Loading</div>}>
              <StudentCatalogClient
                booksPromise={booksPromise}
                categoriesPromise={categoriesPromise}
                reservationsPromise={reservationsPromise}
                initialFilters={{ q: 'Design', page: 2, categoryId: 'cat-1', availableOnly: true, sortBy: 'title' }}
              />
            </React.Suspense>
          </PreferencesProvider>
        </AnimationProvider>
      );
    }
    const { container, rerender } = await renderClient(catalog());
    const titleHeader = Array.from(container.querySelectorAll('th')).find((cell) => cell.textContent?.includes('Title'));
    expect(titleHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(container.querySelector('[aria-label="Sort books"]')).toHaveTextContent('Title A-Z');

    await clickElement(titleHeader?.querySelector('button'));
    expect(mockRouterReplace).toHaveBeenCalledWith('?view=table&q=Design&category=cat-1&available=true&sort=title_desc', { scroll: false });

    mockSearchParams = new URLSearchParams('view=cards&q=Design&category=cat-1&available=true&sort=title_desc');
    await rerender(catalog());
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('[aria-label="Sort books"]')).toHaveTextContent('Title Z-A');

    mockSearchParams = new URLSearchParams('view=cards&q=Design&sort=constructor');
    await rerender(catalog());
    expect(container.querySelector('[aria-label="Sort books"]')).toHaveTextContent('Best Match');
  });

  it('matches Catalog search styling and keeps Inventory search usable for read-only staff', async () => {
    const books = [makeBook()];
    const { container: inventory } = await renderClient(
      <AnimationProvider>
        <PreferencesProvider initialPreferences={{ inventoryView: 'table' }} initialRole="library_staff">
          <BatchTaskProvider>
            <ModernInventoryClient books={books} totalItems={1} categories={[]} canManage={false} />
          </BatchTaskProvider>
        </PreferencesProvider>
      </AnimationProvider>
    );
    const { container: catalog } = await renderClient(
      <AnimationProvider>
        <PreferencesProvider initialPreferences={{ catalogView: 'table' }} initialRole="patron">
          <React.Suspense fallback={<div>Loading</div>}>
            <StudentCatalogClient
              booksPromise={Promise.resolve({ books, total: 1, hasMore: false })}
              categoriesPromise={Promise.resolve([])}
              reservationsPromise={Promise.resolve([])}
              initialFilters={{ q: '', page: 1, categoryId: '', availableOnly: false, sortBy: 'newest' }}
            />
          </React.Suspense>
        </PreferencesProvider>
      </AnimationProvider>
    );
    const inventorySearch = inventory.querySelector<HTMLInputElement>('input[type="search"][aria-label="Search inventory"]');
    const catalogSearch = catalog.querySelector<HTMLInputElement>('input[type="search"][aria-label="Search the catalog"]');
    const getClear = (container: HTMLElement) => container.querySelector('button[aria-label="Clear search"]');

    expect(inventorySearch).toHaveAttribute('placeholder', 'Search books');
    expect(catalogSearch).toHaveAttribute('placeholder', 'Search by title, author, or ISBN...');
    expect(inventorySearch?.className).toBe(catalogSearch?.className);
    expect(inventorySearch?.previousElementSibling?.getAttribute('class')).toBe(catalogSearch?.previousElementSibling?.getAttribute('class'));
    expect(getClear(inventory)).toBeNull();
    expect(getClear(catalog)).toBeNull();
    expect(inventory.querySelector('a[href="/inventory/add"]')).toBeNull();

    vi.useFakeTimers();
    try {
      await typeIntoInput(inventorySearch, 'Design');
      await typeIntoInput(catalogSearch, 'Design');
      expect(inventorySearch?.className).toBe(catalogSearch?.className);
      expect(inventorySearch?.previousElementSibling?.getAttribute('class')).toBe(catalogSearch?.previousElementSibling?.getAttribute('class'));
      expect(getClear(inventory)).toHaveAttribute('type', 'button');
      expect(getClear(inventory)?.className).toBe(getClear(catalog)?.className);

      await clickElement(getClear(inventory));
      expect(inventorySearch).toHaveValue('');
      expect(getClear(inventory)).toBeNull();
      expect(mockRouterReplace).toHaveBeenCalledExactlyOnceWith('?', { scroll: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ['Inventory', 'categoryId=cat-1&status=ARCHIVED'],
    ['Catalog', 'category=cat-1&available=true'],
  ] as const)('submits pending %s search text with the sort in one navigation', async (screen, filters) => {
    const startingParams = `view=table&${filters}&q=Old&page=2`;
    mockSearchParams = new URLSearchParams(startingParams);
    const books = [makeBook()];
    const categories: Category[] = [{ id: 'cat-1', name: 'Computer Science' }];
    const inventory = screen === 'Inventory';
    const role = inventory ? 'library_staff' : 'patron';
    const booksPromise = Promise.resolve({ books, total: 35, hasMore: true });
    const categoriesPromise = Promise.resolve(categories);
    const reservationsPromise = Promise.resolve([]);
    const screenUi = () => (
      <AnimationProvider>
        <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole={role}>
          <BatchTaskProvider>
            {inventory ? (
              <ModernInventoryClient books={books} totalItems={35} categories={categories} canManage={false} />
            ) : (
              <React.Suspense fallback={<div>Loading</div>}>
                <StudentCatalogClient
                  booksPromise={booksPromise}
                  categoriesPromise={categoriesPromise}
                  reservationsPromise={reservationsPromise}
                  initialFilters={{ q: 'Old', page: 2, categoryId: 'cat-1', availableOnly: true, sortBy: 'relevance' }}
                />
              </React.Suspense>
            )}
          </BatchTaskProvider>
        </PreferencesProvider>
      </AnimationProvider>
    );
    const { container, rerender } = await renderClient(screenUi());
    const search = container.querySelector<HTMLInputElement>('input[type="search"]');
    vi.useFakeTimers();
    try {
      await typeIntoInput(search, '  Clean Code  ');
      expect(mockRouterReplace).not.toHaveBeenCalled();
      await clickElement(container.querySelector('th button[aria-label^="Sort by Author"]'));

      // Re-render with the old URL before the navigation resolves.
      mockSearchParams = new URLSearchParams(startingParams);
      await rerender(screenUi());
      await React.act(async () => { await vi.advanceTimersByTimeAsync(500); });
      expect(mockRouterReplace).toHaveBeenCalledExactlyOnceWith(
        `?view=table&${filters}&q=Clean+Code&sort=author_asc`, { scroll: false }
      );

      mockSearchParams = new URLSearchParams(`view=table&${filters}&q=Clean+Code&sort=author_asc`);
      await rerender(screenUi());
      expect(search).toHaveValue('  Clean Code  ');
      expect(container.querySelector('th[aria-sort="ascending"]')).toHaveTextContent('Author');
    } finally {
      vi.useRealTimers();
    }
  });

  it('QRPrinterModal prints via print portal without mutating document.body or reloading (F18)', async () => {
    const printSpy = vi.fn();
    const reloadSpy = vi.fn();
    vi.stubGlobal('print', printSpy);
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadSpy },
    });

    try {
      const { container } = await renderClient(
        <div data-testid="app-shell">
          <QRPrinterModal qrString="QR-ACC-007" bookTitle="Clean Code" />
        </div>
      );

      await clickElement(
        Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Print QR'))
      );
      await new Promise((r) => setTimeout(r, 0));

      const printBtn = Array.from(document.body.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Print Label')
      );
      await clickElement(printBtn!);

      expect(printSpy).toHaveBeenCalledTimes(1);
      expect(reloadSpy).not.toHaveBeenCalled();
      expect(container.querySelector('[data-testid="app-shell"]')).toBeInTheDocument();
      expect(document.body.querySelector('[data-qr-print-sheet="true"]')).toHaveTextContent('QR-ACC-007');
    } finally {
      cleanupClients();
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      });
    }
  });

  it('AddBookClient unifies field styling and removes duplicate ISBN Reference input (F19)', async () => {
    const { container } = await renderClient(<AddBookClient />);
    await new Promise((r) => setTimeout(r, 0));

    // Only one ISBN input (ISBN Quick Lookup) exists on /inventory/add
    expect(container.querySelector('input[placeholder="Enter ISBN-10 or ISBN-13"]')).toBeInTheDocument();
    expect(container.querySelector('input[placeholder="9780132350884"]')).toBeNull();

    // Publication Year & Description share unified FieldGroup label + rounded-lg border styling
    const pubYearInput = container.querySelector(
      'input[placeholder="When available from the ISBN lookup"]'
    ) as HTMLInputElement;
    const titleInput = container.querySelector('input[placeholder="e.g. Clean Code"]') as HTMLInputElement;
    expect(pubYearInput.className).toContain('rounded-lg');
    expect(titleInput.className).toContain('rounded-lg');
  });
});
