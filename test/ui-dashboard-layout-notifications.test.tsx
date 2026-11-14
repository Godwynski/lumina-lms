import * as React from 'react';
import { Suspense, act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { m } from 'framer-motion';
import { BookOpen, Plus } from 'lucide-react';
import {
  renderClient,
  cleanupClients,
  clickElement,
  typeIntoInput,
  pressKey,
} from './helpers/render';

// ---------------------------------------------------------------------------
// DOM / Browser polyfills for jsdom
// ---------------------------------------------------------------------------
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

let mockReducedMotion = false;
let mockMobileViewport = false;
const mediaListeners = new Map<string, Set<() => void>>();

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn((query: string) => {
    const isReduced = query.includes('prefers-reduced-motion');
    const isMaxWidth = query.includes('max-width');
    const listeners = mediaListeners.get(query) ?? new Set<() => void>();
    mediaListeners.set(query, listeners);
    return {
      get matches() {
        if (isReduced) return mockReducedMotion;
        if (isMaxWidth) return mockMobileViewport;
        return false;
      },
      media: query,
      onchange: null,
      addEventListener: (_event: string, cb: () => void) => {
        listeners.add(cb);
      },
      removeEventListener: (_event: string, cb: () => void) => {
        listeners.delete(cb);
      },
      addListener: (cb: () => void) => {
        listeners.add(cb);
      },
      removeListener: (cb: () => void) => {
        listeners.delete(cb);
      },
      dispatchEvent: () => true,
    };
  }),
});

type IntersectionCallback = (entries: IntersectionObserverEntry[]) => void;
let lastIntersectionObserver: {
  callback: IntersectionCallback;
  observed: Element[];
  disconnected: boolean;
} | null = null;

globalThis.IntersectionObserver = class MockIntersectionObserver {
  private callback: IntersectionCallback;
  private observed: Element[] = [];
  private disconnected = false;

  constructor(callback: IntersectionCallback) {
    this.callback = callback;
    lastIntersectionObserver = {
      callback,
      observed: this.observed,
      disconnected: false,
    };
  }
  observe(el: Element) {
    this.observed.push(el);
    if (lastIntersectionObserver) {
      lastIntersectionObserver.observed = this.observed;
    }
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
    if (lastIntersectionObserver) {
      lastIntersectionObserver.disconnected = true;
    }
  }
  takeRecords() {
    return [];
  }
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];
} as unknown as typeof IntersectionObserver;

// ---------------------------------------------------------------------------
// External boundary mocks
// ---------------------------------------------------------------------------
const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouterRefresh = vi.fn();
const mockRouterPrefetch = vi.fn();
const mockRouter = {
  push: mockRouterPush,
  replace: mockRouterReplace,
  refresh: mockRouterRefresh,
  prefetch: mockRouterPrefetch,
};
let mockPathname = '/dashboard';
let mockSearchParamsString = '';

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearchParamsString),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    prefetch: _prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: (
    props: React.ImgHTMLAttributes<HTMLImageElement> & {
      fill?: boolean;
      priority?: boolean;
      unoptimized?: boolean;
    }
  ) => {
    const rest = { ...props };
    delete rest.fill;
    delete rest.priority;
    delete rest.unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={rest.alt ?? ''} {...rest} />;
  },
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();
const mockToastWarning = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockGetDashboardStats = vi.fn();
const mockGetBookCopyTitle = vi.fn();
vi.mock('@/lib/actions/dashboard', () => ({
  getDashboardStats: (...args: unknown[]) => mockGetDashboardStats(...args),
  getBookCopyTitle: (...args: unknown[]) => mockGetBookCopyTitle(...args),
}));

const mockCancelReservation = vi.fn();
const mockGetMyReservations = vi.fn();
const mockGetBookAvailabilityStatus = vi.fn();
vi.mock('@/lib/actions/reservations', () => ({
  cancelReservation: (...args: unknown[]) => mockCancelReservation(...args),
  getMyReservations: (...args: unknown[]) => mockGetMyReservations(...args),
  getBookAvailabilityStatus: (...args: unknown[]) =>
    mockGetBookAvailabilityStatus(...args),
}));

const mockLookupAndImportISBN = vi.fn();
const mockGetBookAdminDetails = vi.fn();
const mockGetBookPublicDetails = vi.fn();
vi.mock('@/lib/actions/catalog', () => ({
  lookupAndImportISBN: (...args: unknown[]) => mockLookupAndImportISBN(...args),
  getBookAdminDetails: (...args: unknown[]) => mockGetBookAdminDetails(...args),
  getBookPublicDetails: (...args: unknown[]) => mockGetBookPublicDetails(...args),
}));

const mockGetMe = vi.fn();
vi.mock('@/lib/auth-helpers', () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
}));

type RealtimeHandler = (payload: { new: Record<string, unknown> }) => void;
const registeredChannels: Array<{
  name: string;
  handlers: Array<{
    event: string;
    table?: string;
    callback: RealtimeHandler;
  }>;
}> = [];

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateClient(),
}));

// ---------------------------------------------------------------------------
// Real component imports
// ---------------------------------------------------------------------------
import { ActivitySection } from '@/components/dashboard/ActivitySection';
import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { DashboardContent } from '@/components/dashboard/DashboardContent';
import { LiveActivityTicker } from '@/components/dashboard/LiveActivityTicker';
import { SupportSection } from '@/components/dashboard/SupportSection';

import { BreadcrumbNav } from '@/components/layout/BreadcrumbNav';
import { Logo } from '@/components/layout/Logo';
import { MainHeader } from '@/components/layout/MainHeader';
import { NavigationGuard } from '@/components/layout/NavigationGuard';
import { ProtectedNav } from '@/components/layout/ProtectedNav';
import { UserNav } from '@/components/layout/UserNav';

import { NotificationBell } from '@/components/notifications/NotificationBell';
import { NotificationDetailsDialog } from '@/components/notifications/NotificationDetailsDialog';
import { NotificationList } from '@/components/notifications/NotificationList';
import type { Notification } from '@/hooks/use-notifications';

import { AnimationProvider } from '@/components/providers/animation-provider';
import {
  BatchTaskProvider,
  useBatchTask,
} from '@/components/providers/BatchTaskProvider';
import {
  PreferencesProvider,
  usePreferences,
} from '@/components/providers/PreferencesProvider';

import { BookArt } from '@/components/landing/book-art';
import { ScrollProgress } from '@/components/landing/scroll-progress';
import { Hero } from '@/components/hero';
import { EnvVarWarning } from '@/components/env-var-warning';

import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
} from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectSeparator,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarRail,
  SidebarInset,
  SidebarInput,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { CardLink, CardButton } from '@/components/ui/card-action';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { MicrosoftIcon } from '@/components/ui/microsoft-icon';
import { FieldControlIdContext } from '@/components/ui/field-context';
import type { BorrowingRecord } from '@/lib/actions/history';
import type { Category, ProfileData, Reservation } from '@/lib/types';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'ada.lovelace@alabang.sti.edu.ph',
    app_metadata: {},
    user_metadata: { full_name: 'Ada Lovelace', avatar_url: '/avatar.png' },
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as User;
}

function makeProfile(overrides: Partial<ProfileData> = {}): ProfileData {
  return {
    id: 'user-1',
    full_name: 'Ada Lovelace',
    email: 'ada.lovelace@alabang.sti.edu.ph',
    role: 'student',
    status: 'ACTIVE',
    student_id: 'STU-20260001',
    department: 'BS Computer Science',
    avatar_url: '/avatar.png',
    address: null,
    phone: null,
    updated_at: '2026-01-02T00:00:00Z',
    permissions: {
      manage_circulation: false,
      manage_attendance: false,
      view_admin_dashboard: false,
    },
    ...overrides,
  };
}

