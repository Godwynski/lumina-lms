import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cn,
  hasEnvVars,
  sanitizeFilterInput,
  toSlug,
  formatDisplayDate,
  formatDisplayTime,
  getCategoryName,
  safeNextPath,
} from '@/lib/utils';
import { mapProfileToUser } from '@/lib/utils/mappers';
import { bustAvatarCache } from '@/lib/utils/avatar-cache';
import { compressImage, getCroppedImg } from '@/lib/image-utils';

describe('lib/utils', () => {
  describe('cn', () => {
    it('merges conditional classes and resolves Tailwind conflicts', () => {
      expect(cn('px-2 py-1', false && 'hidden', 'px-4')).toBe('py-1 px-4');
      expect(cn('text-sm', undefined, null, ['font-medium', 'text-lg'])).toBe('font-medium text-lg');
    });
  });

  describe('hasEnvVars', () => {
    it('is truthy when Supabase env vars are configured', () => {
      expect(hasEnvVars).toBeTruthy();
    });
  });

  describe('sanitizeFilterInput', () => {
    it('strips PostgREST filter-breaking characters and trims whitespace', () => {
      expect(sanitizeFilterInput('  hello, (world): "test"*\\  ')).toBe('hello world test');
      expect(sanitizeFilterInput("O'Connor-Smith 101")).toBe("O'Connor-Smith 101");
      expect(sanitizeFilterInput('a.b,c(d)e:f*g\\h"i')).toBe('abcdefghi');
    });
  });

  describe('toSlug', () => {
    it('transforms strings into lowercase URL slugs', () => {
      expect(toSlug('  Computer Science & Engineering!  ')).toBe('computer-science-engineering');
      expect(toSlug('---Hello   World---')).toBe('hello-world');
      expect(toSlug('BSIT 2026')).toBe('bsit-2026');
    });
  });

  describe('formatDisplayDate', () => {
    it('returns em-dash for null, undefined, empty, or invalid dates', () => {
      expect(formatDisplayDate(null)).toBe('—');
      expect(formatDisplayDate(undefined)).toBe('—');
      expect(formatDisplayDate('')).toBe('—');
      expect(formatDisplayDate('not-a-valid-date')).toBe('—');
      expect(formatDisplayDate(new Date('invalid'))).toBe('—');
    });

    it('formats valid Date objects and ISO strings with default and custom options', () => {
      const date = new Date('2026-01-15T12:00:00.000Z');
      expect(formatDisplayDate(date, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })).toBe(
        'Jan 15, 2026'
      );
      expect(formatDisplayDate('2026-03-05T12:00:00.000Z', { month: 'long', year: 'numeric', timeZone: 'UTC' })).toBe(
        'March 2026'
      );
    });
  });

  describe('formatDisplayTime', () => {
    it('returns em-dash for missing or invalid dates', () => {
      expect(formatDisplayTime(null)).toBe('—');
      expect(formatDisplayTime(undefined)).toBe('—');
      expect(formatDisplayTime('')).toBe('—');
      expect(formatDisplayTime('invalid-date')).toBe('—');
    });

    it('formats time in Asia/Manila by default and respects explicit timeZone', () => {
      // 00:30 UTC is 08:30 AM in Asia/Manila (UTC+8)
      expect(formatDisplayTime('2026-01-15T00:30:00.000Z')).toBe('08:30 AM');
      expect(formatDisplayTime(new Date('2026-01-15T13:45:00.000Z'))).toBe('09:45 PM');
      expect(formatDisplayTime('2026-01-15T00:30:00.000Z', 'UTC')).toBe('12:30 AM');
    });
  });

  describe('getCategoryName', () => {
    it('extracts category name from array or object shapes and defaults to Uncategorized', () => {
      expect(getCategoryName([{ name: 'Fiction' }])).toBe('Fiction');
      expect(getCategoryName({ name: 'Computer Science' })).toBe('Computer Science');
      expect(getCategoryName([])).toBe('Uncategorized');
      expect(getCategoryName([{ name: '' }])).toBe('Uncategorized');
      expect(getCategoryName({ name: '' })).toBe('Uncategorized');
      expect(getCategoryName({})).toBe('Uncategorized');
      expect(getCategoryName(null)).toBe('Uncategorized');
      expect(getCategoryName(undefined)).toBe('Uncategorized');
      expect(getCategoryName('Fiction')).toBe('Uncategorized');
    });
  });

  describe('safeNextPath', () => {
    it('allows relative same-site paths and rejects external or protocol-relative paths', () => {
      expect(safeNextPath('/books')).toBe('/books');
      expect(safeNextPath('/dashboard/my-card?tab=qr')).toBe('/dashboard/my-card?tab=qr');
      expect(safeNextPath('/')).toBe('/');

      expect(safeNextPath(null)).toBe('/dashboard');
      expect(safeNextPath('')).toBe('/dashboard');
      expect(safeNextPath('dashboard')).toBe('/dashboard');
      expect(safeNextPath('https://evil.com')).toBe('/dashboard');
      expect(safeNextPath('//evil.com')).toBe('/dashboard');
      expect(safeNextPath('/\\evil.com')).toBe('/dashboard');
      expect(safeNextPath('/@evil.com')).toBe('/dashboard');
    });
  });
});

