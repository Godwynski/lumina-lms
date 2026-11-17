import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderClient,
  cleanupClients,
  clickElement,
  typeIntoInput,
} from './helpers/render';

// --- External boundary mocks ---
const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouterRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    refresh: mockRouterRefresh,
  }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/profile',
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

const mockCreateBrowserClient = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateBrowserClient(),
}));

vi.mock('@/lib/actions/profile', () => ({
  updateAvatarUrl: vi.fn(),
}));

// Components under test
import { CategoryDialog } from '@/components/admin/categories/CategoryDialog';
import { PolicyField } from '@/components/admin/policies/PolicyField';
import { PolicyLayout } from '@/components/admin/policies/PolicyLayout';
import { PersonalInfoForm } from '@/components/settings/profile/PersonalInfoForm';
import { ProfileSection } from '@/components/settings/sections/ProfileSection';
import { SecuritySection } from '@/components/settings/sections/SecuritySection';
import { PreferencesProvider } from '@/components/providers/PreferencesProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotificationsPage from '@/app/(authenticated)/notifications/page';
import { DEFAULT_POLICIES } from '@/lib/actions/policy-constants';
import type { Category, PolicySetting } from '@/types/admin';

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

function makeNotificationsSupabaseMock({
  notifications = [] as Array<{
    id: string;
    user_id: string;
    title: string;
    content: string;
    type: string;
    priority: string;
    is_read: boolean;
    metadata: Record<string, unknown>;
    created_at: string;
  }>,
  unreadCount = 0,
  onDelete = vi.fn() as (filters: Array<[string, unknown]>) => void,
} = {}) {
  const channelObj = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };

  const makeQuery = () => {
    const state = { head: false, orFilter: '', deleting: false, filters: [] as Array<[string, unknown]> };
    const builder: Record<string, unknown> = {
      select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
        state.head = Boolean(opts?.head);
        return builder;
      },
      delete: () => {
        state.deleting = true;
        return builder;
      },
      eq: (col: string, val: unknown) => {
        state.filters.push([col, val]);
        return builder;
      },
      lt: () => builder,
      or: (f: string) => {
        state.orFilter = f;
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      update: () => builder,
      then: (resolve: (val: unknown) => void) => {
        if (state.deleting) {
          onDelete(state.filters);
          return Promise.resolve({ error: null }).then(resolve);
        }
        if (state.head) {
          return Promise.resolve({ count: unreadCount, error: null }).then(resolve);
        }
        if (state.orFilter) {
          const filtered = notifications.filter((n) =>
            n.title.toLowerCase().includes('overdue') || n.content.toLowerCase().includes('overdue')
          );
          return Promise.resolve({ data: filtered, error: null }).then(resolve);
        }
        return Promise.resolve({ data: notifications, error: null }).then(resolve);
      },
    };
    return builder;
  };

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1', email: 'patron@lumina.edu' } } },
      }),
    },
    from: vi.fn(() => makeQuery()),
    channel: vi.fn().mockReturnValue(channelObj),
    removeChannel: vi.fn(),
  };
}