function makeSupabaseMock(options?: {
  sessionUser?: { id: string } | null;
  notifications?: Notification[];
  unreadCount?: number;
  notifError?: { message: string } | null;
  markReadError?: { message: string } | null;
  signOutError?: { message: string } | null;
  oauthError?: { message: string } | null;
}) {
  const notifications = options?.notifications ?? [];
  const unreadCount =
    options?.unreadCount ?? notifications.filter((n) => !n.is_read).length;

  const mockUpdateEq = vi.fn().mockResolvedValue({
    error: options?.markReadError ?? null,
  });
  const mockUpdate = vi.fn().mockReturnValue({
    eq: mockUpdateEq,
  });

  const makeQueryBuilder = () => {
    let headMode = false;
    const builder = {
      select: vi.fn((_cols?: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.head) headMode = true;
        return builder;
      }),
      eq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      or: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(async () => ({
        data: options?.notifError ? null : notifications,
        error: options?.notifError ?? null,
      })),
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
      update: mockUpdate,
      then: (resolve: (val: unknown) => void) => {
        if (headMode) {
          resolve({
            count: options?.notifError ? null : unreadCount,
            error: options?.notifError ?? null,
          });
        } else {
          resolve({
            data: options?.notifError ? null : notifications,
            error: options?.notifError ?? null,
          });
        }
      },
    };
    return builder;
  };

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session:
            options?.sessionUser === null
              ? null
              : { user: options?.sessionUser ?? { id: 'user-1' } },
        },
      }),
      signOut: vi.fn().mockResolvedValue({ error: options?.signOutError ?? null }),
      signInWithOAuth: vi
        .fn()
        .mockResolvedValue({ error: options?.oauthError ?? null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'notifications') {
        return {
          select: (cols?: string, opts?: { count?: string; head?: boolean }) =>
            makeQueryBuilder().select(cols, opts),
          update: () => ({
            eq: vi.fn(() => ({
              eq: mockUpdateEq,
              then: (resolve: (val: unknown) => void) =>
                resolve({ error: options?.markReadError ?? null }),
            })),
          }),
        };
      }
      return makeQueryBuilder();
    }),
    channel: vi.fn((name: string) => {
      const entry = {
        name,
        handlers: [] as Array<{
          event: string;
          table?: string;
          callback: RealtimeHandler;
        }>,
      };
      registeredChannels.push(entry);
      const ch = {
        on: vi.fn(
          (
            _type: string,
            filter: { event?: string; table?: string },
            cb: RealtimeHandler
          ) => {
            entry.handlers.push({
              event: filter.event ?? '*',
              table: filter.table,
              callback: cb,
            });
            return ch;
          }
        ),
        subscribe: vi.fn(() => ch),
      };
      return ch;
    }),
    removeChannel: vi.fn().mockResolvedValue('ok'),
    _mockUpdateEq: mockUpdateEq,
  };
}

function findButtonByText(
  root: ParentNode,
  text: string
): HTMLButtonElement | undefined {
  return Array.from(root.querySelectorAll('button')).find((btn) =>
    btn.textContent?.toLowerCase().includes(text.toLowerCase())
  ) as HTMLButtonElement | undefined;
}

async function openRadixPopup(trigger: HTMLElement): Promise<void> {
  await pressKey(trigger, 'Enter');
}

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'notif-1',
    user_id: 'user-1',
    title: 'Book Due Tomorrow',
    content: 'Clean Code is due back tomorrow at 5 PM.',
    type: 'DUE_SOON',
    priority: 'medium',
    is_read: false,
    metadata: {},
    created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Global setup / teardown