describe('lib/utils/mappers', () => {
  it('maps complete profile row including array library_cards and permissions', () => {
    const user = mapProfileToUser({
      id: 'user-1',
      full_name: 'Maria Clara',
      email: 'maria.clara@alabang.sti.edu.ph',
      avatar_url: 'https://cdn.example.com/avatar.webp',
      role: 'librarian',
      status: 'active',
      department: 'Library Services',
      created_at: '2025-08-10T00:00:00.000Z',
      student_id: 'FAC-001',
      address: 'Alabang',
      phone: '09171234567',
      updated_at: '2026-01-01T00:00:00.000Z',
      onboarding_completed: 1,
      library_cards: [{ card_number: 'LIB-2025-1234', status: 'ACTIVE', expires_at: null }],
      permissions: { manage_circulation: true },
    });

    expect(user).toEqual({
      id: 'user-1',
      name: 'Maria Clara',
      email: 'maria.clara@alabang.sti.edu.ph',
      avatarUrl: 'https://cdn.example.com/avatar.webp',
      role: 'librarian',
      status: 'ACTIVE',
      department: 'Library Services',
      joined: new Date('2025-08-10T00:00:00.000Z').toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      }),
      student_id: 'FAC-001',
      address: 'Alabang',
      phone: '09171234567',
      updatedAt: '2026-01-01T00:00:00.000Z',
      onboarding_completed: true,
      library_card: { card_number: 'LIB-2025-1234', status: 'ACTIVE', expires_at: null },
      permissions: { manage_circulation: true },
    });
  });

  it('derives display name from email when full_name is blank and applies safe defaults', () => {
    const user = mapProfileToUser({
      email: 'juan..dela.cruz@alabang.sti.edu.ph',
      full_name: '   ',
      avatar_url: '  ',
      role: 'unknown_role',
      department: ' ',
      library_cards: { card_number: 'LIB-1', status: 'PENDING' },
    });

    expect(user.id).toBe('');
    expect(user.name).toBe('Juan  Dela Cruz');
    expect(user.avatarUrl).toBeNull();
    expect(user.role).toBe('student');
    expect(user.status).toBe('ACTIVE');
    expect(user.department).toBe('General');
    expect(user.joined).toBe('Unknown');
    expect(user.student_id).toBeNull();
    expect(user.address).toBeNull();
    expect(user.phone).toBeNull();
    expect(user.updatedAt).toBeNull();
    expect(user.onboarding_completed).toBe(false);
    expect(user.library_card).toEqual({ card_number: 'LIB-1', status: 'PENDING' });
    expect(user.permissions).toEqual({});
  });

  it('falls back to Unnamed User when both full_name and email are missing', () => {
    const user = mapProfileToUser({});
    expect(user.name).toBe('Unnamed User');
    expect(user.email).toBe('');
    expect(user.library_card).toBeNull();
  });
});

describe('lib/utils/avatar-cache', () => {
  it('returns undefined when url is empty', () => {
    expect(bustAvatarCache(null, '2026-01-01T00:00:00Z')).toBeUndefined();
    expect(bustAvatarCache(undefined, '2026-01-01T00:00:00Z')).toBeUndefined();
    expect(bustAvatarCache('', '2026-01-01T00:00:00Z')).toBeUndefined();
  });

  it('returns original url when updatedAt is missing or invalid', () => {
    expect(bustAvatarCache('https://cdn.example.com/a.webp', null)).toBe('https://cdn.example.com/a.webp');
    expect(bustAvatarCache('https://cdn.example.com/a.webp', undefined)).toBe('https://cdn.example.com/a.webp');
    expect(bustAvatarCache('https://cdn.example.com/a.webp', 'not-a-date')).toBe('https://cdn.example.com/a.webp');
  });

  it('appends ?v= or &v= timestamp derived from updatedAt', () => {
    const iso = '2026-02-01T10:20:30.000Z';
    const ts = new Date(iso).getTime();
    expect(bustAvatarCache('https://cdn.example.com/a.webp', iso)).toBe(`https://cdn.example.com/a.webp?v=${ts}`);
    expect(bustAvatarCache('https://cdn.example.com/a.webp?size=sm', iso)).toBe(
      `https://cdn.example.com/a.webp?size=sm&v=${ts}`
    );
  });
});

