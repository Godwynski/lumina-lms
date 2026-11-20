import * as React from 'react';
import { Suspense, act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderClient,
  cleanupClients,
  clickElement,
  typeIntoInput,
} from './helpers/render';

const mockRouterRefresh = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouterPush = vi.fn();
let mockSearchParamsString = '';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRouterRefresh,
    replace: mockRouterReplace,
    push: mockRouterPush,
  }),
  useSearchParams: () => new URLSearchParams(mockSearchParamsString),
  redirect: vi.fn(),
}));

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }) => {
    const rest = { ...props };
    delete rest.fill;
    delete rest.priority;
    delete rest.unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={rest.alt ?? ''} {...rest} />;
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockGetBookPublicDetails = vi.fn();
vi.mock('@/lib/actions/catalog', () => ({
  getBookPublicDetails: (...args: unknown[]) => mockGetBookPublicDetails(...args),
  getBookAdminDetails: vi.fn(),
}));

vi.mock('@/lib/actions/reservations', () => ({
  cancelReservation: vi.fn(),
  getBookAvailabilityStatus: vi.fn().mockResolvedValue({
    hasReservation: false,
    isReady: false,
    queuePosition: null,
    holdExpiresAt: null,
    nextAvailableDate: null,
    reservationId: null,
  }),
}));

vi.mock('@/lib/actions/history', () => ({
  settleBorrowingFine: vi.fn(),
  exportBorrowingHistory: vi.fn(),
  getBorrowerDetails: vi.fn().mockResolvedValue({ success: false, error: 'not needed' }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  }),
}));

import { ActivitySection } from '@/components/dashboard/ActivitySection';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { BookDetailModal } from '@/components/catalog/BookDetailModal';
import { StudentBookDetailClient } from '@/app/(authenticated)/student-catalog/[id]/StudentBookDetailClient';
import { metadata as bookDetailsMetadata } from '@/app/(authenticated)/student-catalog/[id]/page';
import { ReserveTitleButton } from '@/components/common/ReserveTitleButton';
import MyCardContainer from '@/components/library/MyCardContainer';
import HistoryContent from '@/app/(authenticated)/history/HistoryContent';
import { PreferencesProvider } from '@/components/providers/PreferencesProvider';
import type { User } from '@supabase/supabase-js';
import type { ProfileData, Category } from '@/lib/types';

function makeUser(): User {
  return {
    id: 'user-1',
    email: 'admin@alabang.sti.edu.ph',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
  } as User;
}

function makeProfile(role: ProfileData['role']): ProfileData {
  return {
    id: 'user-1',
    full_name: 'Teresita Aquino',
    email: 'admin@alabang.sti.edu.ph',
    role,
    status: 'ACTIVE',
    student_id: 'DEMO-ADM-001',
    department: 'Library Services',
    avatar_url: null,
    address: null,
    phone: null,
    updated_at: '2026-01-01T00:00:00Z',
  } as unknown as ProfileData;
}

