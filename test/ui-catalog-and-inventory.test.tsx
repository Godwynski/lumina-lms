import { createRequire } from 'node:module';
import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderClient,
  cleanupClients,
  clickElement,
  typeIntoInput,
  submitForm,
  pressKey,
} from './helpers/render';

// --- External boundary mocks ---
const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouterRefresh = vi.fn();
let mockSearchParamsString = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    refresh: mockRouterRefresh,
  }),
  useSearchParams: () => new URLSearchParams(mockSearchParamsString),
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

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

const mockUpdateBookCopyStatus = vi.fn();
const mockUpdateBook = vi.fn();
const mockSoftDeleteBook = vi.fn();
const mockRestoreBook = vi.fn();
const mockGetBookAdminDetails = vi.fn();
const mockGetBookPublicDetails = vi.fn();
const mockAddBookCopies = vi.fn();
const mockGetCategories = vi.fn();
const mockGetBooksForExport = vi.fn();
const mockBatchImportBooks = vi.fn();
const mockLookupAndImportISBN = vi.fn();

vi.mock('@/lib/actions/catalog', () => ({
  updateBookCopyStatus: (...args: unknown[]) => mockUpdateBookCopyStatus(...args),
  updateBook: (...args: unknown[]) => mockUpdateBook(...args),
  softDeleteBook: (...args: unknown[]) => mockSoftDeleteBook(...args),
  restoreBook: (...args: unknown[]) => mockRestoreBook(...args),
  getBookAdminDetails: (...args: unknown[]) => mockGetBookAdminDetails(...args),
  getBookPublicDetails: (...args: unknown[]) => mockGetBookPublicDetails(...args),
  addBookCopies: (...args: unknown[]) => mockAddBookCopies(...args),
  getCategories: (...args: unknown[]) => mockGetCategories(...args),
  getBooksForExport: (...args: unknown[]) => mockGetBooksForExport(...args),
  batchImportBooks: (...args: unknown[]) => mockBatchImportBooks(...args),
  lookupAndImportISBN: (...args: unknown[]) => mockLookupAndImportISBN(...args),
}));

const mockCancelReservation = vi.fn();
const mockGetBookAvailabilityStatus = vi.fn();
vi.mock('@/lib/actions/reservations', () => ({
  cancelReservation: (...args: unknown[]) => mockCancelReservation(...args),
  getBookAvailabilityStatus: (...args: unknown[]) => mockGetBookAvailabilityStatus(...args),
}));

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateClient(),
}));

const mockQRToDataURL = vi.fn();
vi.mock('qrcode', () => ({
  default: {
    toDataURL: (...args: unknown[]) => mockQRToDataURL(...args),
  },
}));

const mockToPng = vi.hoisted(() => vi.fn());
vi.mock('html-to-image', () => ({
  toPng: mockToPng,
}));
// Work around Vitest v4 concurrent dynamic-import bug where the 2nd Promise.all import('html-to-image')
// falls through to Node's CJS module: patch the underlying CJS export before it is wrapped.
const nodeRequire = createRequire(import.meta.url);
const cjsHtmlToImage = nodeRequire('html-to-image') as { toPng: (...args: unknown[]) => Promise<string> };
cjsHtmlToImage.toPng = (...args: unknown[]) => mockToPng(...args);

const mockXlsxWriteFile = vi.fn();
vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>();
  return {
    ...actual,
    writeFile: (...args: unknown[]) => mockXlsxWriteFile(...args),
  };
});

import { AnimationProvider } from '@/components/providers/animation-provider';
import { BatchTaskProvider } from '@/components/providers/BatchTaskProvider';
import { CopyMeter } from '@/components/catalog/CopyMeter';
import { MetaTile } from '@/components/catalog/MetaTile';
import { StatusBanner } from '@/components/catalog/StatusBanner';
import {
  ReservationQueuePanel,
  formatRelativeTime,
  type ReservationQueueEntry,
} from '@/components/catalog/admin/ReservationQueuePanel';
import { QRPrinterModal } from '@/components/qr-printer-modal';
import { ISBNLookupBar } from '@/components/catalog/add/ISBNLookupBar';
import { CoverUploader } from '@/components/catalog/add/CoverUploader';
import { BookDetailsForm } from '@/components/catalog/add/BookDetailsForm';
import { AdminManagementContent } from '@/components/catalog/AdminManagementContent';
import { BookDetailModal } from '@/components/catalog/BookDetailModal';
import { ModernBookCard } from '@/components/inventory/ModernBookCard';
import { StudentBookCard } from '@/components/library/StudentBookCard';
import { InventoryGrid } from '@/components/inventory/InventoryGrid';
import { ModernInventoryClient } from '@/components/inventory/ModernInventoryClient';
import MyCardContainer from '@/components/library/MyCardContainer';
import type { Book, BookCopyWithReservation, Category, Reservation } from '@/lib/types';
import type { BookDetail, AvailabilityStatus } from '@/components/catalog/types';
import { BookOpen } from 'lucide-react';

// --- DOM polyfills for Radix UI / jsdom ---
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

function findButtonByText(root: ParentNode, text: string): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find((btn) =>
    btn.textContent?.toLowerCase().includes(text.toLowerCase())
  ) as HTMLButtonElement | undefined;
}

async function selectRadixOption(trigger: Element | null | undefined, optionText: string) {
  if (!trigger) throw new Error('Expected Select trigger element');
  await pressKey(trigger, 'Enter');
  const options = Array.from(document.body.querySelectorAll('[role="option"]'));
  const target = options.find((opt) =>
    opt.textContent?.toLowerCase().includes(optionText.toLowerCase())
  );
  if (!target) {
    throw new Error(`Select option "${optionText}" not found among: ${options.map((o) => o.textContent).join(', ')}`);
  }
  await clickElement(target);
}