describe('lib/image-utils', () => {
  const OriginalImage = globalThis.Image;
  const OriginalFileReader = globalThis.FileReader;
  let mockCtx: {
    imageSmoothingEnabled: boolean;
    imageSmoothingQuality: string;
    drawImage: ReturnType<typeof vi.fn>;
  };
  let mockGetContext: ReturnType<typeof vi.fn>;
  let mockToBlob: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCtx = {
      imageSmoothingEnabled: false,
      imageSmoothingQuality: 'low',
      drawImage: vi.fn(),
    };
    mockGetContext = vi.fn().mockReturnValue(mockCtx);
    mockToBlob = vi.fn((cb: (b: Blob | null) => void, type?: string) => {
      cb(new Blob(['compressed'], { type: type || 'image/webp' }));
    });

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      mockGetContext as unknown as HTMLCanvasElement['getContext']
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      mockToBlob as unknown as HTMLCanvasElement['toBlob']
    );
  });

  afterEach(() => {
    globalThis.Image = OriginalImage;
    globalThis.FileReader = OriginalFileReader;
    vi.restoreAllMocks();
  });

  function installMockImage(width: number, height: number, shouldError = false) {
    class MockImage {
      width = width;
      height = height;
      onload: (() => void) | null = null;
      onerror: ((err?: unknown) => void) | null = null;
      private listeners: Record<string, Array<(arg?: unknown) => void>> = {};

      addEventListener(event: string, cb: (arg?: unknown) => void) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(cb);
      }

      setAttribute() {}

      set src(_val: string) {
        queueMicrotask(() => {
          if (shouldError) {
            this.onerror?.(new Error('load error'));
            this.listeners['error']?.forEach((cb) => cb(new Error('load error')));
          } else {
            this.onload?.();
            this.listeners['load']?.forEach((cb) => cb());
          }
        });
      }
    }
    globalThis.Image = MockImage as unknown as typeof Image;
  }

  function installMockFileReader(result = 'data:image/png;base64,abc', shouldError = false) {
    class MockFileReader {
      onload: ((e: { target: { result: string } }) => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() {
        queueMicrotask(() => {
          if (shouldError) {
            this.onerror?.();
          } else {
            this.onload?.({ target: { result } });
          }
        });
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
  }

  it('rejects files exceeding maxMB before reading', async () => {
    const file = new File([new Uint8Array(10)], 'huge.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 + 1 });

    await expect(compressImage(file, { maxMB: 2 })).rejects.toThrow(
      'File is too large to process. Max size is 2MB.'
    );
  });

  it('compresses a landscape image while maintaining aspect ratio', async () => {
    installMockFileReader();
    installMockImage(2000, 1000);
    const file = new File(['data'], 'photo.png', { type: 'image/png' });

    const blob = await compressImage(file, { maxDimension: 1000, quality: 0.75, type: 'image/webp' });

    expect(blob.type).toBe('image/webp');
    expect(mockCtx.imageSmoothingEnabled).toBe(true);
    expect(mockCtx.imageSmoothingQuality).toBe('high');
    expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2000, 1000, 0, 0, 1000, 500);
    expect(mockToBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.75);
  });

  it('compresses a portrait image and crops to square when cropToSquare is true', async () => {
    installMockFileReader();
    installMockImage(800, 1200);
    const file = new File(['data'], 'portrait.png', { type: 'image/png' });

    await compressImage(file, { maxDimension: 300, cropToSquare: true, type: 'image/jpeg', quality: 0.9 });

    // Square crop on 800x1200 takes 800x800 starting at sx=0, sy=200
    expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 200, 800, 800, 0, 0, 300, 300);
    expect(mockToBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.9);
  });

  it('scales portrait image proportionally when cropToSquare is false', async () => {
    installMockFileReader();
    installMockImage(600, 1200);
    const file = new File(['data'], 'tall.png', { type: 'image/png' });

    await compressImage(file, { maxDimension: 600 });

    expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 600, 1200, 0, 0, 300, 600);
  });

  it('rejects on FileReader error, Image load error, missing 2d context, and null toBlob', async () => {
    const file = new File(['data'], 'bad.png', { type: 'image/png' });

    installMockFileReader('', true);
    await expect(compressImage(file)).rejects.toThrow('Failed to read file');

    installMockFileReader();
    installMockImage(100, 100, true);
    await expect(compressImage(file)).rejects.toThrow('Failed to load image into memory');

    installMockImage(100, 100, false);
    mockGetContext.mockReturnValueOnce(null);
    await expect(compressImage(file)).rejects.toThrow('Failed to get canvas context');

    mockToBlob.mockImplementationOnce((cb: (b: Blob | null) => void) => cb(null));
    await expect(compressImage(file)).rejects.toThrow('Failed to compress image (blob null)');
  });

  it('getCroppedImg crops to targetSize as JPEG and handles context/blob errors', async () => {
    installMockImage(1000, 800);

    const blob = await getCroppedImg('https://example.com/photo.jpg', { x: 10, y: 20, width: 200, height: 200 }, 400);
    expect(blob.type).toBe('image/jpeg');
    expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.anything(), 10, 20, 200, 200, 0, 0, 400, 400);
    expect(mockToBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);

    mockGetContext.mockReturnValueOnce(null);
    await expect(
      getCroppedImg('https://example.com/photo.jpg', { x: 0, y: 0, width: 100, height: 100 })
    ).rejects.toThrow('No 2d context');

    mockToBlob.mockImplementationOnce((cb: (b: Blob | null) => void) => cb(null));
    await expect(
      getCroppedImg('https://example.com/photo.jpg', { x: 0, y: 0, width: 100, height: 100 })
    ).rejects.toThrow('Canvas is empty');
  });
});