// ---------------------------------------------------------------------------
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  registeredChannels.length = 0;
  mockPathname = '/dashboard';
  mockSearchParamsString = '';
  mockReducedMotion = false;
  mockMobileViewport = false;
  lastIntersectionObserver = null;

  const defaultSb = makeSupabaseMock();
  mockCreateClient.mockReturnValue(defaultSb);

  fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ preferences: { theme: 'light' } }),
  });
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  cleanupClients();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ===========================================================================
// 1. Dashboard Components
// ===========================================================================
describe('Dashboard Components', () => {
  it('ActivitySection renders empty states when borrows, reservations, and logs are empty', async () => {
    const { container } = await renderClient(
      <ActivitySection
        activeBorrows={[]}
        reservations={[]}
        attendanceLogs={[]}
        onOpenBook={vi.fn()}
        onCancelReservation={vi.fn()}
        isPending={false}
        mounted={true}
      />
    );

    expect(container.textContent).toContain('No active borrows');
    expect(container.textContent).toContain('No active reservations');
    expect(container.textContent).toContain('No logs yet');
    const viewAll = container.querySelector('a[href="/attendance"]');
    expect(viewAll).not.toBeNull();
  });

  it('ActivitySection renders active/overdue borrows, reservations, attendance durations, and handles interactions', async () => {
    const onOpenBook = vi.fn();
    const onCancelReservation = vi.fn();

    const borrows: BorrowingRecord[] = [
      {
        id: 'b-1',
        status: 'BORROWED',
        borrowed_at: '2026-11-01T08:00:00Z',
        due_date: '2099-12-31T00:00:00Z',
        returned_at: null,
        fine_amount: 0,
        fine_paid: false,
        books: {
          id: 'book-1',
          title: 'Designing Data-Intensive Applications',
          author: 'Martin Kleppmann',
          cover_url: 'https://example.com/bad.jpg',
        },
      } as unknown as BorrowingRecord,
      {
        id: 'b-2',
        status: 'OVERDUE',
        borrowed_at: '2026-10-01T08:00:00Z',
        due_date: '2020-01-01T00:00:00Z',
        returned_at: null,
        fine_amount: 50,
        fine_paid: false,
        books: {
          id: 'book-2',
          title: 'Refactoring',
          author: 'Martin Fowler',
          cover_url: null,
        },
      } as unknown as BorrowingRecord,
    ];

    const reservations: Reservation[] = [
      {
        id: 'res-1',
        status: 'READY',
        queue_position: 1,
        hold_expires_at: '2026-11-15T08:00:00Z',
        books: { id: 'book-3', title: 'Domain-Driven Design', cover_url: null },
      },
      {
        id: 'res-2',
        status: 'ACTIVE',
        queue_position: 3,
        hold_expires_at: null,
        books: { id: 'book-4', title: 'The Pragmatic Programmer', cover_url: null },
      },
    ];

    const logs = [
      {
        id: 'att-1',
        check_in_at: '2026-11-14T08:00:00Z',
        check_out_at: '2026-11-14T10:30:00Z',
      },
      {
        id: 'att-2',
        check_in_at: '2026-11-14T11:00:00Z',
        check_out_at: null,
      },
    ];

    const { container, rerender } = await renderClient(
      <ActivitySection
        activeBorrows={borrows}
        reservations={reservations}
        attendanceLogs={logs}
        onOpenBook={onOpenBook}
        onCancelReservation={onCancelReservation}
        isPending={false}
        mounted={false}
      />
    );

    // Unmounted placeholders
    expect(container.textContent).toContain('Due ...');
    expect(container.textContent).toContain('--:--');

    // Rerender mounted
    await rerender(
      <ActivitySection
        activeBorrows={borrows}
        reservations={reservations}
        attendanceLogs={logs}
        onOpenBook={onOpenBook}
        onCancelReservation={onCancelReservation}
        isPending={false}
        mounted={true}
      />
    );

    expect(container.textContent).toContain('Designing Data-Intensive Applications');
    expect(container.textContent).toContain('Active');
    expect(container.textContent).toContain('Overdue');
    expect(container.textContent).toContain('Ready for Pickup');
    expect(container.textContent).toContain('Queue Position #3');
    expect(container.textContent).toContain('2h 30m');
    expect(container.textContent).toContain('Live');

    // Image error fallback
    const firstImg = container.querySelector('img');
    expect(firstImg?.getAttribute('src')).toBe('https://example.com/bad.jpg');
    await act(async () => {
      firstImg?.dispatchEvent(new Event('error'));
    });
    expect(firstImg?.getAttribute('src')).toBe('/images/default-book-cover.png');

    // Open borrow book
    const borrowBtn = container.querySelector(
      'button[aria-label="Open details for Designing Data-Intensive Applications"]'
    );
    await clickElement(borrowBtn);
    expect(onOpenBook).toHaveBeenCalledWith('book-1');

    // Open reservation book
    const resBookBtn = container.querySelector(
      'button[aria-label="Open details for Domain-Driven Design"]'
    );
    await clickElement(resBookBtn);
    expect(onOpenBook).toHaveBeenCalledWith('book-3');

    // Cancel reservation
    const cancelBtn = container.querySelector(
      'button[aria-label="Cancel reservation for Domain-Driven Design"]'
    );
    await clickElement(cancelBtn);
    expect(onCancelReservation).toHaveBeenCalledWith('res-1', 'Domain-Driven Design');

    // Pending state disables cancel button
    await rerender(
      <ActivitySection
        activeBorrows={borrows}
        reservations={reservations}
        attendanceLogs={logs}
        onOpenBook={onOpenBook}
        onCancelReservation={onCancelReservation}
        isPending={true}
        mounted={true}
      />
    );
    const disabledCancelBtn = container.querySelector(
      'button[aria-label="Cancel reservation for Domain-Driven Design"]'
    ) as HTMLButtonElement | null;
    expect(disabledCancelBtn?.disabled).toBe(true);
  });

  it('SupportSection hides when empty and renders FAQ pairs when populated', async () => {
    const { container, rerender } = await renderClient(<SupportSection faqs={[]} />);
    expect(container.innerHTML).toBe('');

    await rerender(
      <SupportSection
        faqs={[
          { question: 'How many books can I borrow?', answer: 'Up to 3 books.' },
          { question: 'What is the loan period?', answer: '7 days.' },
        ]}
      />
    );
    expect(container.textContent).toContain('Support & FAQs');
    expect(container.textContent).toContain('How many books can I borrow?');
    expect(container.textContent).toContain('Up to 3 books.');
    expect(container.textContent).toContain('7 days.');
  });

  it('LiveActivityTicker listens to realtime inserts, caps at 3 items, dismisses on click and auto-dismisses', async () => {
    vi.useFakeTimers();
    try {
      mockGetBookCopyTitle.mockResolvedValue('Clean Architecture');

      const { container } = await renderClient(<LiveActivityTicker />);
      expect(container.innerHTML).toBe('');

      const tickerChannel = registeredChannels.find((c) => c.name === 'live-tickers');
      expect(tickerChannel).toBeDefined();

      const borrowHandler = tickerChannel?.handlers.find(
        (h) => h.table === 'borrowing_records'
      )?.callback;
      const bookHandler = tickerChannel?.handlers.find(
        (h) => h.table === 'books'
      )?.callback;

      // Missing book_copy_id is ignored
      await act(async () => {
        await borrowHandler?.({ new: { id: 'ev-skip' } });
      });
      expect(mockGetBookCopyTitle).not.toHaveBeenCalled();

      // Borrow insert + Return insert + 2 Book inserts -> max 3 items
      await act(async () => {
        await borrowHandler?.({
          new: { id: 'ev-1', book_copy_id: 'copy-1', status: 'BORROWED' },
        });
        await borrowHandler?.({
          new: { id: 'ev-2', book_copy_id: 'copy-2', status: 'RETURNED' },
        });
        bookHandler?.({ new: { id: 'ev-3', title: 'Structure & Interpretation' } });
        bookHandler?.({ new: { id: 'ev-4', title: 'Compilers' } });
      });

      expect(container.textContent).toContain('Compilers');
      expect(container.textContent).toContain('Structure & Interpretation');
      expect(container.textContent).toContain('Return Confirmed');
      // 4th oldest ('ev-1' Borrow Processed) dropped by slice(0, 3)
      expect(container.textContent).not.toContain('Borrow Processed');

      // Manual dismiss removes one
      const closeBtn = container.querySelector('button[aria-label="Close notification"]');
      await clickElement(closeBtn);
      expect(container.textContent).not.toContain('Compilers');

      // Auto-dismiss after 8s clears remaining
      await act(async () => {
        vi.advanceTimersByTime(8100);
      });
      expect(container.innerHTML).toBe('');
    } finally {
      cleanupClients();
      vi.useRealTimers();
    }
  });

  it('DashboardClient renders staff dashboard for super_admin vs librarian, Action Center states, and BookDetailModal trigger', async () => {
    mockGetBookPublicDetails.mockResolvedValue({
      book: {
        id: 'book-99',
        title: 'Algorithms',
        author: 'Sedgewick',
        isbn: '9780321573513',
        status: 'AVAILABLE',
        total_copies: 2,
        available_copies: 2,
      },
      availability: {
        isAvailable: true,
        totalCopies: 2,
        availableCopies: 2,
        hasReservation: false,
        isReady: false,
        queuePosition: null,
        holdExpiresAt: null,
        nextAvailableDate: null,
      },
    });

    const stats = {
      activeBorrows: 12,
      pendingApprovals: 3,
      myActiveBorrows: 0,
      recentBooks: [
        {
          id: 'book-99',
          title: 'Algorithms',
          author: 'Sedgewick',
          cover_url: null,
          created_at: '2026-11-10T00:00:00Z',
        },
      ],
      attendanceToday: 42,
      totalBooks: 500,
      totalUsers: 120,
      overdueBorrows: 2,
      readyHolds: 1,
    };

    const { container, rerender } = await renderClient(
      <Suspense fallback={<div>Suspending</div>}>
        <DashboardClient
          user={makeUser()}
          role="super_admin"
          statsPromise={Promise.resolve(stats)}
          profilePromise={Promise.resolve({ data: makeProfile({ role: 'super_admin' }) })}
          cardPromise={Promise.resolve({ data: null })}
          faqPromise={Promise.resolve({ data: null })}
          reservationsPromise={Promise.resolve([])}
          inventoryBooksPromise={Promise.resolve({ data: [], count: 0 })}
          inventoryCategoriesPromise={Promise.resolve([] as Category[])}
          attendanceLogs={[]}
        />
      </Suspense>
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Action Center');
    expect(container.textContent).toContain('Card Applications');
    expect(container.textContent).toContain('Overdue Borrows');
    expect(container.textContent).toContain('Holds Ready');
    expect(container.textContent).toContain('42');
    expect(container.textContent).toContain('500');
    expect(container.textContent).toContain('Audit Trail');
    expect(container.textContent).toContain('Settings & Policies');
    expect(container.textContent).toContain('Algorithms');

    // Click recent book opens BookDetailModal
    const bookBtn = findButtonByText(container, 'Algorithms');
    await clickElement(bookBtn);
    expect(mockGetBookPublicDetails).toHaveBeenCalledWith('book-99');

    // Librarian hides Audit Trail & Settings & Policies, and 0 actions shows All caught up
    await rerender(
      <Suspense fallback={<div>Suspending</div>}>
        <DashboardClient
          user={makeUser()}
          role="librarian"
          statsPromise={Promise.resolve({
            ...stats,
            pendingApprovals: 0,
            overdueBorrows: 0,
            readyHolds: 0,
            recentBooks: [],
          })}
          profilePromise={Promise.resolve({ data: makeProfile({ role: 'librarian' }) })}
          cardPromise={Promise.resolve({ data: null })}
          faqPromise={Promise.resolve({ data: null })}
          reservationsPromise={Promise.resolve([])}
          inventoryBooksPromise={Promise.resolve({ data: [], count: 0 })}
          inventoryCategoriesPromise={Promise.resolve([] as Category[])}
          attendanceLogs={[]}
        />
      </Suspense>
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('All caught up. No pending administrative actions.');
    expect(container.textContent).toContain('No recent additions');
    expect(container.textContent).not.toContain('Audit Trail');
    expect(container.textContent).not.toContain('Settings & Policies');
  });

  it('DashboardClient renders student/assistant dashboard, parses FAQs, handles cancelReservation, and shows missing card fallback', async () => {
    mockCancelReservation.mockResolvedValueOnce({ success: true });
    const stats = {
      activeBorrows: 0,
      pendingApprovals: 0,
      myActiveBorrows: 1,
      recentBooks: [],
      activeBorrowsList: [],
      attendanceToday: 0,
      totalBooks: 0,
      totalUsers: 0,
      overdueBorrows: 0,
      readyHolds: 0,
    };

    const reservations: Reservation[] = [
      {
        id: 'res-9',
        status: 'READY',
        queue_position: 1,
        hold_expires_at: null,
        books: { id: 'book-9', title: 'SICP', cover_url: null },
      },
    ];

    const { container, rerender } = await renderClient(
      <Suspense fallback={<div>Suspending</div>}>
        <DashboardClient
          user={makeUser()}
          role="student_assistant"
          statsPromise={Promise.resolve(stats)}
          profilePromise={Promise.resolve({
            data: makeProfile({
              role: 'student_assistant',
              status: 'ACTIVE',
              permissions: {
                manage_circulation: true,
                manage_attendance: true,
                view_admin_dashboard: false,
              },
            }),
          })}
          cardPromise={Promise.resolve({
            data: {
              card_number: 'LUM-2026-001',
              status: 'ACTIVE',
              expires_at: '2027-06-01T00:00:00Z',
            },
          })}
          faqPromise={Promise.resolve({
            data: [
              {
                key: 'student_faq_list',
                value: JSON.stringify([
                  { question: 'Custom FAQ Q?', answer: 'Custom FAQ A.' },
                ]),
              },
            ],
          })}
          reservationsPromise={Promise.resolve(reservations)}
          inventoryBooksPromise={Promise.resolve({ data: [], count: 0 })}
          inventoryCategoriesPromise={Promise.resolve([] as Category[])}
          activeAttendance={{ id: 'att-live', check_in_at: '2026-11-14T08:00:00Z' }}
          attendanceLogs={[]}
        />
      </Suspense>
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Currently Timed In');
    expect(container.textContent).toContain('Assistant Desk Shortcuts');
    expect(container.textContent).toContain('Circulation Desk');
    expect(container.textContent).toContain('Attendance Logs');
    expect(container.textContent).toContain('Custom FAQ Q?');

    // Cancel reservation success
    const cancelBtn = container.querySelector(
      'button[aria-label="Cancel reservation for SICP"]'
    );
    await clickElement(cancelBtn);
    expect(mockCancelReservation).toHaveBeenCalledWith('res-9');
    expect(mockToastSuccess).toHaveBeenCalledWith('Reservation for "SICP" cancelled.');
    expect(mockRouterRefresh).toHaveBeenCalled();

    // Cancel reservation failure
    mockCancelReservation.mockRejectedValueOnce(new Error('Network down'));
    await clickElement(cancelBtn);
    expect(mockToastError).toHaveBeenCalledWith('Network down');

    // Missing profile -> "No Digital Card Available"
    await rerender(
      <Suspense fallback={<div>Suspending</div>}>
        <DashboardClient
          user={makeUser()}
          role="student"
          statsPromise={Promise.resolve(stats)}
          profilePromise={Promise.resolve({ data: null })}
          cardPromise={Promise.resolve({ data: null })}
          faqPromise={Promise.resolve({ data: null })}
          reservationsPromise={Promise.resolve([])}
          inventoryBooksPromise={Promise.resolve({ data: [], count: 0 })}
          inventoryCategoriesPromise={Promise.resolve([] as Category[])}
          attendanceLogs={[]}
        />
      </Suspense>
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain('No Digital Card Available');
  });

  it('DashboardContent returns null when unauthenticated and renders DashboardClient when authenticated', async () => {
    mockGetMe.mockResolvedValueOnce(null);
    const unauthEl = await DashboardContent({ searchParams: Promise.resolve({}) });
    expect(unauthEl).toBeNull();

    const sb = makeSupabaseMock();
    sb.from = vi.fn((table: string) => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        in: vi.fn(() => builder),
        order: vi.fn(() => builder),
        limit: vi.fn(async () => ({
          data:
            table === 'attendance'
              ? [{ id: 'a1', check_in_at: '2026-11-14T08:00:00Z', check_out_at: null }]
              : [],
          error: null,
        })),
        maybeSingle: vi.fn(async () => ({
          data:
            table === 'library_cards'
              ? { card_number: 'CARD-1', status: 'ACTIVE', expires_at: '2027-01-01' }
              : null,
          error: null,
        })),
        then: (resolve: (val: unknown) => void) =>
          resolve({ data: [], error: null }),
      };
      return builder;
    }) as unknown as typeof sb.from;

    mockGetMe.mockResolvedValueOnce({
      user: makeUser(),
      role: 'student',
      profile: makeProfile(),
      supabase: sb,
    });
    mockGetDashboardStats.mockResolvedValueOnce({
      activeBorrows: 0,
      pendingApprovals: 0,
      myActiveBorrows: 0,
      recentBooks: [],
      activeBorrowsList: [],
      attendanceToday: 0,
      totalBooks: 0,
      totalUsers: 0,
      overdueBorrows: 0,
      readyHolds: 0,
    });
    mockGetMyReservations.mockResolvedValueOnce([]);

    const authEl = await DashboardContent({ searchParams: Promise.resolve({}) });
    const { container } = await renderClient(
      <Suspense fallback={<div>Loading...</div>}>{authEl}</Suspense>
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(mockGetDashboardStats).toHaveBeenCalledWith({ role: 'student' });
    expect(mockGetMyReservations).toHaveBeenCalled();
    expect(container.textContent).toContain('Currently Timed In');
  });
});

// ===========================================================================
// 2. Layout Components
// ===========================================================================
describe('Layout Components', () => {
  it('BreadcrumbNav formats dashboard, dynamic UUIDs, catalog redirect, and role-aware history/attendance titles', async () => {
    mockPathname = '/dashboard';
    const { container, rerender } = await renderClient(
      <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="student">
        <BreadcrumbNav />
      </PreferencesProvider>
    );
    expect(container.querySelector('h1')?.textContent).toBe('Dashboard');

    // Empty root returns null
    mockPathname = '/';
    await rerender(
      <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="student">
        <BreadcrumbNav />
      </PreferencesProvider>
    );
    expect(container.innerHTML).toBe('');

    // Dynamic UUID under student-catalog
    mockPathname = '/student-catalog/123e4567-e89b-12d3-a456-426614174000';
    await rerender(
      <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="student">
        <BreadcrumbNav />
      </PreferencesProvider>
    );
    expect(container.querySelector('h1')?.textContent).toBe('Book Details');
    const backLink = container.querySelector('a');
    expect(backLink?.getAttribute('href')).toBe('/student-catalog');
    expect(backLink?.textContent).toContain('Catalog');

    // /catalog/add redirects back link to /inventory
    mockPathname = '/catalog/add';
    await rerender(
      <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="super_admin">
        <BreadcrumbNav />
      </PreferencesProvider>
    );
    expect(container.querySelector('h1')?.textContent).toBe('Add Asset');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/inventory');
    expect(container.querySelector('a')?.textContent).toContain('Inventory');

    // /users/new
    mockPathname = '/users/new';
    await rerender(
      <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="super_admin">
        <BreadcrumbNav />
      </PreferencesProvider>
    );
    expect(container.querySelector('h1')?.textContent).toBe('Invite User');

    // /history?view=logs as librarian -> Borrowing Logs
    mockPathname = '/history';
    mockSearchParamsString = 'view=logs';
    await rerender(
      <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="librarian">
        <BreadcrumbNav />
      </PreferencesProvider>
    );
    expect(container.querySelector('h1')?.textContent).toBe('Borrowing Logs');

    // /attendance?view=logs as student_assistant -> Attendance Logs
    mockPathname = '/attendance';
    mockSearchParamsString = 'view=logs';
    await rerender(
      <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="student_assistant">
        <BreadcrumbNav />
      </PreferencesProvider>
    );
    expect(container.querySelector('h1')?.textContent).toBe('Attendance Logs');
  });

  it('Logo renders system SVG with calculated size + 16 padding', async () => {
    const { container } = await renderClient(<Logo size={20} className="custom-logo" />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('/icon.svg');
    expect(img?.getAttribute('alt')).toBe('System Logo');
    expect(img?.getAttribute('width')).toBe('36');
    expect(img?.getAttribute('height')).toBe('36');
    expect(container.firstElementChild?.className).toContain('custom-logo');
  });

  it('MainHeader renders BreadcrumbNav, NotificationBell, userNav, and toggles collapsed brand visibility', async () => {
    const { container, rerender } = await renderClient(
      <SidebarProvider open={true}>
        <MainHeader userNav={<div data-testid="user-nav-slot">UserSlot</div>} />
      </SidebarProvider>
    );

    expect(container.textContent).toContain('Dashboard');
    expect(container.textContent).toContain('UserSlot');
    expect(
      container.querySelector('button[aria-label="Notifications"]')
    ).not.toBeNull();
    const brandWrapper = container.querySelector('a[href="/dashboard"]')?.parentElement;
    expect(brandWrapper?.className).toContain('opacity-0');

    // Collapsed state reveals brand
    await rerender(
      <SidebarProvider open={false}>
        <MainHeader userNav={<div data-testid="user-nav-slot">UserSlot</div>} />
      </SidebarProvider>
    );
    const brandWrapperCollapsed = container.querySelector(
      'a[href="/dashboard"]'
    )?.parentElement;
    expect(brandWrapperCollapsed?.className).toContain('opacity-100');
  });

  it('NavigationGuard intercepts internal anchor clicks and beforeunload only when isDirty is true', async () => {
    const confirmSpy = vi.fn().mockReturnValue(false);
    vi.stubGlobal('confirm', confirmSpy);

    const { container, rerender } = await renderClient(
      <div>
        <NavigationGuard isDirty={false} message="Leave unsaved?" />
        <a href="/inventory">Go Inventory</a>
        <a href="#section">Jump Section</a>
        <a href="/outside" target="_blank">
          New Tab
        </a>
      </div>
    );

    const invLink = container.querySelector('a[href="/inventory"]') as HTMLAnchorElement;
    const hashLink = container.querySelector('a[href="#section"]') as HTMLAnchorElement;
    const blankLink = container.querySelector('a[target="_blank"]') as HTMLAnchorElement;

    const cleanClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    // Prevent jsdom navigation on bubble without affecting capture check
    invLink.addEventListener('click', (e) => e.preventDefault());
    await act(async () => {
      invLink.dispatchEvent(cleanClick);
    });
    expect(confirmSpy).not.toHaveBeenCalled();

    await rerender(
      <div>
        <NavigationGuard isDirty={true} message="Leave unsaved?" />
        <a href="/inventory">Go Inventory</a>
        <a href="#section">Jump Section</a>
        <a href="/outside" target="_blank">
          New Tab
        </a>
      </div>
    );

    // Hash and _blank links are not intercepted
    await act(async () => {
      hashLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      blankLink.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      );
    });
    expect(confirmSpy).not.toHaveBeenCalled();

    // Internal link prompts confirm and cancels + stops propagation when false
    const dirtyBlockedClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      invLink.dispatchEvent(dirtyBlockedClick);
    });
    expect(confirmSpy).toHaveBeenCalledWith('Leave unsaved?');
    expect(dirtyBlockedClick.defaultPrevented).toBe(true);

    // When confirm returns true, NavigationGuard allows the event through
    confirmSpy.mockReturnValueOnce(true);
    let reachedTarget = false;
    invLink.addEventListener('click', (e) => {
      reachedTarget = true;
      e.preventDefault();
    });
    await act(async () => {
      invLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    expect(reachedTarget).toBe(true);

    // beforeunload triggers preventDefault when dirty
    const unloadEvent = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    window.dispatchEvent(unloadEvent);
    expect(unloadEvent.defaultPrevented).toBe(true);
  });

  it('ProtectedNav filters nav items by role/permissions and handles logout confirmation', async () => {
    mockPathname = '/student-catalog';
    const { container, rerender } = await renderClient(
      <PreferencesProvider
        initialPreferences={{ theme: 'light' }}
        initialRole="student"
        initialProfile={makeProfile({ role: 'student' })}
      >
        <SidebarProvider>
          <ProtectedNav user={makeUser()} />
        </SidebarProvider>
      </PreferencesProvider>
    );

    expect(container.textContent).toContain('Dashboard');
    expect(container.textContent).toContain('Catalog');
    expect(container.textContent).toContain('My Borrowing');
    expect(container.textContent).toContain('My Attendance');
    expect(container.textContent).not.toContain('Audit Logs');
    expect(container.textContent).not.toContain('Inventory');

    const catalogLink = container.querySelector('a[href="/student-catalog"]');
    expect(catalogLink?.getAttribute('aria-current')).toBe('page');

    // Super admin view
    mockPathname = '/audit';
    await rerender(
      <PreferencesProvider
        initialPreferences={{ theme: 'light' }}
        initialRole="super_admin"
        initialProfile={makeProfile({
          role: 'super_admin',
          permissions: {
            manage_circulation: true,
            manage_attendance: true,
            view_admin_dashboard: true,
          },
        })}
      >
        <SidebarProvider>
          <ProtectedNav user={makeUser()} />
        </SidebarProvider>
      </PreferencesProvider>
    );

    expect(container.textContent).toContain('Audit Logs');
    expect(container.textContent).toContain('Borrowing Logs');
    expect(container.textContent).not.toContain('Catalog');

    // Open account dropdown and trigger Log out dialog
    const accountTrigger = findButtonByText(container, 'Ada Lovelace');
    expect(accountTrigger).toBeDefined();
    await openRadixPopup(accountTrigger!);

    const logoutMenuItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(
      (el) => el.textContent?.includes('Log out')
    ) as HTMLElement | undefined;
    expect(logoutMenuItem).toBeDefined();
    await clickElement(logoutMenuItem);

    expect(document.body.textContent).toContain('Log out?');
    const cancelDialogBtn = findButtonByText(document.body, 'Cancel');
    await clickElement(cancelDialogBtn);
  });

  it('UserNav displays user info, role badge, opens profile/logout menu, and calls signOut on confirm', async () => {
    const sb = makeSupabaseMock();
    mockCreateClient.mockReturnValue(sb);

    const { container } = await renderClient(
      <PreferencesProvider
        initialPreferences={{ theme: 'light' }}
        initialRole="librarian"
        initialProfile={makeProfile({ full_name: 'Grace Hopper', role: 'librarian' })}
      >
        <UserNav
          user={{ email: 'grace@alabang.sti.edu.ph' }}
          profile={null}
          role={null}
        />
      </PreferencesProvider>
    );

    const trigger = container.querySelector(
      'button[aria-label="GH — account menu for Grace Hopper"]'
    ) as HTMLButtonElement;
    expect(trigger).not.toBeNull();
    await openRadixPopup(trigger);

    expect(document.body.textContent).toContain('Grace Hopper');
    expect(document.body.textContent).toContain('librarian');
    expect(document.body.textContent).toContain('grace@alabang.sti.edu.ph');
    const profileLink = document.body.querySelector('a[href="/profile"]');
    expect(profileLink).not.toBeNull();

    const logoutItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(
      (el) => el.textContent?.includes('Log out')
    ) as HTMLElement | undefined;
    await clickElement(logoutItem);

    expect(document.body.textContent).toContain('You will be signed out of your current session.');
    const confirmLogoutBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Log out'
    );
    await clickElement(confirmLogoutBtn);
    expect(sb.auth.signOut).toHaveBeenCalled();
  });
});

// ===========================================================================
// 3. Notifications Components
// ===========================================================================
describe('Notification Components', () => {
  it('NotificationList renders error/retry, loading, empty, and populated states', async () => {
    const onRetry = vi.fn();
    const onMarkRead = vi.fn();
    const onOpen = vi.fn();

    // Error state
    const { container, rerender } = await renderClient(
      <NotificationList
        notifications={[]}
        loading={false}
        onMarkRead={onMarkRead}
        error="Failed to load"
        onRetry={onRetry}
      />
    );
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Failed to load');
    await clickElement(findButtonByText(container, 'Retry'));
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Loading state
    await rerender(
      <NotificationList
        notifications={[]}
        loading={true}
        onMarkRead={onMarkRead}
      />
    );
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Loading...');

    // Empty state
    await rerender(
      <NotificationList
        notifications={[]}
        loading={false}
        onMarkRead={onMarkRead}
        emptyMessage="Inbox zero"
      />
    );
    expect(container.textContent).toContain('Inbox zero');

    // Populated state
    const notif = makeNotification({ id: 'n-1', title: 'Overdue Notice', is_read: false });
    await rerender(
      <NotificationList
        notifications={[notif]}
        loading={false}
        onMarkRead={onMarkRead}
        onOpen={onOpen}
        variant="compact"
      />
    );
    const markBtn = container.querySelector('button[title="Mark as read"]');
    await clickElement(markBtn);
    expect(onMarkRead).toHaveBeenCalledWith('n-1');

    const openBtn = findButtonByText(container, 'Overdue Notice');
    await clickElement(openBtn);
    expect(onOpen).toHaveBeenCalledWith(notif);
  });

  it('NotificationDetailsDialog displays details, type link, and closes on Close button', async () => {
    const onClose = vi.fn();
    const notif = makeNotification({
      id: 'n-2',
      title: 'Reservation Ready',
      content: 'Pick up your reserved book at Counter 1.',
      type: 'RESERVATION',
    });

    const { rerender } = await renderClient(
      <NotificationDetailsDialog notification={null} onClose={onClose} />
    );
    expect(document.body.textContent).not.toContain('Reservation Ready');

    await rerender(
      <NotificationDetailsDialog notification={notif} onClose={onClose} />
    );
    expect(document.body.textContent).toContain('Reservation Ready');
    expect(document.body.textContent).toContain('Pick up your reserved book at Counter 1.');
    expect(document.body.textContent).toContain('RESERVATION');
    const openLink = document.body.querySelector('a[href="/student-catalog"]');
    expect(openLink).not.toBeNull();

    // SYSTEM notification has no Open link
    await rerender(
      <NotificationDetailsDialog
        notification={makeNotification({ type: 'SYSTEM', title: 'Maintenance' })}
        onClose={onClose}
      />
    );
    expect(document.body.querySelector('a[href="/student-catalog"]')).toBeNull();

    await clickElement(findButtonByText(document.body, 'Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('NotificationBell shows badge (including 9+ cap), opens modal, opens details dialog, marks all read, and retries errors', async () => {
    const notifs = [
      makeNotification({ id: 'n-1', title: 'Hold Ready', type: 'RESERVATION', is_read: false }),
      makeNotification({ id: 'n-2', title: 'System Update', type: 'SYSTEM', is_read: true }),
    ];
    const sb = makeSupabaseMock({ notifications: notifs, unreadCount: 12 });
    mockCreateClient.mockReturnValue(sb);

    const { container } = await renderClient(<NotificationBell />);
    await act(async () => {
      await Promise.resolve();
    });

    const bellBtn = container.querySelector(
      'button[aria-label="Notifications, 12 unread"]'
    );
    expect(bellBtn).not.toBeNull();
    expect(bellBtn?.textContent).toContain('9+');

    await clickElement(bellBtn);
    expect(document.body.textContent).toContain('12 new events');
    expect(document.body.textContent).toContain('Hold Ready');

    // Clicking unread item opens details dialog & marks read
    await clickElement(findButtonByText(document.body, 'Hold Ready'));
    expect(document.body.textContent).toContain('Open');

    // Close details dialog
    const closeDetailsBtns = Array.from(document.body.querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === 'Close'
    );
    await clickElement(closeDetailsBtns[closeDetailsBtns.length - 1]);

    // Mark all read
    const markAllBtn = findButtonByText(document.body, 'Mark all read');
    await clickElement(markAllBtn);
    expect(sb.from).toHaveBeenCalledWith('notifications');

    // Expand Activity Log link closes dialog
    const expandLink = document.body.querySelector('a[href="/notifications"]');
    expect(expandLink).not.toBeNull();
    expandLink?.addEventListener('click', (e) => e.preventDefault());
    await clickElement(expandLink);
  });

  it('NotificationBell displays error state, retries fetch on Retry click, and refreshes on focus/visibilitychange', async () => {
    const errSb = makeSupabaseMock({ notifError: { message: 'DB unavailable' } });
    mockCreateClient.mockReturnValue(errSb);

    const { container, unmount } = await renderClient(<NotificationBell />);
    await act(async () => {
      await Promise.resolve();
    });

    await clickElement(container.querySelector('button[aria-label="Notifications"]'));
    expect(document.body.textContent).toContain("Notifications couldn't be loaded.");

    // Switch mock to succeed and click Retry
    const okSb = makeSupabaseMock({
      notifications: [makeNotification({ id: 'n-ok', title: 'Restored Alert' })],
      unreadCount: 1,
    });
    // Reuse same supabase instance behavior via from mock on errSb
    errSb.from = okSb.from;
    await clickElement(findButtonByText(document.body, 'Retry'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.body.textContent).toContain('Restored Alert');

    // Window focus refreshes notifications when document is visible
    const callsBeforeFocus = (errSb.from as ReturnType<typeof vi.fn>).mock.calls.length;
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });
    expect((errSb.from as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      callsBeforeFocus
    );

    // Cleanup removes event listeners on unmount
    unmount();
    const callsAfterUnmount = (errSb.from as ReturnType<typeof vi.fn>).mock.calls.length;
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect((errSb.from as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsAfterUnmount);
  });
});

// ===========================================================================
// 4. Provider Components
// ===========================================================================
describe('Provider Components', () => {
  it('AnimationProvider enables framer-motion m.div rendering under strict LazyMotion', async () => {
    const { container } = await renderClient(
      <AnimationProvider>
        <m.div data-testid="animated-box" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          Motion Ready
        </m.div>
      </AnimationProvider>
    );
    expect(container.querySelector('[data-testid="animated-box"]')?.textContent).toBe(
      'Motion Ready'
    );
  });

  it('BatchTaskProvider throws outside provider and manages queued ISBN import polling, logs, and dismiss', async () => {
    function BadConsumer() {
      useBatchTask();
      return null;
    }
    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderClient(<BadConsumer />)).rejects.toThrow(
      'useBatchTask must be used within a BatchTaskProvider'
    );
    consoleErrSpy.mockRestore();

    function BatchTester() {
      const { isISBNProcessing, isbnLogs, startISBNLookup } = useBatchTask();
      return (
        <div>
          <span data-testid="processing">{String(isISBNProcessing)}</span>
          <span data-testid="log-count">{isbnLogs.length}</span>
          <button
            type="button"
            onClick={() => startISBNLookup([])}
          >
            Start Empty
          </button>
          <button
            type="button"
            onClick={() => startISBNLookup(['111', '222', '333'])}
          >
            Start Batch
          </button>
        </div>
      );
    }

    // Non-staff role does not fetch import jobs or start lookups
    const nonStaffRender = await renderClient(
      <PreferencesProvider
        initialPreferences={{ theme: 'light' }}
        initialRole="student"
        initialProfile={makeProfile({ role: 'student' })}
      >
        <BatchTaskProvider>
          <BatchTester />
        </BatchTaskProvider>
      </PreferencesProvider>
    );
    await clickElement(findButtonByText(nonStaffRender.container, 'Start Batch'));
    expect(fetchSpy).not.toHaveBeenCalledWith('/api/catalog/import-jobs', expect.anything());
    cleanupClients();

    // Staff role manages queued import jobs + 3s interval polling
    let phase: 'empty' | 'active' | 'done' = 'empty';
    const activeJob = {
      id: 'job-1',
      label: 'Batch ISBN import',
      created_at: '2026-11-14T00:00:00Z',
      items: [
        {
          id: 'it-1',
          isbn: '111',
          book_id: null,
          status: 'processing',
          metadata_status: 'pending',
          cover_status: 'pending',
          title: null,
          attempts: 1,
          error: null,
          next_attempt_at: null,
        },
        {
          id: 'it-2',
          isbn: '222',
          book_id: null,
          status: 'queued',
          metadata_status: 'pending',
          cover_status: 'pending',
          title: null,
          attempts: 0,
          error: null,
          next_attempt_at: null,
        },
      ],
    };
    const finishedJob = {
      id: 'job-1',
      label: 'Batch ISBN import',
      created_at: '2026-11-14T00:00:00Z',
      items: [
        {
          id: 'it-1',
          isbn: '111',
          book_id: 'book-1',
          status: 'complete',
          metadata_status: 'complete',
          cover_status: 'complete',
          title: 'Dune',
          attempts: 1,
          error: null,
          next_attempt_at: null,
        },
        {
          id: 'it-2',
          isbn: '222',
          book_id: 'book-2',
          status: 'review',
          metadata_status: 'missing',
          cover_status: 'complete',
          title: 'Foundation',
          attempts: 1,
          error: null,
          next_attempt_at: null,
        },
        {
          id: 'it-3',
          isbn: '333',
          book_id: null,
          status: 'failed',
          metadata_status: 'missing',
          cover_status: 'missing',
          title: null,
          attempts: 3,
          error: 'Not found',
          next_attempt_at: null,
        },
      ],
    };

    fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/catalog/import-jobs' && init?.method === 'POST') {
        phase = 'active';
        return { ok: true, json: async () => ({ jobId: 'job-1' }) };
      }
      if (url === '/api/catalog/import-jobs/process') {
        return { ok: true, json: async () => ({ ok: true }) };
      }
      if (url === '/api/catalog/import-jobs') {
        return {
          ok: true,
          json: async () => ({
            jobs: phase === 'empty' ? [] : phase === 'active' ? [activeJob] : [finishedJob],
          }),
        };
      }
      return { ok: true, json: async () => ({ preferences: { theme: 'light' } }) };
    });

    vi.useFakeTimers();
    try {
      const { container } = await renderClient(
        <PreferencesProvider
          initialPreferences={{ theme: 'light' }}
          initialRole="librarian"
          initialProfile={makeProfile({ role: 'librarian', status: 'ACTIVE' })}
        >
          <BatchTaskProvider>
            <BatchTester />
          </BatchTaskProvider>
        </PreferencesProvider>
      );

      // Empty ISBN list shows validation error
      await clickElement(findButtonByText(container, 'Start Empty'));
      expect(mockToastError).toHaveBeenCalledWith('Enter between 1 and 500 ISBN entries per import.');

      // Submit batch job
      await clickElement(findButtonByText(container, 'Start Batch'));
      expect(mockToastInfo).toHaveBeenCalledWith(
        'Import saved to the queue. You can close this tab while it runs.'
      );
      expect(container.querySelector('[data-testid="processing"]')?.textContent).toBe('true');
      expect(container.textContent).toContain('Catalog import in progress');
      expect(container.textContent).toContain('0 of 2 finished');

      // Advance 3s interval poll -> job completes with attention warning
      phase = 'done';
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(container.querySelector('[data-testid="processing"]')?.textContent).toBe('false');
      expect(container.querySelector('[data-testid="log-count"]')?.textContent).toBe('3');
      expect(container.textContent).toContain('Catalog import needs attention');
      expect(container.textContent).toContain('1 complete · 1 need review · 1 failed');
      expect(mockToastWarning).toHaveBeenCalledWith(
        'Catalog import finished with items needing attention. Review metadata and covers.'
      );
      expect(mockRouterRefresh).toHaveBeenCalled();

      // Expand details drawer
      await clickElement(container.querySelector('button[aria-label="Expand import details"]'));
      expect(container.textContent).toContain('111 — Dune: complete. Metadata: complete. Cover: complete.');
      expect(container.textContent).toContain('222 — Foundation: review. Metadata: missing. Cover: complete.');
      expect(container.textContent).toContain('333: failed. Metadata: missing. Cover: missing. Not found');
      expect(findButtonByText(container, 'Retry failed items')).toBeDefined();

      // Dismiss completed import banner
      await clickElement(container.querySelector('button[aria-label="Dismiss completed import"]'));
      expect(container.textContent).not.toContain('Catalog import needs attention');
    } finally {
      cleanupClients();
      vi.useRealTimers();
    }
  });

  it('PreferencesProvider loads from Promise/fetch, updates preferences optimistically, computes currentMode, and handles realtime profile updates', async () => {
    function PrefConsumer() {
      const { preferences, loading, role, currentMode, updatePreferences } =
        usePreferences();
      return (
        <div>
          <span data-testid="outside-mode">{currentMode}</span>
          <span data-testid="pref-loading">{String(loading)}</span>
          <span data-testid="pref-role">{String(role)}</span>
          <span data-testid="pref-theme">{String(preferences.theme ?? 'none')}</span>
          <button
            type="button"
            onClick={() => updatePreferences({ theme: 'dark' })}
          >
            Set Dark
          </button>
        </div>
      );
    }

    // Outside provider uses fallbackContext
    const { container, rerender } = await renderClient(<PrefConsumer />);
    expect(container.querySelector('[data-testid="outside-mode"]')?.textContent).toBe('student');

    // Promise hydration + realtime update + updatePreferences
    const sb = makeSupabaseMock();
    mockCreateClient.mockReturnValue(sb);

    const prefPromise = Promise.resolve({ theme: 'sepia' });
    await rerender(
      <PreferencesProvider
        initialPreferences={prefPromise}
        initialRole="student_assistant"
        initialProfile={makeProfile({
          role: 'student_assistant',
          status: 'SUSPENDED',
          permissions: {
            manage_circulation: true,
            manage_attendance: false,
            view_admin_dashboard: false,
          },
        })}
        user={makeUser()}
      >
        <PrefConsumer />
      </PreferencesProvider>
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="pref-theme"]')?.textContent).toBe('sepia');
    // Deactivated SA falls back to student mode
    expect(container.querySelector('[data-testid="outside-mode"]')?.textContent).toBe('student');

    // Realtime profile UPDATE promotes to ACTIVE librarian -> staff mode
    const profileChannel = registeredChannels.find((c) => c.name === 'app-profile-user-1');
    const updateCb = profileChannel?.handlers[0]?.callback;
    await act(async () => {
      updateCb?.({
        new: {
          ...makeProfile({ role: 'librarian', status: 'ACTIVE' }),
        },
      });
    });
    expect(container.querySelector('[data-testid="pref-role"]')?.textContent).toBe('librarian');
    expect(container.querySelector('[data-testid="outside-mode"]')?.textContent).toBe('staff');

    // PATCH updatePreferences succeeds
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ preferences: { theme: 'dark' } }),
    });
    await clickElement(findButtonByText(container, 'Set Dark'));
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/ui-preferences',
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(container.querySelector('[data-testid="pref-theme"]')?.textContent).toBe('dark');

    // PATCH failure triggers fallback refreshPreferences fetch
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchSpy
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ preferences: { theme: 'light' } }),
      });
    await clickElement(findButtonByText(container, 'Set Dark'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="pref-theme"]')?.textContent).toBe('light');
    consoleErr.mockRestore();
  });
});