async function flushPromises(ms = 0) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: 'book-1',
    title: 'Clean Architecture',
    author: 'Robert C. Martin',
    isbn: '9780134494166',
    cover_url: 'https://example.com/clean-arch.jpg',
    section: 'CS Reference',
    location: 'Shelf A-2',
    category_id: 'cat-1',
    description: 'Software structure and design.',
    published_year: 2017,
    total_copies: 4,
    available_copies: 2,
    is_active: true,
    categories: { name: 'Computer Science' },
    tags: ['Architecture', 'Design', 'OOP', 'SOLID'],
    dewey_decimal: '005.1',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeCopy(overrides: Partial<BookCopyWithReservation> = {}): BookCopyWithReservation {
  return {
    id: 'copy-1111-2222',
    book_id: 'book-1',
    status: 'AVAILABLE',
    qr_string: 'QR-0001',
    accession_number: 'ACC-0001',
    created_at: '2026-01-01T00:00:00Z',
    reservation: null,
    ...overrides,
  };
}

function makeQueueEntry(overrides: Partial<ReservationQueueEntry> = {}): ReservationQueueEntry {
  return {
    id: 'res-1',
    status: 'READY',
    queue_position: 1,
    hold_expires_at: new Date(Date.now() + 26 * 3600000).toISOString(),
    created_at: '2026-11-10T00:00:00Z',
    profiles: {
      full_name: 'Maria Clara',
      student_id: '2024-0001',
      avatar_url: null,
    },
    ...overrides,
  } as ReservationQueueEntry;
}

