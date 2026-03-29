import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Mock Next.js cache
vi.mock("next/cache", () => ({
  unstable_cache: vi.fn((fn) => fn),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

// Mock React cache
vi.mock("react", async () => {
    const actual = await vi.importActual("react");
    return {
        ...actual,
        cache: <T>(fn: T): T => fn,
    }
});