// ===========================================================================
// 5. Landing, Hero, and EnvVarWarning Components
// ===========================================================================
describe('Landing, Hero & EnvVarWarning Components', () => {
  it('BookArt renders decorative SVG paths and ribbon', async () => {
    const { container } = await renderClient(<BookArt />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelectorAll('path').length).toBeGreaterThan(5);
  });

  it('ScrollProgress sets --p inside a section and cleans up on unmount, respecting reduced motion', async () => {
    const { container, unmount } = await renderClient(
      <section>
        <ScrollProgress className="progress-box">
          <span>Artwork</span>
        </ScrollProgress>
      </section>
    );

    const box = container.querySelector('.progress-box') as HTMLDivElement;
    expect(lastIntersectionObserver?.observed).toContain(container.querySelector('section'));
    expect(box.style.getPropertyValue('--p')).not.toBe('');

    unmount();
    expect(lastIntersectionObserver?.disconnected).toBe(true);
    expect(box.style.getPropertyValue('--p')).toBe('');

    // Reduced motion skips setting --p
    mockReducedMotion = true;
    const { container: reducedContainer } = await renderClient(
      <section>
        <ScrollProgress className="reduced-box">
          <span>Static</span>
        </ScrollProgress>
      </section>
    );
    const reducedBox = reducedContainer.querySelector('.reduced-box') as HTMLDivElement;
    expect(reducedBox.style.getPropertyValue('--p')).toBe('');
  });

  it('Hero renders signed-in dashboard link or Microsoft + demo sign-in actions', async () => {
    const { container, rerender } = await renderClient(
      <Hero user={makeUser()} role="librarian" />
    );

    expect(container.querySelector('a[href="/dashboard"]')?.textContent).toContain(
      'Go to Dashboard'
    );
    expect(container.textContent).toContain(
      'Signed in as Ada Lovelace with the librarian role.'
    );

    // Unauthenticated with demo mode: OAuth error resets loading state
    const sb = makeSupabaseMock({ oauthError: { message: 'Azure error' } });
    mockCreateClient.mockReturnValue(sb);

    await rerender(<Hero user={null} role={null} showDemo={true} />);
    await clickElement(findButtonByText(container, 'Sign in with Microsoft'));
    expect(sb.auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'azure' })
    );
    expect(mockToastError).toHaveBeenCalledWith('Microsoft sign-in failed');

    // Demo login error resets loading state
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Demo disabled' }),
    });
    await clickElement(findButtonByText(container, 'Student'));
    expect(mockToastError).toHaveBeenCalledWith('Demo disabled');

    // Demo login success
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await clickElement(findButtonByText(container, 'Super Admin'));
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/demo-login',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockToastSuccess).toHaveBeenCalledWith('Successfully logged in!');
    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it('EnvVarWarning renders warning badge and disabled Sign in / Sign up buttons', async () => {
    const { container } = await renderClient(<EnvVarWarning />);
    expect(container.textContent).toContain('Supabase environment variables required');
    const signInBtn = findButtonByText(container, 'Sign in');
    const signUpBtn = findButtonByText(container, 'Sign up');
    expect(signInBtn?.disabled).toBe(true);
    expect(signUpBtn?.disabled).toBe(true);
  });
});