describe('Catalog, Inventory, Library & QR UI Components', () => {
  const channelMock = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  const removeChannelMock = vi.fn();

  beforeAll(async () => {
    await import('html-to-image');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsString = '';
    mockCreateClient.mockReturnValue({
      channel: vi.fn().mockReturnValue(channelMock),
      removeChannel: removeChannelMock,
    });
    mockGetCategories.mockResolvedValue([
      { id: 'cat-1', name: 'Computer Science' },
      { id: 'cat-2', name: 'Literature' },
    ]);
    mockQRToDataURL.mockResolvedValue('data:image/png;base64,MOCK_QR');
    mockToPng.mockResolvedValue('data:image/png;base64,MOCK_CARD');
  });

  afterEach(() => {
    cleanupClients();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('CopyMeter', () => {
    it('renders available/borrowed counts and computes width percentage including zero total', async () => {
      const handle = await renderClient(<CopyMeter available={3} total={5} />);
      expect(handle.container).toHaveTextContent('Copy Availability');
      expect(handle.container).toHaveTextContent('3/5 free');
      expect(handle.container).toHaveTextContent('3 on shelf');
      expect(handle.container).toHaveTextContent('2 borrowed');
      const bar = handle.container.querySelector('.bg-emerald-500.rounded-full') as HTMLElement;
      expect(bar.style.width).toBe('60%');

      await handle.rerender(<CopyMeter available={0} total={0} />);
      expect(handle.container).toHaveTextContent('0/0 free');
      expect(handle.container).toHaveTextContent('0 on shelf');
      expect(handle.container).toHaveTextContent('0 borrowed');
      const zeroBar = handle.container.querySelector('.bg-emerald-500.rounded-full') as HTMLElement;
      expect(zeroBar.style.width).toBe('0%');
    });
  });

  describe('MetaTile', () => {
    it('renders compact, tile, and stacked variants with subvalue and empty fallback', async () => {
      const handle = await renderClient(
        <MetaTile icon={BookOpen} label="ISBN" value="978-0134494166" subvalue="13-digit" />
      );
      expect(handle.container).toHaveTextContent('ISBN');
      expect(handle.container).toHaveTextContent('978-0134494166');
      expect(handle.container).toHaveTextContent('13-digit');

      await handle.rerender(
        <MetaTile icon={BookOpen} label="Location" value="" variant="tile" subvalue="Main Building" />
      );
      expect(handle.container).toHaveTextContent('Location');
      expect(handle.container).toHaveTextContent('—');
      expect(handle.container).toHaveTextContent('Main Building');

      await handle.rerender(
        <MetaTile icon={BookOpen} label="DDC" value="005.1" variant="stacked" subvalue="Computing" />
      );
      expect(handle.container).toHaveTextContent('DDC');
      expect(handle.container).toHaveTextContent('005.1');
      expect(handle.container).toHaveTextContent('Computing');
    });
  });

  describe('StatusBanner', () => {
    const baseAvail: AvailabilityStatus = {
      nextAvailableDate: null,
      hasReservation: false,
      isReady: false,
      queuePosition: null,
      holdExpiresAt: null,
      reservationId: null,
    };

    it('renders all four availability states in full and compact variants', async () => {
      const futureIso = '2026-12-20T12:00:00Z';
      const handle = await renderClient(
        <StatusBanner
          book={{ available_copies: 0 }}
          availability={{ ...baseAvail, isReady: true, hasReservation: true, holdExpiresAt: futureIso }}
          variant="full"
        />
      );
      expect(handle.container).toHaveTextContent('Copy Ready for Pickup');
      expect(handle.container).toHaveTextContent('Claim at the desk by');

      await handle.rerender(
        <StatusBanner
          book={{ available_copies: 0 }}
          availability={{ ...baseAvail, isReady: true, hasReservation: true, holdExpiresAt: futureIso }}
          variant="compact"
        />
      );
      expect(handle.container).toHaveTextContent('Ready for Pickup');
      expect(handle.container).toHaveTextContent('Claim by');

      await handle.rerender(
        <StatusBanner
          book={{ available_copies: 0 }}
          availability={{ ...baseAvail, hasReservation: true, queuePosition: 3 }}
          variant="full"
        />
      );
      expect(handle.container).toHaveTextContent('Queue Position #3');
      expect(handle.container).toHaveTextContent('when a copy is assigned to you');

      await handle.rerender(
        <StatusBanner
          book={{ available_copies: 0 }}
          availability={{ ...baseAvail, hasReservation: true, queuePosition: 2 }}
          variant="compact"
        />
      );
      expect(handle.container).toHaveTextContent('Queue Position #2');

      await handle.rerender(
        <StatusBanner book={{ available_copies: 1 }} availability={baseAvail} variant="full" />
      );
      expect(handle.container).toHaveTextContent('1 copy on shelf');

      await handle.rerender(
        <StatusBanner book={{ available_copies: 3 }} availability={baseAvail} variant="compact" />
      );
      expect(handle.container).toHaveTextContent('3 copies on shelf');

      await handle.rerender(
        <StatusBanner
          book={{ available_copies: 0 }}
          availability={{ ...baseAvail, nextAvailableDate: futureIso }}
          variant="full"
        />
      );
      expect(handle.container).toHaveTextContent('Currently Unavailable');
      expect(handle.container).toHaveTextContent('Estimated availability');

      await handle.rerender(
        <StatusBanner book={{ available_copies: 0 }} availability={baseAvail} variant="full" />
      );
      expect(handle.container).toHaveTextContent('Join the queue to be first in line');

      await handle.rerender(
        <StatusBanner book={{ available_copies: 0 }} availability={baseAvail} variant="compact" />
      );
      expect(handle.container).toHaveTextContent('Currently Unavailable');
    });
  });

  describe('ReservationQueuePanel & formatRelativeTime', () => {
    it('formats relative time across unmounted, expired, days, hours, and under-1h states', () => {
      expect(formatRelativeTime(null, true)).toBe('...');
      expect(formatRelativeTime(new Date(Date.now() + 3600000).toISOString(), false)).toBe('...');
      expect(formatRelativeTime(new Date(Date.now() - 1000).toISOString(), true)).toBe('Expired');
      expect(formatRelativeTime(new Date(Date.now() + 50 * 3600000).toISOString(), true)).toMatch(/2d \dh remaining/);
      expect(formatRelativeTime(new Date(Date.now() + 5 * 3600000).toISOString(), true)).toMatch(/^[45]h remaining$/);
      expect(formatRelativeTime(new Date(Date.now() + 20 * 60000).toISOString(), true)).toBe('Less than 1h');
    });

    it('renders nothing when empty and renders queued and ready patrons when populated', async () => {
      const handle = await renderClient(<ReservationQueuePanel queue={[]} mounted={true} />);
      expect(handle.container.firstChild).toBeNull();

      const queue: ReservationQueueEntry[] = [
        makeQueueEntry({
          id: 'r1',
          status: 'READY',
          queue_position: 1,
          hold_expires_at: new Date(Date.now() + 26 * 3600000).toISOString(),
          profiles: { full_name: 'Maria Clara', student_id: 'S1', avatar_url: null } as unknown as ReservationQueueEntry['profiles'],
        }),
        makeQueueEntry({
          id: 'r2',
          status: 'ACTIVE',
          queue_position: 2,
          hold_expires_at: null,
          profiles: [{ full_name: 'Jose Rizal', student_id: 'S2', avatar_url: 'https://example.com/jr.png' }] as unknown as ReservationQueueEntry['profiles'],
        }),
      ];

      await handle.rerender(<ReservationQueuePanel queue={queue} mounted={true} />);
      expect(handle.container).toHaveTextContent('Queue');
      expect(handle.container).toHaveTextContent('2');
      expect(handle.container).toHaveTextContent('Maria Clara');
      expect(handle.container).toHaveTextContent('Position 1');
      expect(handle.container).toHaveTextContent('Ready');
      expect(handle.container).toHaveTextContent('Jose Rizal');
      expect(handle.container).toHaveTextContent('Position 2');
      expect(handle.container).toHaveTextContent('Waiting');
    });
  });

  describe('QRPrinterModal', () => {
    it('opens dialog, generates QR code via qrcode.toDataURL, and invokes print + reload', async () => {
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
          <QRPrinterModal qrString="QR-COPY-99" bookTitle="Refactoring" />
        );

        await clickElement(findButtonByText(container, 'Print QR'));
        await flushPromises();

        expect(mockQRToDataURL).toHaveBeenCalledWith('QR-COPY-99', { width: 128, margin: 1 });
        expect(document.body).toHaveTextContent('Print QR Label');
        expect(document.body).toHaveTextContent('Refactoring');
        expect(document.body).toHaveTextContent('QR-COPY-99');
        const img = document.body.querySelector('img[alt="QR Code for Refactoring"]') as HTMLImageElement;
        expect(img).toHaveAttribute('src', 'data:image/png;base64,MOCK_QR');

        await clickElement(findButtonByText(document.body, 'Print Label'));
        expect(printSpy).toHaveBeenCalledTimes(1);
        expect(reloadSpy).toHaveBeenCalledTimes(1);
      } finally {
        const origRemoveChild = document.body.removeChild.bind(document.body);
        vi.spyOn(document.body, 'removeChild').mockImplementation(<T extends Node>(child: T): T => {
          return child.parentNode === document.body ? origRemoveChild(child) : child;
        });
        cleanupClients();
        document.body.innerHTML = '';
        Object.defineProperty(window, 'location', {
          configurable: true,
          value: originalLocation,
        });
      }
    });

    it('closes modal when Cancel is clicked', async () => {
      const { container } = await renderClient(
        <QRPrinterModal qrString="QR-COPY-11" bookTitle="Clean Code" />
      );
      await clickElement(findButtonByText(container, 'Print QR'));
      await flushPromises();
      expect(document.body.querySelector('[role="dialog"]')).toBeInTheDocument();

      await clickElement(findButtonByText(document.body, 'Cancel'));
      await flushPromises();
      expect(document.body.querySelector('[role="dialog"]')).not.toBeInTheDocument();
    });
  });

  describe('Catalog Add Components (ISBNLookupBar, CoverUploader, BookDetailsForm)', () => {
    it('ISBNLookupBar sanitizes ISBN input, manages disabled/loading state, and triggers onFetchData', async () => {
      const onIsbnChange = vi.fn();
      const onFetchData = vi.fn();

      const handle = await renderClient(
        <ISBNLookupBar
          isbn=""
          onIsbnChange={onIsbnChange}
          onFetchData={onFetchData}
          isbnLoading={false}
        />
      );

      const input = handle.container.querySelector('input') as HTMLInputElement;
      const fetchBtn = findButtonByText(handle.container, 'Fetch Data')!;
      expect(fetchBtn).toBeDisabled();

      await typeIntoInput(input, '978-013-235088x');
      expect(onIsbnChange).toHaveBeenCalledWith('978013235088X');

      await handle.rerender(
        <ISBNLookupBar
          isbn="978013235088X"
          onIsbnChange={onIsbnChange}
          onFetchData={onFetchData}
          isbnLoading={false}
        />
      );
      const enabledBtn = findButtonByText(handle.container, 'Fetch Data')!;
      expect(enabledBtn).not.toBeDisabled();
      await clickElement(enabledBtn);
      expect(onFetchData).toHaveBeenCalledTimes(1);

      await handle.rerender(
        <ISBNLookupBar
          isbn="978013235088X"
          onIsbnChange={onIsbnChange}
          onFetchData={onFetchData}
          isbnLoading={true}
        />
      );
      const loadingBtn = findButtonByText(handle.container, 'Searching...')!;
      expect(loadingBtn).toBeDisabled();
    });

    it('CoverUploader displays preview URLs and invokes onCoverSelected when file is chosen', async () => {
      const onCoverSelected = vi.fn();
      const handle = await renderClient(
        <CoverUploader coverPreviewUrl={null} coverUrl="" onCoverSelected={onCoverSelected} />
      );

      let img = handle.container.querySelector('img[alt="Preview"]') as HTMLImageElement;
      expect(img).toHaveAttribute('src', '/images/default-book-cover.png');
      expect(handle.container).toHaveTextContent('Upload Image');

      await handle.rerender(
        <CoverUploader
          coverPreviewUrl="blob:preview-1"
          coverUrl="https://example.com/old.jpg"
          onCoverSelected={onCoverSelected}
        />
      );
      img = handle.container.querySelector('img[alt="Preview"]') as HTMLImageElement;
      expect(img).toHaveAttribute('src', 'blob:preview-1');
      expect(handle.container).toHaveTextContent('Change Image');

      const fileInput = handle.container.querySelector('#file-upload') as HTMLInputElement;
      const file = new File(['img-bytes'], 'cover.png', { type: 'image/png' });
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(onCoverSelected).toHaveBeenCalledWith(file);
    });

    it('BookDetailsForm updates all fields, sanitizes ISBN, and selects category', async () => {
      const updates: Array<Record<string, unknown>> = [];
      function FormHarness() {
        const [formData, setFormData] = React.useState({
          title: '',
          author: '',
          categoryId: '',
          section: '',
          location: '',
          copies: 1,
          tags: '',
          dewey_decimal: '',
          isbn: '',
        });
        return (
          <BookDetailsForm
            formData={formData}
            categories={[
              { id: 'cat-1', name: 'Computer Science' },
              { id: 'cat-2', name: 'Mathematics' },
            ]}
            onUpdate={(u) => {
              updates.push(u);
              setFormData((prev) => ({ ...prev, ...u }));
            }}
          />
        );
      }

      const { container } = await renderClient(<FormHarness />);

      const titleInput = container.querySelector('input[placeholder="e.g. Clean Code"]') as HTMLInputElement;
      const authorInput = container.querySelector('input[placeholder="e.g. Robert C. Martin"]') as HTMLInputElement;
      const ddcInput = container.querySelector('input[placeholder="e.g. 621.389"]') as HTMLInputElement;
      const isbnInput = container.querySelector('input[placeholder="9780132350884"]') as HTMLInputElement;
      const tagsInput = container.querySelector('input[placeholder="Programming, Best Practices, Engineering"]') as HTMLInputElement;
      const sectionInput = container.querySelector('input[placeholder="e.g. CS Reference"]') as HTMLInputElement;
      const locationInput = container.querySelector('input[placeholder="e.g. Shelf A-5"]') as HTMLInputElement;
      const copiesInput = container.querySelector('input[type="number"]') as HTMLInputElement;

      await typeIntoInput(titleInput, 'Domain-Driven Design');
      await typeIntoInput(authorInput, 'Eric Evans');
      await typeIntoInput(ddcInput, '005.12');
      await typeIntoInput(isbnInput, '978-0321125215x');
      await typeIntoInput(tagsInput, 'DDD, Architecture');
      await typeIntoInput(sectionInput, 'Engineering');
      await typeIntoInput(locationInput, 'Row 4');
      await typeIntoInput(copiesInput, '5');

      const categoryTrigger = container.querySelector('[role="combobox"]');
      await selectRadixOption(categoryTrigger, 'Mathematics');

      expect(updates).toContainEqual({ title: 'Domain-Driven Design' });
      expect(updates).toContainEqual({ author: 'Eric Evans' });
      expect(updates).toContainEqual({ dewey_decimal: '005.12' });
      expect(updates).toContainEqual({ isbn: '9780321125215X' });
      expect(updates).toContainEqual({ tags: 'DDD, Architecture' });
      expect(updates).toContainEqual({ section: 'Engineering' });
      expect(updates).toContainEqual({ location: 'Row 4' });
      expect(updates).toContainEqual({ copies: 5 });
      expect(updates).toContainEqual({ categoryId: 'cat-2' });
    });
  });

  describe('AdminManagementContent', () => {
    it('fetches copies and queue when initialCopies omitted, paginates, filters status, and renders reserved patron', async () => {
      const book = makeBook({ total_copies: 4, available_copies: 2 });
      const copies: BookCopyWithReservation[] = [
        makeCopy({ id: 'c-1', qr_string: 'QR-001', accession_number: 'ACC-001', status: 'AVAILABLE' }),
        makeCopy({
          id: 'c-2',
          qr_string: 'QR-002',
          accession_number: 'ACC-002',
          status: 'RESERVED',
          reservation: {
            id: 'r-1',
            status: 'READY',
            queue_position: 1,
            hold_expires_at: new Date(Date.now() + 25 * 3600000).toISOString(),
            profiles: { id: 'u-1', full_name: 'Noli Student', email: 'n@sti.edu', student_id: '2024-1' },
          },
        }),
        makeCopy({ id: 'c-3', qr_string: 'QR-003', accession_number: 'ACC-003', status: 'BORROWED' }),
        makeCopy({ id: 'c-4', qr_string: 'QR-004', accession_number: 'ACC-004', status: 'MAINTENANCE' }),
      ];
      const queue = [makeQueueEntry()];

      mockGetBookAdminDetails.mockResolvedValue({ book, copies, queue });

      const { container } = await renderClient(
        <AdminManagementContent initialBook={book} onClose={vi.fn()} />
      );
      await flushPromises();

      expect(mockGetBookAdminDetails).toHaveBeenCalledWith('book-1');
      expect(mockGetCategories).toHaveBeenCalled();
      expect(container).toHaveTextContent('QR-001');
      expect(container).toHaveTextContent('Reserved by Noli Student');
      expect(container).toHaveTextContent('QR-003');
      expect(container).not.toHaveTextContent('QR-004'); // Page 2

      // Paginate to page 2
      const nextBtn = container.querySelector('button[aria-label="Next page"]') as HTMLButtonElement;
      await clickElement(nextBtn);
      expect(container).toHaveTextContent('QR-004');

      // Filter copies by LOST -> empty state
      const comboboxes = Array.from(container.querySelectorAll('[role="combobox"]'));
      const filterTrigger = comboboxes[0]; // Only ALL status filter since copy-4 is MAINTENANCE (editable)
      await selectRadixOption(filterTrigger, 'Lost');
      expect(container).toHaveTextContent('No matching assets found');
    });

    it('validates published year, saves metadata edits, adds copies, changes copy status, and archives/restores', async () => {
      const book = makeBook({ is_active: true });
      const copies = [makeCopy({ id: 'c-1', status: 'AVAILABLE', qr_string: 'QR-101' })];
      const onClose = vi.fn();

      mockGetBookAdminDetails.mockResolvedValue({ book, copies, queue: [] });
      mockUpdateBook.mockResolvedValue({ success: true });
      mockAddBookCopies.mockResolvedValue({ success: true });
      mockUpdateBookCopyStatus.mockResolvedValue({ success: true });
      mockSoftDeleteBook.mockResolvedValue({ success: true });
      mockRestoreBook.mockResolvedValue({ success: true });

      const handle = await renderClient(
        <AdminManagementContent
          initialBook={book}
          initialCopies={copies}
          initialQueue={[]}
          onClose={onClose}
        />
      );
      await flushPromises();

      // Open Edit Form
      const editBtn = Array.from(handle.container.querySelectorAll('button')).find((b) =>
        b.className.includes('rounded-full')
      );
      await clickElement(editBtn);
      expect(handle.container).toHaveTextContent('Edit Library Asset Metadata');

      // Invalid year triggers toast error
      const yearInput = handle.container.querySelector('input[type="number"]') as HTMLInputElement;
      await typeIntoInput(yearInput, '999');
      await clickElement(findButtonByText(handle.container, 'Save Changes'));
      expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Published year must be between'));
      expect(mockUpdateBook).not.toHaveBeenCalled();

      // Fix year and title, then save
      await typeIntoInput(yearInput, '2020');
      const titleInput = handle.container.querySelector('input[value="Clean Architecture"]') as HTMLInputElement;
      await typeIntoInput(titleInput, 'Clean Architecture 2nd Ed');
      await clickElement(findButtonByText(handle.container, 'Save Changes'));
      await flushPromises();

      expect(mockUpdateBook).toHaveBeenCalledWith({
        id: 'book-1',
        bookData: expect.objectContaining({
          title: 'Clean Architecture 2nd Ed',
          published_year: 2020,
        }),
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Book metadata updated');

      // Add copies
      await clickElement(findButtonByText(handle.container, 'Add Copies'));
      const addCopiesInput = handle.container.querySelector('input[type="number"]') as HTMLInputElement;
      await typeIntoInput(addCopiesInput, '2');
      await clickElement(findButtonByText(handle.container, 'Confirm'));
      await flushPromises();
      expect(mockAddBookCopies).toHaveBeenCalledWith({ bookId: 'book-1', copiesCount: 2 });
      expect(mockToastSuccess).toHaveBeenCalledWith('Successfully added 2 copies');

      // Update copy status via Select
      const copyTrigger = Array.from(handle.container.querySelectorAll('[role="combobox"]'))[1];
      await selectRadixOption(copyTrigger, 'Maintenance');
      await flushPromises();
      expect(mockUpdateBookCopyStatus).toHaveBeenCalledWith({ id: 'c-1', status: 'MAINTENANCE' });
      expect(mockToastSuccess).toHaveBeenCalledWith('Status updated');

      // Archive flow
      await clickElement(Array.from(handle.container.querySelectorAll('button')).find((b) => b.className.includes('rounded-full')));
      await clickElement(findButtonByText(handle.container, 'Archive Asset'));
      expect(handle.container).toHaveTextContent('Archive this asset?');
      await clickElement(findButtonByText(handle.container, 'Confirm'));
      await flushPromises();
      expect(mockSoftDeleteBook).toHaveBeenCalledWith('book-1');
      expect(onClose).toHaveBeenCalledTimes(1);

      // Restore flow for archived book
      const archivedBook = makeBook({ is_active: false });
      await handle.rerender(
        <AdminManagementContent
          initialBook={archivedBook}
          initialCopies={copies}
          initialQueue={[]}
          onClose={onClose}
          canManage={true}
        />
      );
      await clickElement(findButtonByText(handle.container, 'Cancel'));
      expect(handle.container).toHaveTextContent('Archived');
      await clickElement(Array.from(handle.container.querySelectorAll('button')).find((b) => b.className.includes('rounded-full')));
      await clickElement(findButtonByText(handle.container, 'Restore Asset'));
      await flushPromises();
      expect(mockRestoreBook).toHaveBeenCalledWith('book-1');
      expect(mockToastSuccess).toHaveBeenCalledWith('Book restored');
    });

    it('hides management controls when canManage is false', async () => {
      const book = makeBook();
      const copies = [makeCopy()];
      const { container } = await renderClient(
        <AdminManagementContent
          initialBook={book}
          initialCopies={copies}
          initialQueue={[]}
          onClose={vi.fn()}
          canManage={false}
        />
      );
      await flushPromises();

      expect(findButtonByText(container, 'Add Copies')).toBeUndefined();
      // Only the copyFilter combobox is rendered; copy status renders as static Badge
      expect(container.querySelectorAll('[role="combobox"]')).toHaveLength(1);
    });
  });

  describe('BookDetailModal', () => {
    it('fetches student details, displays tags overflow & metadata, and cancels reservation via dialog', async () => {
      const bookDetail: BookDetail = {
        id: 'book-1',
        title: 'Clean Architecture',
        author: 'Robert C. Martin',
        isbn: '9780134494166',
        cover_url: null,
        section: 'CS',
        location: 'Floor 2',
        available_copies: 0,
        total_copies: 2,
        categories: { name: 'Software' },
        tags: ['Arch', 'Design', 'SOLID', 'Patterns'],
        dewey_decimal: '005.1',
      };
      const availability: AvailabilityStatus = {
        nextAvailableDate: null,
        hasReservation: true,
        isReady: true,
        queuePosition: 1,
        holdExpiresAt: '2026-12-25T00:00:00Z',
        reservationId: 'res-99',
      };

      mockGetBookPublicDetails.mockResolvedValue({ book: bookDetail, availability });
      mockCancelReservation.mockResolvedValue({ success: true });

      const onOpenChange = vi.fn();
      const onCancelSuccess = vi.fn();

      const handle = await renderClient(
        <BookDetailModal
          bookId="book-1"
          open={true}
          onOpenChange={onOpenChange}
          variant="student"
          onCancelSuccess={onCancelSuccess}
        />
      );
      await flushPromises();

      expect(mockGetBookPublicDetails).toHaveBeenCalledWith('book-1');
      expect(document.body).toHaveTextContent('Clean Architecture');
      expect(document.body).toHaveTextContent('+1');
      expect(document.body).toHaveTextContent('✦ Ready');

      // Cancel reservation flow
      const cancelBtn = findButtonByText(document.body, 'Cancel')!;
      await clickElement(cancelBtn);
      expect(document.body).toHaveTextContent('Cancel Reservation?');

      await clickElement(findButtonByText(document.body, 'Yes, Cancel'));
      await flushPromises();

      expect(mockCancelReservation).toHaveBeenCalledWith('res-99');
      expect(mockToastSuccess).toHaveBeenCalledWith('Reservation cancelled');
      expect(onCancelSuccess).toHaveBeenCalledTimes(1);
      expect(mockRouterRefresh).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);

      handle.unmount();
      expect(removeChannelMock).toHaveBeenCalledWith(channelMock);
    });

    it('toasts error when student book is not found and renders admin variant cleanly', async () => {
      mockGetBookPublicDetails.mockResolvedValue({ book: null, availability: {} });
      const handle = await renderClient(
        <BookDetailModal
          bookId="missing-book"
          open={true}
          onOpenChange={vi.fn()}
          variant="student"
        />
      );
      await flushPromises();
      expect(mockToastError).toHaveBeenCalledWith('Book not found');

      const adminBook = makeBook();
      mockGetBookAdminDetails.mockResolvedValue({
        book: adminBook,
        copies: [makeCopy()],
        queue: [],
      });
      await handle.rerender(
        <BookDetailModal
          bookId="book-1"
          open={true}
          onOpenChange={vi.fn()}
          variant="super_admin"
        />
      );
      await flushPromises();
      expect(mockGetBookAdminDetails).toHaveBeenCalledWith('book-1');
      expect(document.body).toHaveTextContent('Inventory Assets');
    });
  });

  describe('ModernBookCard, StudentBookCard & InventoryGrid', () => {
    it('ModernBookCard displays stock/archived/out-of-stock states, image fallback, and opens modal on click/Enter', async () => {
      const book = makeBook({ available_copies: 0, total_copies: 3 });
      mockGetBookAdminDetails.mockResolvedValue({ book, copies: [], queue: [] });

      const handle = await renderClient(
        <AnimationProvider>
          <ModernBookCard book={book} />
        </AnimationProvider>
      );

      expect(handle.container).toHaveTextContent('Clean Architecture');
      expect(handle.container).toHaveTextContent('by Robert C. Martin');
      expect(handle.container).toHaveTextContent('OUT');
      expect(handle.container).toHaveTextContent('0 / 3 In Pool');

      // Image error fallback
      const img = handle.container.querySelector('img') as HTMLImageElement;
      await act(async () => {
        img.dispatchEvent(new Event('error'));
      });
      expect(img.getAttribute('src')).toBe('/images/default-book-cover.png');

      // Keyboard Enter opens modal
      const cardTrigger = handle.container.querySelector('[role="button"]')!;
      await pressKey(cardTrigger, 'Enter');
      await flushPromises();
      expect(document.body.querySelector('[role="dialog"]')).toBeInTheDocument();

      // Archived book renders Archived badge
      await handle.rerender(
        <AnimationProvider>
          <ModernBookCard book={makeBook({ is_active: false })} />
        </AnimationProvider>
      );
      expect(handle.container).toHaveTextContent('Archived');
    });

    it('StudentBookCard renders reservation badge and opens student BookDetailModal on title click', async () => {
      const book = makeBook({ available_copies: 1, total_copies: 2 });
      mockGetBookPublicDetails.mockResolvedValue({
        book,
        availability: {
          nextAvailableDate: null,
          hasReservation: true,
          isReady: true,
          queuePosition: 1,
          holdExpiresAt: '2026-12-20T00:00:00Z',
          reservationId: 'r-1',
        },
      });

      const { container } = await renderClient(
        <AnimationProvider>
          <StudentBookCard
            book={book}
            reservedInfo={{ status: 'READY', queuePosition: 1, holdExpiresAt: '2026-12-20T00:00:00Z' }}
          />
        </AnimationProvider>
      );

      expect(container).toHaveTextContent('Ready');
      expect(container).toHaveTextContent('1 available / 2 total copies');

      const titleBtn = container.querySelector('button[aria-label="View details for Clean Architecture"]');
      await clickElement(titleBtn);
      await flushPromises();
      expect(document.body.querySelector('[role="dialog"]')).toBeInTheDocument();
      expect(mockGetBookPublicDetails).toHaveBeenCalledWith('book-1');
    });

    it('InventoryGrid handles empty state (canManage true/false) and student vs admin grid rendering', async () => {
      const handle = await renderClient(
        <AnimationProvider>
          <InventoryGrid books={[]} canManage={true} />
        </AnimationProvider>
      );
      expect(handle.container).toHaveTextContent('Vault is Empty');
      expect(handle.container.querySelector('a[href="/inventory/add"]')).toBeInTheDocument();

      await handle.rerender(
        <AnimationProvider>
          <InventoryGrid books={[]} canManage={false} />
        </AnimationProvider>
      );
      expect(handle.container.querySelector('a[href="/inventory/add"]')).not.toBeInTheDocument();

      const books = [
        makeBook({ id: 'b-1', title: 'Book One', available_copies: 2, total_copies: 2 }),
        makeBook({ id: 'b-2', title: 'Book Two', available_copies: 0, total_copies: 1 }),
      ];
      const reservations: Reservation[] = [
        {
          id: 'res-2',
          status: 'ACTIVE',
          queue_position: 4,
          hold_expires_at: null,
          books: { id: 'b-2', title: 'Book Two', cover_url: null },
        },
      ];

      await handle.rerender(
        <AnimationProvider>
          <InventoryGrid books={books} isStudentView={true} reservations={reservations} />
        </AnimationProvider>
      );
      expect(handle.container).toHaveTextContent('Book One');
      expect(handle.container).toHaveTextContent('Book Two');
      expect(handle.container).toHaveTextContent('#4');
    });
  });

  describe('ModernInventoryClient', () => {
    const categories: Category[] = [
      { id: 'cat-1', name: 'Computer Science' },
      { id: 'cat-2', name: 'History' },
    ];

    function renderInventory(props: Partial<React.ComponentProps<typeof ModernInventoryClient>> = {}) {
      return renderClient(
        <AnimationProvider>
          <BatchTaskProvider>
            <ModernInventoryClient
              books={[makeBook()]}
              totalItems={24}
              categories={categories}
              canManage={true}
              {...props}
            />
          </BatchTaskProvider>
        </AnimationProvider>
      );
    }

    it('handles search submit, clear search, filter sheet toggles, reset all, and pagination', async () => {
      const { container } = await renderInventory();

      const searchInput = container.querySelector('input[aria-label="Search inventory"]') as HTMLInputElement;
      await typeIntoInput(searchInput, 'refactoring');
      await submitForm(searchInput.closest('form'));
      expect(mockRouterReplace).toHaveBeenCalledWith('?q=refactoring', { scroll: false });

      await clickElement(container.querySelector('button[aria-label="Clear search"]'));
      expect(searchInput.value).toBe('');

      // Open Filters Sheet
      await clickElement(container.querySelector('button[aria-label="Filters"]'));
      expect(document.body).toHaveTextContent('Availability Status');

      await clickElement(findButtonByText(document.body, 'Archived'));
      expect(mockRouterReplace).toHaveBeenCalledWith(expect.stringContaining('status=ARCHIVED'), { scroll: false });

      await clickElement(findButtonByText(document.body, 'History'));
      expect(mockRouterReplace).toHaveBeenCalledWith(expect.stringContaining('categoryId=cat-2'), { scroll: false });

      await clickElement(findButtonByText(document.body, 'Reset All'));
      expect(mockRouterReplace).toHaveBeenLastCalledWith('?', { scroll: false });

      await clickElement(findButtonByText(document.body, 'Apply Filters'));
      await flushPromises();

      // Pagination
      await clickElement(container.querySelector('button[aria-label="Next page"]'));
      expect(mockRouterReplace).toHaveBeenCalledWith('?page=2', { scroll: false });
    });

    it('executes Batch Operations tabs: JSON Import, ISBN Fallback, and Export (Excel/CSV/JSON/ZIP)', async () => {
      const createObjectURLSpy = vi.fn(() => 'blob:mock-export');
      vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectURLSpy });
      const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      mockBatchImportBooks.mockResolvedValue({
        success: true,
        imported: 1,
        copiesAdded: 2,
        duplicates: 0,
        logs: ['Imported Clean Code'],
      });
      mockLookupAndImportISBN.mockResolvedValue({
        success: true,
        status: 'created',
        title: 'The Pragmatic Programmer',
        author: 'Andy Hunt',
      });
      mockGetBooksForExport.mockResolvedValue([
        {
          id: 'b-1',
          title: 'Clean Code',
          author: 'Robert Martin',
          isbn: '9780132350884',
          dewey_decimal: '005.1',
          description: 'Craftsmanship',
          published_year: 2008,
          cover_url: null,
          tags: ['Code'],
          location: 'Shelf A',
          section: 'CS',
          is_active: true,
          created_at: '2026-01-01T00:00:00Z',
          categories: { name: 'CS' },
        },
      ]);

      const { container } = await renderInventory();
      await clickElement(container.querySelector('button[aria-label="Batch operations"]'));
      expect(document.body).toHaveTextContent('Batch Catalog Operations');

      // Tab 1: Import JSON file
      const fileInput = document.body.querySelector('input[aria-label="Choose JSON, CSV or Excel file"]') as HTMLInputElement;
      const jsonContent = JSON.stringify([
        { title: 'Clean Code', author: 'Robert C. Martin', isbn: '9780132350884', copies: 2 },
      ]);
      const jsonFile = new File([jsonContent], 'books.json', { type: 'application/json' });
      await act(async () => {
        Object.defineProperty(fileInput, 'files', { value: [jsonFile], configurable: true });
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await flushPromises(50);

      expect(document.body).toHaveTextContent('Dry-Run Preview Summary');
      expect(document.body).toHaveTextContent('1 Books Detected');

      await clickElement(findButtonByText(document.body, 'Commit & Import to Catalog'));
      await flushPromises();
      expect(mockBatchImportBooks).toHaveBeenCalledWith(
        [expect.objectContaining({ title: 'Clean Code', author: 'Robert C. Martin', stock: 2 })],
        { addCopiesToDuplicates: false }
      );
      expect(document.body).toHaveTextContent('Spreadsheet Import Successful!');

      // Tab 2: ISBN Fallback
      await clickElement(findButtonByText(document.body, 'ISBN Fallback'));
      const isbnTextarea = document.body.querySelector('#inventory-isbns') as HTMLTextAreaElement;
      await typeIntoInput(isbnTextarea, '978-0135957059');
      await clickElement(findButtonByText(document.body, 'Start Sequential Auto-Lookup'));
      await flushPromises();
      expect(mockLookupAndImportISBN).toHaveBeenCalledWith('9780135957059');
      expect(document.body).toHaveTextContent('Real-time Terminal Logs');

      // Tab 3: Export Data
      await clickElement(findButtonByText(document.body, 'Export Data'));
      await clickElement(findButtonByText(document.body, 'Clear'));
      expect(findButtonByText(document.body, 'Spreadsheet')).toBeDisabled();
      await clickElement(findButtonByText(document.body, 'Select All'));
      expect(findButtonByText(document.body, 'Spreadsheet')).not.toBeDisabled();

      await clickElement(findButtonByText(document.body, 'Spreadsheet'));
      await flushPromises();
      expect(mockXlsxWriteFile).toHaveBeenCalledWith(expect.anything(), 'lumina_catalog_export.xlsx');

      await clickElement(findButtonByText(document.body, 'Text CSV'));
      await flushPromises();
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(anchorClickSpy).toHaveBeenCalled();

      await clickElement(findButtonByText(document.body, 'JSON Data'));
      await flushPromises();
      expect(mockToastSuccess).toHaveBeenCalledWith('Catalog exported to JSON successfully!');
    });

    it('hides admin actions when canManage is false', async () => {
      const { container } = await renderInventory({ canManage: false });
      expect(container.querySelector('button[aria-label="Batch operations"]')).not.toBeInTheDocument();
      expect(container.querySelector('a[href="/inventory/add"]')).not.toBeInTheDocument();
    });
  });

  describe('MyCardContainer', () => {
    const baseData = {
      fullName: 'Juan Dela Cruz',
      studentId: '2024-0099',
      cardNumber: 'LIB-2024-0099',
      department: 'BS Computer Science',
      status: 'active' as const,
      expiryDate: '2027-06-30',
      avatarUrl: null,
      qrUrl: 'https://example.com/qr.png',
      address: 'Alabang, Muntinlupa',
      phone: '09171234567',
      academicYear: '2026 - 2027',
    };

    it('hydrates assets status, retries on error, flips front/back, and opens QR dialog', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            qr_url: 'https://example.com/hydrated-qr.png',
            profile_url: 'https://example.com/avatar.png',
            qr_exists: true,
            profile_exists: true,
            ready: true,
          }),
        });
      vi.stubGlobal('fetch', fetchMock);

      const { container } = await renderClient(
        <AnimationProvider>
          <MyCardContainer initialData={{ ...baseData, qrUrl: null }} variant="page" />
        </AnimationProvider>
      );
      await flushPromises();

      // Error banner shown with Retry
      const alert = container.querySelector('[role="alert"]');
      expect(alert).toHaveTextContent("Couldn't load your card QR.");
      await clickElement(findButtonByText(container, 'Retry'));
      await flushPromises();
      expect(container.querySelector('[role="alert"]')).toBeNull();

      // Flip front / back
      const frontContainer = container.querySelector('#library-card-front')!;
      const backContainer = container.querySelector('#library-card-back')!;
      expect(frontContainer.className).toContain('block');
      expect(backContainer.className).toContain('hidden');

      await clickElement(findButtonByText(container, 'Show back'));
      expect(frontContainer.className).toContain('hidden');
      expect(backContainer.className).toContain('block');
      expect(findButtonByText(container, 'Show front')).toBeDefined();

      await clickElement(findButtonByText(container, 'Show front'));

      // Expand QR dialog
      await clickElement(container.querySelector('button[aria-label="Expand QR code"]'));
      expect(document.body.querySelector('[role="dialog"]')).toBeInTheDocument();
      expect(document.body).toHaveTextContent('Library Card QR');
      expect(document.body).toHaveTextContent('LIB-2024-0099');
    });

    it('renders dashboard variant and exports composite and wallet preset PNGs', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          qr_url: 'https://example.com/qr.png',
          profile_url: '',
          qr_exists: true,
          profile_exists: false,
          ready: true,
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      // Stub Image loading & Canvas 2D context for export tests
      class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        private _src = '';
        set src(val: string) {
          this._src = val;
          queueMicrotask(() => this.onload?.());
        }
        get src() {
          return this._src;
        }
      }
      vi.stubGlobal('Image', MockImage);

      const mockCtx = {
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      };
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        mockCtx as unknown as CanvasRenderingContext2D
      );
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,EXPORTED');
      const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      const handle = await renderClient(
        <AnimationProvider>
          <MyCardContainer initialData={baseData} variant="dashboard" />
        </AnimationProvider>
      );
      await flushPromises();

      expect(handle.container).toHaveTextContent('Official Library ID');
      await clickElement(findButtonByText(handle.container, 'Export'));
      await flushPromises(50);
      expect(mockToPng).toHaveBeenCalledTimes(2);
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);

      // Page variant Wallet preset export
      await handle.rerender(
        <AnimationProvider>
          <MyCardContainer initialData={baseData} variant="page" />
        </AnimationProvider>
      );
      await flushPromises();
      await clickElement(findButtonByText(handle.container, 'Wallet preset'));
      await flushPromises(20);
      expect(mockToPng).toHaveBeenCalledTimes(3);
      expect(anchorClickSpy).toHaveBeenCalledTimes(2);
    });
  });
});
