import * as React from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import {
  renderClient,
  cleanupClients,
  clickElement,
} from './helpers/render';

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

let mockMobileViewport = false;
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn((query: string) => ({
    get matches() {
      return query.includes('max-width') ? mockMobileViewport : false;
    },
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  })),
});

let mockPathname = '/dashboard';
let mockSearchParamsString = '';
const mockRouterPrefetch = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: mockRouterPrefetch,
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearchParamsString),
}));

vi.mock('next/link', () => ({
  useLinkStatus: () => ({ pending: false }),
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

const mockSignOut = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signOut: mockSignOut },
    channel: () => ({
      on: function () { return this; },
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ProtectedNav } from '@/components/layout/ProtectedNav';
import { BreadcrumbNav } from '@/components/layout/BreadcrumbNav';
import { UserNav } from '@/components/layout/UserNav';
import { PreferencesProvider } from '@/components/providers/PreferencesProvider';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type NavTestProfile = NonNullable<
  React.ComponentProps<typeof PreferencesProvider>['initialProfile']
> & {
  permissions?: {
    manage_circulation?: boolean;
    manage_attendance?: boolean;
    view_admin_dashboard?: boolean;
    manage_inventory?: boolean;
  };
};

function makeProfile(overrides: Partial<NavTestProfile> = {}): NavTestProfile {
  return {
    id: 'user-1',
    full_name: 'Ada Lovelace',
    student_id: '2026-0001',
    department: 'BSCS',
    address: 'Alabang',
    phone: '09170000000',
    avatar_url: null,
    status: 'ACTIVE',
    role: 'patron',
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'ada@alabang.sti.edu.ph',
    app_metadata: {},
    user_metadata: { full_name: 'Ada Lovelace' },
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as User;
}

function getGroupLabels(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll('[data-sidebar="group-label"]')).map(
    (el) => el.textContent?.trim() || ''
  );
}

function getNavLinkLabels(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll('nav a')).map(
    (el) => el.textContent?.trim() || ''
  );
}

async function openRadixPopup(trigger: HTMLElement) {
  trigger.focus();
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await new Promise((r) => setTimeout(r, 30));
  if (document.body.querySelectorAll('[role="menuitem"]').length === 0) {
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    trigger.click();
    await new Promise((r) => setTimeout(r, 30));
  }
}

describe('B1 Shell, Nav & Tokens', () => {
  afterEach(() => {
    cleanupClients();
    mockMobileViewport = false;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    mockPathname = '/dashboard';
    mockSearchParamsString = '';
    vi.clearAllMocks();
  });

  it('ProtectedNav groups sidebar items by role and omits empty groups', async () => {
    mockPathname = '/dashboard';
    const { container, rerender } = await renderClient(
      <PreferencesProvider
        initialPreferences={{ theme: 'light' }}
        initialRole="patron"
        initialProfile={makeProfile({ role: 'patron', status: 'ACTIVE' })}
      >
        <SidebarProvider>
          <ProtectedNav user={makeUser()} />
        </SidebarProvider>
      </PreferencesProvider>
    );

    expect(getGroupLabels(container)).toEqual(['Daily', 'Records']);
    expect(getNavLinkLabels(container)).toEqual([
      'Dashboard',
      'Catalog',
      'My Borrowing',
      'My Attendance',
    ]);

    // library_staff with circulation & attendance perms (no inventory perm)
    await rerender(
      <PreferencesProvider
        initialPreferences={{ theme: 'light' }}
        initialRole="library_staff"
        initialProfile={makeProfile({
          role: 'library_staff',
          status: 'ACTIVE',
          permissions: {
            manage_circulation: true,
            manage_attendance: true,
            manage_inventory: false,
          },
        })}
      >
        <SidebarProvider>
          <ProtectedNav user={makeUser()} />
        </SidebarProvider>
      </PreferencesProvider>
    );

    expect(getGroupLabels(container)).toEqual(['Daily', 'Records']);
    expect(getNavLinkLabels(container)).toEqual([
      'Dashboard',
      'Catalog',
      'Circulation Desk',
      'My Borrowing',
      'Borrowing Logs',
      'My Attendance',
      'Attendance Logs',
    ]);

    // library_staff with manage_inventory=true shows Manage group with Inventory only
    await rerender(
      <PreferencesProvider
        initialPreferences={{ theme: 'light' }}
        initialRole="library_staff"
        initialProfile={makeProfile({
          role: 'library_staff',
          status: 'ACTIVE',
          permissions: {
            manage_inventory: true,
          },
        })}
      >
        <SidebarProvider>
          <ProtectedNav user={makeUser()} />
        </SidebarProvider>
      </PreferencesProvider>
    );

    expect(getGroupLabels(container)).toEqual(['Daily', 'Records', 'Manage']);
    expect(getNavLinkLabels(container)).toEqual([
      'Dashboard',
      'Catalog',
      'My Borrowing',
      'My Attendance',
      'Inventory',
    ]);

    // Suspended library_staff loses permission-gated items and Manage group
    await rerender(
      <PreferencesProvider
        initialPreferences={{ theme: 'light' }}
        initialRole="library_staff"
        initialProfile={makeProfile({
          role: 'library_staff',
          status: 'SUSPENDED',
          permissions: {
            manage_inventory: true,
            manage_circulation: true,
            manage_attendance: true,
          },
        })}
      >
        <SidebarProvider>
          <ProtectedNav user={makeUser()} />
        </SidebarProvider>
      </PreferencesProvider>
    );

    expect(getGroupLabels(container)).toEqual(['Daily', 'Records']);
    expect(getNavLinkLabels(container)).toEqual([
      'Dashboard',
      'Catalog',
      'My Borrowing',
      'My Attendance',
    ]);

    // librarian & super_admin see all 4 groups with canonical labels
    for (const adminRole of ['librarian', 'super_admin'] as const) {
      await rerender(
        <PreferencesProvider
          initialPreferences={{ theme: 'light' }}
          initialRole={adminRole}
          initialProfile={makeProfile({
            role: adminRole,
            status: 'ACTIVE',
          })}
        >
          <SidebarProvider>
            <ProtectedNav user={makeUser()} />
          </SidebarProvider>
        </PreferencesProvider>
      );

      expect(getGroupLabels(container)).toEqual(['Daily', 'Records', 'Manage', 'Admin']);
      expect(getNavLinkLabels(container)).toEqual([
        'Dashboard',
        'Catalog',
        'Circulation Desk',
        'Borrowing Logs',
        'Attendance Logs',
        'Inventory',
        'User Directory',
        'Analytics',
        'System Policies',
        'Audit Logs',
      ]);
      expect(container.textContent).not.toContain('Settings & Policies');
      expect(container.textContent).not.toContain('Borrow History');
    }
  });

  it('marks the Catalog link active on a book detail route and clears it on a similarly named route', async () => {
    const nav = () => (
      <PreferencesProvider initialRole="patron" initialPreferences={{}}>
        <SidebarProvider>
          <ProtectedNav user={makeUser()} />
        </SidebarProvider>
      </PreferencesProvider>
    );

    mockPathname = '/student-catalog/book-id';
    const { container, rerender } = await renderClient(nav());
    const catalogLink = container.querySelector('a[href="/student-catalog"]');
    expect(catalogLink).toHaveAttribute('aria-current', 'location');

    mockPathname = '/student-catalog-preview';
    await rerender(nav());
    expect(catalogLink).not.toHaveAttribute('aria-current');
  });

  it('ProtectedNav keeps the My Profile link available inside the mobile drawer at 375px', async () => {
    mockMobileViewport = true;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    const { container } = await renderClient(
      <PreferencesProvider
        initialPreferences={{ theme: 'light' }}
        initialRole="patron"
        initialProfile={makeProfile({ role: 'patron', status: 'ACTIVE' })}
      >
        <SidebarProvider>
          <SidebarTrigger />
          <ProtectedNav user={makeUser({ email: 'ada@alabang.sti.edu.ph' })} />
        </SidebarProvider>
      </PreferencesProvider>
    );

    await clickElement(container.querySelector('[data-sidebar="trigger"]'));

    const mobileSheet = document.body.querySelector('[data-mobile="true"]');
    expect(mobileSheet).not.toBeNull();
    expect(getGroupLabels(mobileSheet!)).toEqual(['Daily', 'Records']);

    const footer = mobileSheet!.querySelector('[data-sidebar="footer"]');
    expect(footer).not.toBeNull();
    expect(footer?.className).not.toContain('hidden');
    expect(footer?.textContent).toContain('Ada Lovelace');
    expect(footer?.textContent).toContain('ada@alabang.sti.edu.ph');

    const accountBtn = footer!.querySelector('button') as HTMLElement;
    await act(async () => {
      accountBtn.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        button: 0,
      }));
      accountBtn.click();
    });
    expect(container.querySelector('[data-sidebar="trigger"]')).toHaveAttribute('aria-expanded', 'true');
    const menu = mobileSheet!.querySelector('[role="menu"]');
    const profileLink = menu?.querySelector('a[href="/profile"]');
    expect(profileLink).toHaveTextContent('My Profile');
    expect(menu?.querySelector('a[href="/security"]')).toBeNull();
    expect(menu?.querySelector('a[href="/users"]')).toBeNull();

    profileLink?.addEventListener('click', event => event.preventDefault(), { once: true });
    await clickElement(profileLink);
    expect(container.querySelector('[data-sidebar="trigger"]')).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps mobile logout confirmation and progress inside the sidebar, and can cancel or retry', async () => {
    mockMobileViewport = true;
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });
    const { container } = await renderClient(
      <PreferencesProvider
        initialPreferences={{ theme: 'light' }}
        initialRole="patron"
        initialProfile={makeProfile({ role: 'patron', status: 'ACTIVE' })}
      >
        <SidebarProvider>
          <SidebarTrigger />
          <ProtectedNav user={makeUser()} />
        </SidebarProvider>
      </PreferencesProvider>
    );
    await clickElement(container.querySelector('[data-sidebar="trigger"]'));

    const sidebar = document.body.querySelector('[data-mobile="true"]')!;
    const account = sidebar.querySelector<HTMLButtonElement>('[data-sidebar="footer"] button')!;
    const openConfirmation = async () => {
      await act(async () => {
        account.focus();
        account.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      });
      const logout = Array.from(sidebar.querySelectorAll('[role="menuitem"]'))
        .find((item) => item.textContent?.trim() === 'Log out');
      await clickElement(logout);
      const dialog = sidebar.querySelector('[data-slot="dialog-content"]');
      expect(dialog).toHaveAccessibleName('Log out?');
      expect(sidebar.querySelector('[role="menu"]')).toBeNull();
      return dialog!;
    };

    let confirmation = await openConfirmation();
    expect(mockSignOut).not.toHaveBeenCalled();
    await clickElement(Array.from(confirmation.querySelectorAll('button')).find((button) => button.textContent === 'Cancel'));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    expect(sidebar.querySelector('[data-slot="dialog-content"]')).toBeNull();
    expect(account).toHaveFocus();
    expect(mockSignOut).not.toHaveBeenCalled();

    let rejectSignOut!: (reason: Error) => void;
    mockSignOut.mockReturnValueOnce(new Promise((_, reject) => { rejectSignOut = reject; }));
    confirmation = await openConfirmation();
    await clickElement(Array.from(confirmation.querySelectorAll('button')).find((button) => button.textContent === 'Log out'));
    expect(sidebar.querySelector('[data-slot="dialog-content"]')).toHaveAccessibleName('Logging out...');
    expect(mockSignOut).toHaveBeenCalledTimes(1);

    const logoutError = new Error('Unable to sign out');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await act(async () => { rejectSignOut(logoutError); });
      expect(consoleError).toHaveBeenCalledWith('Error during logout:', logoutError);
      expect(sidebar.querySelector('[data-slot="dialog-content"]')).toHaveAccessibleName('Log out?');
    } finally {
      consoleError.mockRestore();
    }
  });

  it('UserNav displays My Profile in the account dropdown', async () => {
    const { container } = await renderClient(
      <PreferencesProvider
        initialPreferences={{ theme: 'light' }}
        initialRole="patron"
        initialProfile={makeProfile({ role: 'patron', status: 'ACTIVE' })}
      >
        <UserNav
          user={{ email: 'ada@alabang.sti.edu.ph' }}
          profile={{ full_name: 'Ada Lovelace' }}
          role="patron"
        />
      </PreferencesProvider>
    );

    const trigger = container.querySelector('button') as HTMLElement;
    await openRadixPopup(trigger);

    const profileLink = document.body.querySelector('a[href="/profile"]');
    const securityLink = document.body.querySelector('a[href="/security"]');
    expect(profileLink?.textContent).toContain('My Profile');
    expect(profileLink?.textContent).not.toContain('Profile Settings');
    expect(securityLink).toBeNull();
  });

  it('BreadcrumbNav formats /inventory/add as Add Book and /policies as System Policies', async () => {
    mockPathname = '/inventory/add';
    const { container, rerender } = await renderClient(
      <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="librarian">
        <BreadcrumbNav />
      </PreferencesProvider>
    );
    expect(container.querySelector('h1')?.textContent).toBe('Add Book');
    const backLink = container.querySelector('a[href="/inventory"]');
    expect(backLink?.textContent).toContain('Inventory');

    mockPathname = '/policies';
    await rerender(
      <PreferencesProvider initialPreferences={{ theme: 'light' }} initialRole="librarian">
        <BreadcrumbNav />
      </PreferencesProvider>
    );
    expect(container.querySelector('h1')?.textContent).toBe('System Policies');
  });

  it('Badge and Button use standardized rounded-lg and control heights', async () => {
    const { container } = await renderClient(
      <div>
        <Badge data-testid="test-badge">Active</Badge>
        <Button size="sm">Filter</Button>
      </div>
    );

    const badge = container.querySelector('[data-testid="test-badge"]');
    const btn = container.querySelector('button');
    expect(badge?.className).toContain('rounded-lg');
    expect(btn?.className).toContain('rounded-lg');
    expect(btn?.className).toContain('h-9');
  });
});