// ===========================================================================
// 6. UI Primitives (components/ui/*)
// ===========================================================================
describe('UI Primitives', () => {
  it('Avatar, Badge, Card, CardAction, Separator, Skeleton, MicrosoftIcon render expected structure & variants', async () => {
    const onCardClick = vi.fn();
    const { container } = await renderClient(
      <div>
        <AvatarGroup>
          <Avatar size="lg">
            <AvatarImage src="/a.png" alt="User A" />
            <AvatarFallback>UA</AvatarFallback>
            <AvatarBadge />
          </Avatar>
          <AvatarGroupCount>+3</AvatarGroupCount>
        </AvatarGroup>

        <Badge variant="destructive">Overdue</Badge>
        <Badge variant="outline">Draft</Badge>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Details</CardDescription>
          </CardHeader>
          <CardContent>Body</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>

        <CardLink href="/books">Book Link</CardLink>
        <CardButton onClick={onCardClick}>Book Action</CardButton>

        <Separator orientation="vertical" />
        <Skeleton className="h-4 w-20" />
        <MicrosoftIcon aria-label="MS Logo" />
      </div>
    );

    expect(container.querySelector('[data-slot="avatar"]')?.getAttribute('data-size')).toBe('lg');
    expect(container.querySelector('[data-slot="avatar-badge"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="avatar-group-count"]')?.textContent).toBe('+3');
    expect(container.textContent).toContain('Overdue');
    expect(container.textContent).toContain('Summary');
    expect(container.querySelector('a[href="/books"]')?.textContent).toBe('Book Link');

    await clickElement(findButtonByText(container, 'Book Action'));
    expect(onCardClick).toHaveBeenCalledTimes(1);

    expect(
      container.querySelector('[data-slot="separator"]')?.getAttribute('data-orientation')
    ).toBe('vertical');
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
    expect(container.querySelectorAll('svg[aria-label="MS Logo"] rect')).toHaveLength(4);
  });

  it('Select opens options and updates selected value', async () => {
    const onValueChange = vi.fn();
    const { container } = await renderClient(
      <Select defaultValue="books" onValueChange={onValueChange}>
        <SelectTrigger aria-label="Category filter" size="sm">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Types</SelectLabel>
            <SelectItem value="books">Books</SelectItem>
            <SelectSeparator />
            <SelectItem value="journals">Journals</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );

    const trigger = container.querySelector('[data-slot="select-trigger"]') as HTMLElement;
    expect(trigger.getAttribute('data-size')).toBe('sm');
    await openRadixPopup(trigger);

    const journalsOpt = Array.from(document.body.querySelectorAll('[role="option"]')).find(
      (el) => el.textContent?.includes('Journals')
    ) as HTMLElement | undefined;
    expect(journalsOpt).toBeDefined();
    await clickElement(journalsOpt);
    expect(onValueChange).toHaveBeenCalledWith('journals');
  });

  it('Slider renders thumbs and responds to keyboard ArrowRight', async () => {
    const onValueChange = vi.fn();
    const { container } = await renderClient(
      <Slider
        defaultValue={[20, 80]}
        min={0}
        max={100}
        step={5}
        aria-label="Loan limit"
        onValueChange={onValueChange}
      />
    );

    const thumbs = container.querySelectorAll('[data-slot="slider-thumb"]');
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0].getAttribute('aria-label')).toBe('Loan limit');

    await pressKey(thumbs[0], 'ArrowRight');
    expect(onValueChange).toHaveBeenCalledWith([25, 80]);
  });

  it('Switch toggles checked state and Textarea binds FieldControlIdContext and handles input', async () => {
    const onCheckedChange = vi.fn();
    const onTextChange = vi.fn();

    const { container } = await renderClient(
      <div>
        <Switch aria-label="Enable holds" onCheckedChange={onCheckedChange} />
        <FieldControlIdContext.Provider value="notes-field">
          <Textarea placeholder="Notes" onChange={(e) => onTextChange(e.target.value)} />
        </FieldControlIdContext.Provider>
      </div>
    );

    const sw = container.querySelector('button[role="switch"]') as HTMLButtonElement;
    expect(sw.getAttribute('data-state')).toBe('unchecked');
    await clickElement(sw);
    expect(sw.getAttribute('data-state')).toBe('checked');
    expect(onCheckedChange).toHaveBeenCalledWith(true);

    const textarea = container.querySelector('textarea#notes-field') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    await typeIntoInput(textarea, 'Reserved for thesis');
    expect(onTextChange).toHaveBeenCalledWith('Reserved for thesis');
  });

  it('Tabs switches active tab and content panel on click', async () => {
    const { container } = await renderClient(
      <Tabs defaultValue="tab1">
        <TabsList variant="line">
          <TabsTrigger value="tab1">Overview</TabsTrigger>
          <TabsTrigger value="tab2">Copies</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Overview Panel</TabsContent>
        <TabsContent value="tab2">Copies Panel</TabsContent>
      </Tabs>
    );

    expect(container.textContent).toContain('Overview Panel');
    const tab2 = findButtonByText(container, 'Copies') as HTMLElement;
    await pressKey(tab2, 'Enter');
    await act(async () => {
      tab2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    });
    expect(container.textContent).toContain('Copies Panel');
  });

  it('DropdownMenu opens and handles item, checkbox item, and radio group selection', async () => {
    const onItemSelect = vi.fn();
    const onCheckedChange = vi.fn();
    const onRadioChange = vi.fn();

    const { container } = await renderClient(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">Menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onItemSelect}>
              Export <DropdownMenuShortcut>Ctrl+E</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuCheckboxItem checked={false} onCheckedChange={onCheckedChange}>
              Include Archived
            </DropdownMenuCheckboxItem>
          </DropdownMenuGroup>
          <DropdownMenuRadioGroup value="asc" onValueChange={onRadioChange}>
            <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="desc">Descending</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );

    await openRadixPopup(findButtonByText(container, 'Menu')!);
    expect(document.body.textContent).toContain('Ctrl+E');

    const checkboxItem = document.body.querySelector(
      '[role="menuitemcheckbox"]'
    ) as HTMLElement;
    await clickElement(checkboxItem);
    expect(onCheckedChange).toHaveBeenCalledWith(true);

    await openRadixPopup(findButtonByText(container, 'Menu')!);
    const descItem = Array.from(document.body.querySelectorAll('[role="menuitemradio"]')).find(
      (el) => el.textContent?.includes('Descending')
    ) as HTMLElement;
    await clickElement(descItem);
    expect(onRadioChange).toHaveBeenCalledWith('desc');

    await openRadixPopup(findButtonByText(container, 'Menu')!);
    const exportItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find(
      (el) => el.textContent?.includes('Export')
    ) as HTMLElement;
    await clickElement(exportItem);
    expect(onItemSelect).toHaveBeenCalled();
  });

  it('Sheet opens from trigger, renders Header/Footer/Title/Description, and closes via SheetClose', async () => {
    const { container } = await renderClient(
      <Sheet>
        <SheetTrigger asChild>
          <button type="button">Open Sheet</button>
        </SheetTrigger>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Narrow catalog results</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <SheetClose asChild>
              <button type="button">Done</button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );

    await clickElement(findButtonByText(container, 'Open Sheet'));
    expect(document.body.textContent).toContain('Filters');
    expect(document.body.textContent).toContain('Narrow catalog results');

    await clickElement(findButtonByText(document.body, 'Done'));
    expect(document.body.textContent).not.toContain('Narrow catalog results');
  });

  it('Sidebar primitives toggle desktop state, handle Ctrl+B shortcut, render mobile sheet, and throw outside provider', async () => {
    function BadSidebarConsumer() {
      useSidebar();
      return null;
    }
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderClient(<BadSidebarConsumer />)).rejects.toThrow(
      'useSidebar must be used within a SidebarProvider.'
    );
    errSpy.mockRestore();

    const { container, rerender } = await renderClient(
      <SidebarProvider defaultOpen={true}>
        <Sidebar collapsible="icon">
          <SidebarHeader>
            <SidebarInput placeholder="Filter menu" />
          </SidebarHeader>
          <SidebarSeparator />
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Library</SidebarGroupLabel>
              <SidebarGroupAction aria-label="Add group">+</SidebarGroupAction>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive tooltip="Catalog">
                      <span>Catalog</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction aria-label="Menu action">*</SidebarMenuAction>
                    <SidebarMenuBadge>4</SidebarMenuBadge>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton href="/books" isActive>
                          Books
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </SidebarMenuItem>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>Footer</SidebarFooter>
          <SidebarRail />
        </Sidebar>
        <SidebarInset>
          <SidebarTrigger />
        </SidebarInset>
      </SidebarProvider>
    );

    const sidebar = container.querySelector('[data-slot="sidebar"]');
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');
    expect(container.querySelector('[data-slot="sidebar-menu-badge"]')?.textContent).toBe('4');

    // Toggle via SidebarTrigger
    await clickElement(container.querySelector('[data-slot="sidebar-trigger"]'));
    expect(sidebar?.getAttribute('data-state')).toBe('collapsed');

    // Toggle back via Ctrl+B
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, bubbles: true })
      );
    });
    expect(sidebar?.getAttribute('data-state')).toBe('expanded');

    // Non-collapsible sidebar mode
    await rerender(
      <SidebarProvider>
        <Sidebar collapsible="none">
          <span>Static Sidebar</span>
        </Sidebar>
      </SidebarProvider>
    );
    expect(container.textContent).toContain('Static Sidebar');

    // Mobile viewport renders Sheet-backed sidebar when triggered
    mockMobileViewport = true;
    const { container: mobileContainer } = await renderClient(
      <SidebarProvider>
        <Sidebar>
          <span>Mobile Menu Content</span>
        </Sidebar>
        <SidebarTrigger />
      </SidebarProvider>
    );
    await clickElement(mobileContainer.querySelector('[data-slot="sidebar-trigger"]'));
    expect(document.body.textContent).toContain('Mobile Menu Content');
  });

  it('EmptyState renders href action link and click action button', async () => {
    const onAction = vi.fn();
    const { container, rerender } = await renderClient(
      <EmptyState
        icon={BookOpen}
        title="No Books"
        description="Add your first book."
        action={{ label: 'Add Book', href: '/inventory/add', icon: Plus }}
      />
    );
    expect(container.textContent).toContain('No Books');
    expect(container.querySelector('a[href="/inventory/add"]')?.textContent).toContain(
      'Add Book'
    );

    await rerender(
      <EmptyState
        icon={BookOpen}
        title="Empty"
        description="Nothing here."
        action={{ label: 'Reload', onClick: onAction }}
      />
    );
    await clickElement(findButtonByText(container, 'Reload'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
