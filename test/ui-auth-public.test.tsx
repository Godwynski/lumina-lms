import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderClient,
  cleanupClients,
  clickElement,
} from './helpers/render';

// --- External boundary mocks ---
const mockRouterPush = vi.fn();
const mockRouterRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    refresh: mockRouterRefresh,
  }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/',
  redirect: vi.fn(),
}));

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    onError,
    className,
    unoptimized,
  }: {
    src: string;
    alt?: string;
    onError?: () => void;
    className?: string;
    unoptimized?: boolean;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ''}
      data-unoptimized={unoptimized ? 'true' : undefined}
      onError={onError}
      className={className}
    />
  ),
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockCreateBrowserClient = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockCreateBrowserClient(),
}));

const mockCreateServerClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateServerClient(),
}));

const mockGetMe = vi.fn();
vi.mock('@/lib/auth-helpers', () => ({
  getMe: () => mockGetMe(),
}));

const mockGetPublicBookById = vi.fn();
vi.mock('@/lib/actions/public-catalog', () => ({
  getPublicBookById: (...args: unknown[]) => mockGetPublicBookById(...args),
}));

vi.mock('@/lib/demo/config', () => ({
  isDemoModeEnabled: () => true,
}));

// Components & pages under test
import AuthErrorPage from '@/app/(auth)/error/page';
import PublicBookDetailPage from '@/app/(public)/book/[id]/page';
import { PublicBookCover } from '@/components/public/PublicBookCover';
import { Hero } from '@/components/hero';
import Home from '@/app/page';

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() { return []; }
    root = null;
    rootMargin = '';
    thresholds = [];
  } as unknown as typeof IntersectionObserver;
}

describe('B8 — Auth, Landing & Public Pages UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateBrowserClient.mockReturnValue({
      auth: {
        resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
        updateUser: vi.fn().mockResolvedValue({ error: null }),
        signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      },
    });
    mockCreateServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });
    mockGetMe.mockResolvedValue(null);
  });

  afterEach(() => {
    cleanupClients();
    vi.restoreAllMocks();
  });

  it('/error uses AuthPageShell and derives dynamic subtitle per error code', async () => {
    const generic = await renderClient(
      <AuthErrorPage searchParams={Promise.resolve({})} />
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(generic.container).toHaveTextContent('Lumina LMS');
    expect(generic.container).toHaveTextContent('© 2026 Lumina LMS');
    expect(generic.container).toHaveTextContent('An unexpected sign-in error occurred.');
    expect(generic.container.textContent).not.toContain('Lumina LMS Security Protocol');
    generic.unmount();

    const restricted = await renderClient(
      <AuthErrorPage searchParams={Promise.resolve({ error: 'restricted_access' })} />
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(restricted.container).toHaveTextContent('Access is restricted to STI College Alabang accounts.');
  });

  it('/book/[id] renders left-aligned Back to Library, Sign in to Reserve CTA, and cover fallback', async () => {
    mockGetPublicBookById.mockResolvedValue({
      id: 'b-1',
      title: 'Refactoring',
      author: 'Martin Fowler',
      isbn: '9780134757599',
      available_copies: 2,
      section: 'CS-B',
      location: 'Shelf 4',
      cover_url: 'https://example.com/broken-cover.jpg',
      categories: { name: 'Computer Science' },
      tags: ['Engineering'],
    });

    const { container } = await renderClient(
      <PublicBookDetailPage params={Promise.resolve({ id: 'b-1' })} />
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    const backLink = container.querySelector('a[href="/"]') as HTMLAnchorElement;
    expect(backLink).toHaveTextContent('Back to Library');
    expect(backLink.className).toContain('inline-flex');
    expect(backLink.className).not.toMatch(/(^|\s)flex(\s|$)/);

    const reserveCta = Array.from(container.querySelectorAll('a[href="/"]')).find((a) =>
      a.textContent?.includes('Sign in to Reserve')
    );
    expect(reserveCta).toBeDefined();

    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toHaveAttribute('data-unoptimized', 'true');
    expect(img).toHaveAttribute('src', 'https://example.com/broken-cover.jpg');

    await act(async () => {
      img.dispatchEvent(new Event('error'));
    });
    expect(img).toHaveAttribute('src', '/images/default-book-cover.png');

    await act(async () => {
      img.dispatchEvent(new Event('error'));
    });
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('Refactoring');
  });

  it('PublicBookCover falls back cleanly when src is null and default cover errors', async () => {
    const { container } = await renderClient(<PublicBookCover src={null} title="SICP" />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img).toHaveAttribute('src', '/images/default-book-cover.png');
    await act(async () => {
      img.dispatchEvent(new Event('error'));
    });
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('SICP');
  });

  it('Home landing renders Quick Demo Access buttons synchronously without skeleton delay', async () => {
    mockGetMe.mockResolvedValue(null);
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchSpy);
    const { container } = await renderClient(await Home());
    expect(container).toHaveTextContent('Quick Demo Access');
    const demoLabels = ['Super Admin', 'Librarian', 'Library Staff', 'Patron'];
    for (const label of demoLabels) {
      const btn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === label
      );
      expect(btn).toBeDefined();
      expect(btn?.getAttribute('type')).toBe('button');
    }
    expect(container).toHaveTextContent('My Borrowing');
    await clickElement(Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Patron'));
    expect(fetchSpy).toHaveBeenCalledWith('/api/demo-login', expect.objectContaining({ method: 'POST' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
  });

  it('Home redirects signed-in users to /dashboard except blocked patrons; blocked staff still go in', async () => {
    const { redirect } = await import('next/navigation');
    const cases = [
      { role: 'patron', status: 'ACTIVE', redirects: true },
      { role: 'patron', status: 'SUSPENDED', redirects: false },
      { role: 'librarian', status: 'SUSPENDED', redirects: true },
      { role: 'library_staff', status: 'SUSPENDED', redirects: true },
    ];
    for (const c of cases) {
      vi.mocked(redirect).mockClear();
      mockGetMe.mockResolvedValue({
        user: { id: 'u-1' },
        role: c.role,
        profile: { id: 'u-1', role: c.role, status: c.status, onboarding_completed: true },
      });
      await Home();
      if (c.redirects) expect(redirect).toHaveBeenCalledWith('/dashboard');
      else expect(redirect).not.toHaveBeenCalled();
    }
  });

  it('Hero triggers demo sign-in and navigates to /dashboard', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchSpy);

    const { container } = await renderClient(<Hero user={null} role={null} showDemo={true} />);
    const patronBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Patron'
    );
    await clickElement(patronBtn);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/demo-login',
      expect.objectContaining({ method: 'POST' })
    );
    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
  });
});
