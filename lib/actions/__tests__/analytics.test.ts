import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAnalyticsSummary, type AnalyticsRange } from '../analytics';
import { getMe } from '@/lib/auth-helpers';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';
import type { ProfileData, UserRole } from '@/lib/types';

vi.mock('@/lib/auth-helpers', () => ({
  getMe: vi.fn(),
}));

describe('Analytics Server Actions', () => {
  let mockClientHelper: MockSupabaseClientHelper;

  const mockUser = (role: UserRole = 'librarian', id = 'analytics-staff-1') => ({
    user: {
      id,
      email: `${role}@school.edu`,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id,
      email: `${role}@school.edu`,
      role,
      status: 'ACTIVE',
      full_name: 'Analytics User',
      permissions: {},
    } as unknown as ProfileData,
    role,
    isStaff: role === 'super_admin' || role === 'librarian',
    isAdmin: role === 'super_admin',
    isDeactivatedSA: false,
    hasPermission: vi.fn().mockReturnValue(true),
    supabase: mockClientHelper.client,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientHelper = createMockSupabaseClient();
    vi.mocked(getMe).mockResolvedValue(
      mockUser('librarian') as unknown as Awaited<ReturnType<typeof getMe>>
    );
  });

  describe('Authorization Guards', () => {
    it('throws Unauthorized when user is unauthenticated', async () => {
      vi.mocked(getMe).mockResolvedValue(null);

      await expect(getAnalyticsSummary('7d')).rejects.toThrow('Unauthorized');
    });

    it('throws Forbidden when user is a student', async () => {
      vi.mocked(getMe).mockResolvedValue(
        mockUser('student') as unknown as Awaited<ReturnType<typeof getMe>>
      );

      await expect(getAnalyticsSummary('7d')).rejects.toThrow('Forbidden');
    });

    it('throws Forbidden when user is a student_assistant', async () => {
      vi.mocked(getMe).mockResolvedValue(
        mockUser('student_assistant') as unknown as Awaited<ReturnType<typeof getMe>>
      );

      await expect(getAnalyticsSummary('7d')).rejects.toThrow('Forbidden');
    });

    it('allows super_admin callers', async () => {
      vi.mocked(getMe).mockResolvedValue(
        mockUser('super_admin') as unknown as Awaited<ReturnType<typeof getMe>>
      );

      mockClientHelper.setTableResponse('attendance', []);
      mockClientHelper.setTableResponse('borrowing_records', []);

      const result = await getAnalyticsSummary('7d');
      expect(result).toBeDefined();
    });
  });

  // Counting and grouping happen in SQL (get_analytics_summary); db-real.test.ts checks them on real
  // Postgres, past the 1,000-row API limit. These tests cover the call and the result handling.
  describe('get_analytics_summary RPC', () => {
    it.each(['7d', '30d', '1y'] as AnalyticsRange[])('passes range %s to the SQL function', async (range) => {
      await getAnalyticsSummary(range);
      expect(mockClientHelper.rpc).toHaveBeenCalledWith('get_analytics_summary', { p_range: range });
    });

    it('returns the SQL summary with author and ISBN added to popular books', async () => {
      const summary = {
        attendanceTrends: [{ label: 'Nov 04', count: 1500 }],
        borrowingTrends: [{ label: 'Nov 04', count: 1200 }],
        categoryDistribution: [{ name: 'Science', value: 900 }],
        peakHours: [{ hour: '9 AM', count: 300 }],
        popularBooks: [
          { id: 'b-1', title: 'SICP', count: 42 },
          { id: 'b-2', title: 'SICP', count: 10 },
          { id: 'b-3', title: 'Gone', count: 1 },
        ],
      };
      mockClientHelper.setRpcResponse(summary, null, 'get_analytics_summary');
      mockClientHelper.setTableResponse('books', [
        { id: 'b-1', author: 'Abelson', isbn: '9780262510875' },
        { id: 'b-2', author: 'Someone Else', isbn: null },
      ]);
      await expect(getAnalyticsSummary('30d')).resolves.toEqual({
        ...summary,
        popularBooks: [
          { id: 'b-1', title: 'SICP', count: 42, author: 'Abelson', isbn: '9780262510875' },
          { id: 'b-2', title: 'SICP', count: 10, author: 'Someone Else', isbn: null },
          { id: 'b-3', title: 'Gone', count: 1, author: null, isbn: null },
        ],
      });
    });

    it('returns empty lists when the function returns nothing', async () => {
      mockClientHelper.setRpcResponse(null, null, 'get_analytics_summary');
      await expect(getAnalyticsSummary('7d')).resolves.toEqual({
        attendanceTrends: [],
        borrowingTrends: [],
        categoryDistribution: [],
        peakHours: [],
        popularBooks: [],
      });
    });

    it('throws when the SQL function fails', async () => {
      mockClientHelper.setRpcResponse(null, { message: 'boom' }, 'get_analytics_summary');
      await expect(getAnalyticsSummary('7d')).rejects.toThrow('boom');
    });
  });
});
