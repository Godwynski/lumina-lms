import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { getUserRole } from '../lib/auth-helpers';
import { createClient } from '../lib/supabase/server';

vi.mock('../lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('auth-helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null if no user is found', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    };
    (createClient as Mock).mockResolvedValue(mockSupabase);

    const role = await getUserRole();
    expect(role).toBeNull();
  });

  it('should return metadata role if present', async () => {
    const mockUser = {
      id: 'user-id',
      app_metadata: { role: 'librarian' },
    };
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn(),
    };
    (createClient as Mock).mockResolvedValue(mockSupabase);

    const role = await getUserRole();
    expect(role).toBe('librarian');
  });

  it('should return student role if no role is found in metadata or profile', async () => {
    const mockUser = {
      id: 'user-id',
      app_metadata: {},
    };
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
    (createClient as Mock).mockResolvedValue(mockSupabase);

    const role = await getUserRole();
    expect(role).toBe('student');
  });
});