describe('B7 — Settings, Policies, Profile & Notifications UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateBrowserClient.mockReturnValue(makeNotificationsSupabaseMock());
  });

  afterEach(() => {
    cleanupClients();
    vi.useRealTimers();
  });

  it('CategoryDialog focuses #name on open without obstructive tooltip triggers', async () => {
    await renderClient(
      <CategoryDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        editingId={null}
        formData={{ name: '', slug: '', description: '' }}
        setFormData={vi.fn()}
        onSave={vi.fn()}
        loading={false}
        error={null}
      />
    );

    const nameInput = document.body.querySelector('#name') as HTMLInputElement;
    expect(nameInput).not.toBeNull();
    expect(document.activeElement).toBe(nameInput);
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
    expect(document.body).toHaveTextContent('Add Category');
  });

  it('PolicyField displays human-readable description and hides raw DB keys', async () => {
    const { container } = await renderClient(
      <TooltipProvider>
        <PolicyField
          policyKey="loan_period_days"
          value="14"
          initialValue="14"
          onChange={vi.fn()}
          disabled={false}
          loading={false}
        />
      </TooltipProvider>
    );

    expect(container).toHaveTextContent('Borrowing Duration');
    expect(container).toHaveTextContent(DEFAULT_POLICIES.loan_period_days.description);
    expect(container.textContent).not.toContain('loan_period_days');
    expect(container.textContent).not.toContain('LOAN_PERIOD_DAYS');
  });

  it('PolicyLayout uses wrapping category pills on mobile/tablet so categories do not clip', async () => {
    const settings: PolicySetting[] = [
      { id: 's1', key: 'loan_period_days', value: '14', description: '', updated_at: '' },
    ];
    const categories: Category[] = [
      { id: 'c1', name: 'Science', slug: 'science', is_active: true },
    ];

    const { container } = await renderClient(
      <PolicyLayout
        settings={settings}
        canEdit={true}
        role="super_admin"
        categoriesPromise={Promise.resolve(categories)}
      />
    );

    const pillWrapper = container.querySelector('.flex.flex-wrap.gap-2');
    expect(pillWrapper).not.toBeNull();
    expect(pillWrapper).toHaveTextContent('Categories');
    expect(pillWrapper).toHaveTextContent('Lifecycle');
  });

  it('PersonalInfoForm renders read-only <dl> summary list with institutional notice', async () => {
    const { container } = await renderClient(
      <PersonalInfoForm
        role="patron"
        initialProfile={{
          full_name: 'Paolo Ian Bautista',
          student_id: 'STU-20220271',
          email: 'demo.bautista.20220271@alabang.sti.edu.ph',
          status: 'ACTIVE',
        }}
        addressValue="Cupang, Muntinlupa City"
        phoneValue="+63 917 555 0104"
        departmentValue="BS Computer Science"
      />
    );

    const dl = container.querySelector('dl');
    expect(dl).not.toBeNull();
    expect(dl?.querySelectorAll('dt').length).toBeGreaterThanOrEqual(6);
    expect(dl?.querySelectorAll('dd').length).toBeGreaterThanOrEqual(6);
    expect(container).toHaveTextContent('demo.bautista.20220271@alabang.sti.edu.ph');
    expect(container).toHaveTextContent('read-only');
  });

  it('ProfileSection and SecuritySection render shared Profile/Security cross-link tabs', async () => {
    const profileHandle = await renderClient(
      <PreferencesProvider initialPreferences={{ loaded: true }}>
        <ProfileSection
          role="patron"
          initialProfile={{
            full_name: 'Patron User',
            avatar_url: null,
            address: null,
            phone: null,
            department: null,
            status: 'ACTIVE',
            student_id: 'STU-1',
            email: 'patron@lumina.edu',
          }}
        />
      </PreferencesProvider>
    );

    const profileNav = profileHandle.container.querySelector('nav[aria-label="Account settings"]');
    expect(profileNav).not.toBeNull();
    expect(profileNav?.querySelector('a[href="/profile"]')).toHaveAttribute('aria-current', 'page');
    expect(profileNav?.querySelector('a[href="/security"]')).not.toHaveAttribute('aria-current');

    profileHandle.unmount();

    const securityHandle = await renderClient(<SecuritySection role="patron" />);
    const securityNav = securityHandle.container.querySelector('nav[aria-label="Account settings"]');
    expect(securityNav).not.toBeNull();
    expect(securityNav?.querySelector('a[href="/security"]')).toHaveAttribute('aria-current', 'page');
    expect(securityNav?.querySelector('a[href="/profile"]')).not.toHaveAttribute('aria-current');
  });

  it('NotificationsPage renders inline Clear unread when unread > 0, omits it when 0, and shows empty guidance', async () => {
    const emptySb = makeNotificationsSupabaseMock({ notifications: [], unreadCount: 0 });
    mockCreateBrowserClient.mockReturnValue(emptySb);

    const emptyHandle = await renderClient(<NotificationsPage />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(emptyHandle.container).toHaveTextContent("You're all caught up");
    expect(emptyHandle.container).not.toHaveTextContent('Clear unread');
    emptyHandle.unmount();

    const populatedSb = makeNotificationsSupabaseMock({
      notifications: [
        {
          id: 'n-1',
          user_id: 'user-1',
          title: 'Book Overdue',
          content: 'Please return your book.',
          type: 'OVERDUE',
          priority: 'high',
          is_read: false,
          metadata: {},
          created_at: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    });
    mockCreateBrowserClient.mockReturnValue(populatedSb);

    const popHandle = await renderClient(<NotificationsPage />);
    await act(async () => {
      await Promise.resolve();
    });

    const clearBtn = Array.from(popHandle.container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Clear unread'
    );
    expect(clearBtn).toBeDefined();
    // Clear unread sits inside the same toolbar container as the search input
    const searchInput = popHandle.container.querySelector('input[type="search"]') as HTMLInputElement;
    expect(clearBtn?.parentElement?.contains(searchInput)).toBe(true);

    await clickElement(clearBtn);
    expect(populatedSb.from).toHaveBeenCalledWith('notifications');

    vi.useFakeTimers();
    await typeIntoInput(searchInput, 'overdue');
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    expect(popHandle.container).toHaveTextContent('Book Overdue');
  });

  it('NotificationsPage filters by type, opens details with priority, and Clear read deletes only own read rows after confirm', async () => {
    const base = { user_id: 'user-1', metadata: {}, created_at: new Date().toISOString() };
    const onDelete = vi.fn();
    const sb = makeNotificationsSupabaseMock({
      notifications: [
        { ...base, id: 'n-1', title: 'Book Overdue', content: 'Return it.', type: 'OVERDUE', priority: 'high', is_read: true },
        { ...base, id: 'n-2', title: 'Hold Ready', content: 'Pick it up.', type: 'RESERVATION', priority: 'medium', is_read: false },
        { ...base, id: 'n-3', title: 'Library Closed', content: 'Holiday.', type: 'SYSTEM', priority: 'low', is_read: true },
      ],
      unreadCount: 1,
      onDelete,
    });
    mockCreateBrowserClient.mockReturnValue(sb);
    const handle = await renderClient(<NotificationsPage />);
    await act(async () => { await Promise.resolve(); });

    // Type filter: Reservation shows only the hold notification.
    const trigger = handle.container.querySelector('[aria-label="Filter by type"]') as HTMLElement;
    expect(trigger).not.toBeNull();
    await clickElement(trigger);
    const option = Array.from(document.querySelectorAll('[role="option"]')).find(o => o.textContent === 'Reservation');
    await clickElement(option as HTMLElement);
    expect(handle.container).toHaveTextContent('Hold Ready');
    expect(handle.container).not.toHaveTextContent('Library Closed');

    // Clicking a row opens the details dialog with its priority.
    const row = Array.from(handle.container.querySelectorAll('[role="button"], button')).find(b => b.textContent?.includes('Hold Ready'));
    await clickElement(row as HTMLElement);
    expect(document.body).toHaveTextContent('medium priority');

    // Clear read: cancel does nothing, confirm deletes the caller's read rows.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const clearRead = () => Array.from(handle.container.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Clear read');
    await clickElement(clearRead()!);
    expect(onDelete).not.toHaveBeenCalled();
    await clickElement(clearRead()!);
    expect(onDelete).toHaveBeenCalledWith([['user_id', 'user-1'], ['is_read', true]]);
    confirmSpy.mockRestore();
  });
});
