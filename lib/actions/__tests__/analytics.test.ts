import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAnalyticsSummary, type AnalyticsRange } from '../analytics';
import { getMe } from '@/lib/auth-helpers';
import { createMockQueryBuilder, createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';
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

  describe('Date Range Windows', () => {
    it('calculates 7-day interval data points for range="7d"', async () => {
      mockClientHelper.setTableResponse('attendance', []);
      mockClientHelper.setTableResponse('borrowing_records', []);

      const result = await getAnalyticsSummary('7d');

      // 7 days interval (6 days ago through today inclusive)
      expect(result.attendanceTrends).toHaveLength(7);
      expect(result.borrowingTrends).toHaveLength(7);
      expect(result.attendanceTrends[0].count).toBe(0);
    });

    it('calculates 30-day interval data points for range="30d"', async () => {
      mockClientHelper.setTableResponse('attendance', []);
      mockClientHelper.setTableResponse('borrowing_records', []);

      const result = await getAnalyticsSummary('30d');

      expect(result.attendanceTrends).toHaveLength(30);
      expect(result.borrowingTrends).toHaveLength(30);
    });

    it('calculates monthly interval data points for range="1y"', async () => {
      mockClientHelper.setTableResponse('attendance', []);
      mockClientHelper.setTableResponse('borrowing_records', []);

      const result = await getAnalyticsSummary('1y');

      // 12-13 months interval depending on current date
      expect(result.attendanceTrends.length).toBeGreaterThanOrEqual(12);
      expect(result.attendanceTrends[0].label).toMatch(/[A-Za-z]{3}\s\d{4}/);
    });

    it('defaults to 30 days when range is unknown or unsupported', async () => {
      mockClientHelper.setTableResponse('attendance', []);
      mockClientHelper.setTableResponse('borrowing_records', []);

      const result = await getAnalyticsSummary('invalid-range' as AnalyticsRange);

      expect(result.attendanceTrends).toHaveLength(30);
    });
  });

  describe('Metric Aggregations', () => {
    it('aggregates peak visiting hours between 8 AM and 6 PM and ignores hours outside range', async () => {
      const now = new Date();
      const createTime = (hour: number) => {
        const d = new Date(now);
        d.setHours(hour, 15, 0, 0);
        return d.toISOString();
      };

      const mockAttendance = [
        { check_in_at: createTime(9) },  // 9 AM
        { check_in_at: createTime(9) },  // 9 AM
        { check_in_at: createTime(14) }, // 2 PM
        { check_in_at: createTime(6) },  // 6 AM (outside range 8..18 -> ignored)
        { check_in_at: createTime(20) }, // 8 PM (outside range 8..18 -> ignored)
      ];

      mockClientHelper.setTableResponse('attendance', mockAttendance);
      mockClientHelper.setTableResponse('borrowing_records', []);

      const result = await getAnalyticsSummary('7d');

      // Hours 8 to 18 = 11 hourly slots
      expect(result.peakHours).toHaveLength(11);

      const hour9 = result.peakHours.find((h) => h.hour === '9 AM');
      expect(hour9?.count).toBe(2);

      const hour2PM = result.peakHours.find((h) => h.hour === '2 PM');
      expect(hour2PM?.count).toBe(1);

      const hour10AM = result.peakHours.find((h) => h.hour === '10 AM');
      expect(hour10AM?.count).toBe(0);
    });

    it('aggregates category distribution and sorts by popularity descending', async () => {
      mockClientHelper.setTableResponse('attendance', []);

      const mockBorrowing = [
        {
          borrowed_at: new Date().toISOString(),
          status: 'ACTIVE',
          book_copies: { books: { categories: { name: 'Fiction' } } },
        },
        {
          borrowed_at: new Date().toISOString(),
          status: 'RETURNED',
          book_copies: { books: { categories: { name: 'Science' } } },
        },
        {
          borrowed_at: new Date().toISOString(),
          status: 'RETURNED',
          book_copies: { books: { categories: { name: 'Science' } } },
        },
        {
          borrowed_at: new Date().toISOString(),
          status: 'ACTIVE',
          book_copies: { books: { categories: null } }, // Should default to 'General'
        },
      ];

      mockClientHelper.setTableResponse('borrowing_records', mockBorrowing);

      const result = await getAnalyticsSummary('7d');

      expect(result.categoryDistribution).toEqual([
        { name: 'Science', value: 2 },
        { name: 'Fiction', value: 1 },
        { name: 'General', value: 1 },
      ]);
    });

    it('aggregates popular books by id, limits to top 5, and sorts descending by count', async () => {
      mockClientHelper.setTableResponse('attendance', []);

      const mockPopularRecords = [
        { book_copies: { books: { id: 'book-A', title: 'Algorithms' } } },
        { book_copies: { books: { id: 'book-A', title: 'Algorithms' } } },
        { book_copies: { books: { id: 'book-A', title: 'Algorithms' } } },
        { book_copies: { books: { id: 'book-B', title: 'Clean Code' } } },
        { book_copies: { books: { id: 'book-B', title: 'Clean Code' } } },
        { book_copies: { books: { id: 'book-C', title: 'Design Patterns' } } },
        { book_copies: { books: { id: 'book-D', title: 'Operating Systems' } } },
        { book_copies: { books: { id: 'book-E', title: 'Networks' } } },
        { book_copies: { books: { id: 'book-F', title: 'Compilers' } } },
      ];

      let borrowingQueryCount = 0;
      const bBuilder1 = createMockQueryBuilder([]);
      const bBuilder2 = createMockQueryBuilder(mockPopularRecords);

      mockClientHelper.from.mockImplementation((table: string) => {
        if (table === 'borrowing_records') {
          borrowingQueryCount++;
          return borrowingQueryCount === 1 ? bBuilder1 : bBuilder2;
        }
        return mockClientHelper.getTableBuilder(table);
      });

      const result = await getAnalyticsSummary('7d');

      expect(result.popularBooks).toHaveLength(5);
      expect(result.popularBooks[0]).toEqual({ id: 'book-A', title: 'Algorithms', count: 3 });
      expect(result.popularBooks[1]).toEqual({ id: 'book-B', title: 'Clean Code', count: 2 });
      expect(result.popularBooks[2]).toEqual({ id: 'book-C', title: 'Design Patterns', count: 1 });
    });

    it('handles empty database results gracefully without runtime errors', async () => {
      mockClientHelper.setTableResponse('attendance', null);
      mockClientHelper.setTableResponse('borrowing_records', null);

      const result = await getAnalyticsSummary('7d');

      expect(result.attendanceTrends).toHaveLength(7);
      expect(result.borrowingTrends).toHaveLength(7);
      expect(result.categoryDistribution).toEqual([]);
      expect(result.popularBooks).toEqual([]);
      expect(result.peakHours).toHaveLength(11);
      expect(result.peakHours.every((h) => h.count === 0)).toBe(true);
    });
  });
});
