import { vi } from 'vitest';
import type { MockFn } from './supabase';

export interface MockCookieStore {
  get: MockFn;
  getAll: MockFn;
  set: MockFn;
  delete: MockFn;
  has: MockFn;
  clear: () => void;
  [key: string]: unknown;
}

/**
 * Creates a mock cookie store adhering to Next.js cookie interface.
 */
export function createMockCookieStore(
  initialCookies: Record<string, string> = {}
): MockCookieStore {
  const cookiesMap = new Map<string, string>(Object.entries(initialCookies));

  const store: MockCookieStore = {
    get: vi.fn((name: string) => {
      const value = cookiesMap.get(name);
      return value !== undefined ? { name, value } : undefined;
    }),
    getAll: vi.fn((name?: string) => {
      const all = Array.from(cookiesMap.entries()).map(([k, value]) => ({
        name: k,
        value,
      }));
      if (name) {
        return all.filter((c) => c.name === name);
      }
      return all;
    }),
    set: vi.fn((...args: unknown[]) => {
      if (typeof args[0] === 'string') {
        cookiesMap.set(args[0], String(args[1]));
      } else if (
        args[0] &&
        typeof args[0] === 'object' &&
        'name' in args[0] &&
        'value' in args[0]
      ) {
        const item = args[0] as { name: string; value: unknown };
        cookiesMap.set(item.name, String(item.value));
      }
      return store;
    }),
    delete: vi.fn((name: string) => {
      cookiesMap.delete(name);
      return store;
    }),
    has: vi.fn((name: string) => {
      return cookiesMap.has(name);
    }),
    clear: () => {
      cookiesMap.clear();
    },
  };

  return store;
}

// Next.js server cache mocks
export const revalidatePath = vi.fn((_path?: string, _type?: 'page' | 'layout') => undefined);
export const revalidateTag = vi.fn((_tag?: string) => undefined);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const unstable_cache = vi.fn(<T extends (...args: any[]) => any>(cb: T, ..._args: unknown[]): T => cb);

// Next.js server context mocks
export const after = vi.fn((task?: () => unknown) => {
  if (typeof task === 'function') {
    return task();
  }
  return undefined;
});

let currentCookieStore = createMockCookieStore();

export const cookies = vi.fn(async () => currentCookieStore);

/**
 * Updates the active cookie store returned by `cookies()`.
 */
export function setMockCookies(initialCookies: Record<string, string> = {}) {
  currentCookieStore = createMockCookieStore(initialCookies);
  cookies.mockImplementation(async () => currentCookieStore);
  return currentCookieStore;
}

/**
 * Resets all Next.js cache and server mocks to clean state.
 */
export function resetNextCacheMocks() {
  revalidatePath.mockClear();
  revalidateTag.mockClear();
  unstable_cache.mockClear();
  after.mockClear();
  cookies.mockClear();
  currentCookieStore = createMockCookieStore();
  cookies.mockImplementation(async () => currentCookieStore);
}