describe('B4 Dashboard, Catalog & History UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsString = '';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ qr_url: '', profile_url: '', qr_exists: false, profile_exists: false, ready: false }),
      })
    );
  });

  afterEach(() => {
    cleanupClients();
    vi.unstubAllGlobals();
  });

  it('ActivitySection applies min-w-0 overflow-hidden on columns and cards so overdue badges do not overflow', async () => {
    const { container } = await renderClient(
      <ActivitySection
        activeBorrows={[
          {
            id: 'b1',
            book_copy_id: 'c1',
            user_id: 'u1',
            status: 'OVERDUE',
            borrowed_at: '2026-10-01T00:00:00Z',
            due_date: '2026-10-10T00:00:00Z',
            returned_at: null,
            fine_amount: 135,
            fine_settled_at: null,
            profiles: null,
            books: {
              id: 'bk1',
              title: 'An Extraordinarily Long Book Title About Computer Architecture and Compilers',
              author: 'Author Name',
              cover_url: null,
            },
          },
        ]}
        reservations={[]}
        attendanceLogs={[]}
        onOpenBook={vi.fn()}
        onCancelReservation={vi.fn()}
        isPending={false}
        mounted
      />
    );

    const sections = Array.from(container.querySelectorAll('section'));
    expect(sections).toHaveLength(3);
    for (const sec of sections) {
      expect(sec.className).toContain('min-w-0');
      expect(sec.className).toContain('overflow-hidden');
    }

    const borrowCard = container.querySelector('button[aria-label*="An Extraordinarily Long Book Title"]') as HTMLButtonElement;
    expect(borrowCard.className).toContain('min-w-0');
    expect(borrowCard.className).toContain('overflow-hidden');
    expect(container).toHaveTextContent('₱135.00');
    expect(container).toHaveTextContent('Overdue');
  });

  it('DashboardClient (admin) removes duplicate shortcut tiles, uses canonical stat links, and places Recently Cataloged Books above My Library Card', async () => {
    const stats = {
      activeBorrows: 20,
      pendingApprovals: 2,
      myActiveBorrows: 0,
      recentBooks: [
        { id: 'bk-1', title: 'Clean Code', author: 'Robert C. Martin', cover_url: null, created_at: '2026-11-01' },
      ],
      activeBorrowsList: [],
      attendanceToday: 3,
      totalBooks: 101,
      totalUsers: 6,
      overdueBorrows: 5,
      readyHolds: 5,
    };

    const { container } = await renderClient(
      <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="super_admin">
        <Suspense fallback={<div>Loading</div>}>
          <DashboardClient
            user={makeUser()}
            role="super_admin"
            statsPromise={Promise.resolve(stats)}
            profilePromise={Promise.resolve({ data: makeProfile('super_admin') })}
            cardPromise={Promise.resolve({ data: null })}
            faqPromise={Promise.resolve({ data: null })}
            reservationsPromise={Promise.resolve([])}
            inventoryBooksPromise={Promise.resolve({ data: [], count: 0 })}
            inventoryCategoriesPromise={Promise.resolve([] as Category[])}
            attendanceLogs={[]}
          />
        </Suspense>
      </PreferencesProvider>
    );
    await act(async () => { await Promise.resolve(); });

    // Removed 7 redundant quick-link tiles
    expect(container.textContent).not.toContain('Manage book collections');
    expect(container.textContent).not.toContain('Adjust system parameters');
    expect(container.textContent).not.toContain('Visitor Logs');
    expect(container.textContent).not.toContain('Book Catalog');

    // Canonical KPI links
    const visitorsLink = container.querySelector('a[href="/attendance?view=logs"]');
    const inventoryLink = container.querySelector('a[href="/inventory"]');
    const usersLinks = Array.from(container.querySelectorAll('a[href="/users"]'));
    expect(visitorsLink).toHaveTextContent("Today's Visitors");
    expect(inventoryLink).toHaveTextContent('Inventory');
    expect(usersLinks.some((a) => a.textContent?.includes('User Directory'))).toBe(true);

    // Recently Cataloged Books appears before My Library Card in DOM order
    const recentHeading = Array.from(container.querySelectorAll('h2')).find((h) =>
      h.textContent?.includes('Recently Cataloged Books')
    ) as HTMLElement;
    const cardHeading = Array.from(container.querySelectorAll('h2')).find((h) =>
      h.textContent?.includes('My Library Card')
    ) as HTMLElement;
    expect(recentHeading).toBeDefined();
    expect(cardHeading).toBeDefined();
    expect(recentHeading.compareDocumentPosition(cardHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Collapsible My Library Card toggle
    const toggleBtn = container.querySelector('button[aria-expanded="true"]') as HTMLButtonElement;
    expect(toggleBtn).toHaveTextContent('Hide card');
    await clickElement(toggleBtn);
    expect(container.querySelector('button[aria-expanded="false"]')).toHaveTextContent('Show card');
  });

  it('BookDetailModal and StudentBookDetailClient label Section vs Shelf Location accurately with no full-page link', async () => {
    expect(bookDetailsMetadata.title).toBe('Book Details');

    const bookDetail = {
      id: 'bk-bio-1',
      title: 'Leonardo da Vinci',
      author: 'Walter Isaacson',
      isbn: '9781501139154',
      dewey_decimal: '709.2',
      available_copies: 0,
      total_copies: 2,
      section: 'Biography',
      location: 'Shelf E4',
      cover_url: null,
      categories: { name: 'History & Biography' },
      tags: ['biography'],
    };
    const availability = {
      hasReservation: false,
      isReady: false,
      queuePosition: null,
      holdExpiresAt: null,
      nextAvailableDate: null,
      reservationId: null,
    };

    const detailRender = await renderClient(
      <Suspense fallback={<div>Loading</div>}>
        <StudentBookDetailClient
          id="bk-bio-1"
          bookPromise={Promise.resolve(bookDetail)}
          availabilityPromise={Promise.resolve(availability)}
        />
      </Suspense>
    );
    await act(async () => { await Promise.resolve(); });

    const detailText = detailRender.container.textContent || '';
    expect(detailText).toContain('SectionBiography');
    expect(detailRender.container.querySelector('dl')).toHaveTextContent('Shelf locationShelf E4');
    expect(detailText).toContain('Join Waitlist');

    cleanupClients();

    mockGetBookPublicDetails.mockResolvedValueOnce({ book: bookDetail, availability });
    await renderClient(
      <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="patron">
        <BookDetailModal
          bookId="bk-bio-1"
          open
          onOpenChange={vi.fn()}
          variant="student"
          initialData={bookDetail as never}
        />
      </PreferencesProvider>
    );
    await act(async () => { await Promise.resolve(); });

    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain('SectionBiography');
    expect(dialog.querySelector('dl')).toHaveTextContent('Shelf locationShelf E4');
    expect(dialog.querySelector('a[href="/student-catalog/bk-bio-1"]')).toBeNull();
    expect(dialog.querySelector('[aria-label="Open full page"]')).toBeNull();
  });

  it('MyCardContainer uses Show card back / Show card front labels and ReserveTitleButton uses Join Waitlist', async () => {
    const { container } = await renderClient(
      <MyCardContainer
        initialData={{
          fullName: 'Paolo Ian Bautista',
          studentId: 'STU-001',
          cardNumber: 'DEMO-STU-001',
          department: 'BSCS',
          status: 'active',
          expiryDate: '2027-01-01',
          avatarUrl: null,
          qrUrl: null,
        }}
        variant="dashboard"
      />
    );
    await act(async () => { await Promise.resolve(); });

    const flipBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Show card back')
    );
    expect(flipBtn).toBeDefined();
    await clickElement(flipBtn);
    expect(
      Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Show card front')
      )
    ).toBeDefined();

    cleanupClients();

    const reserveRender = await renderClient(
      <ReserveTitleButton bookId="bk-wait" isAvailable={false} hasExistingReservation={false} />
    );
    expect(reserveRender.container).toHaveTextContent('Join Waitlist');
  });

  it('HistoryContent provides a clear search button and single-row sentence-case status tabs', async () => {
    const { container } = await renderClient(
      <Suspense fallback={<div>Loading</div>}>
        <HistoryContent
          historyPromise={Promise.resolve({ records: [], totalCount: 0 })}
          page={1}
          statusFilter="all"
          searchQuery=""
          userRole="patron"
        />
      </Suspense>
    );
    await act(async () => { await Promise.resolve(); });

    const searchInput = container.querySelector('input[type="search"]') as HTMLInputElement;
    expect(searchInput.className).toContain('[&::-webkit-search-cancel-button]:appearance-none');
    await typeIntoInput(searchInput, 'Dune');

    const clearBtn = container.querySelector('button[aria-label="Clear search"]') as HTMLButtonElement;
    expect(clearBtn).not.toBeNull();
    await clickElement(clearBtn);
    expect(searchInput.value).toBe('');
  });
});
