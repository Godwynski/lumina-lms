import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient, createMockQueryBuilder } from '@/test/mocks/supabase';

const mockGetMe = vi.fn();
const mockSendNotification = vi.fn();
const mockRevalidatePath = vi.fn();

vi.mock('@/lib/auth-helpers', () => ({
  getMe: (...args: unknown[]) => mockGetMe(...args),
}));

vi.mock('@/lib/notifications', () => ({
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { toggleAttendanceByCard, getAttendanceHistory } from '@/lib/actions/attendance';

function makeAuthContext(
  supabase: ReturnType<typeof createMockSupabaseClient>['client'],
  overrides: {
    id?: string;
    role?: 'super_admin' | 'librarian' | 'student_assistant' | 'student';
    status?: string;
    isDeactivatedSA?: boolean;
    manageAttendance?: boolean;
  } = {}
) {
  const role = overrides.role ?? 'librarian';
  const id = overrides.id ?? 'staff-1';
  const isDeactivatedSA = overrides.isDeactivatedSA ?? false;
  const status = overrides.status ?? (isDeactivatedSA ? 'DEACTIVATED' : 'ACTIVE');
  const manageAttendance =
    overrides.manageAttendance ?? (role === 'super_admin' || role === 'librarian' || role === 'student_assistant');

  return {
    user: { id },
    profile: {
      id,
      role,
      status,
      permissions: { manage_attendance: manageAttendance },
    },
    role,
    isStaff: role !== 'student',
    isAdmin: role === 'super_admin',
    isDeactivatedSA,
    hasPermission: (perm: string) => {
      if (role === 'super_admin' || role === 'librarian') return true;
      return perm === 'manage_attendance' ? manageAttendance : false;
    },
    supabase,
  };
}

describe('attendance server actions', () => {
  let supaMock: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    supaMock = createMockSupabaseClient();
    mockGetMe.mockResolvedValue(makeAuthContext(supaMock.client));
    mockSendNotification.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('toggleAttendanceByCard RBAC', () => {
    it('rejects unauthenticated callers, students, deactivated SAs, and SAs without manage_attendance', async () => {
      mockGetMe.mockResolvedValue(null);
      expect(await toggleAttendanceByCard({ cardNumber: 'LIB-1' })).toEqual({
        success: false,
        error: 'Authentication required',
      });

      mockGetMe.mockResolvedValue(makeAuthContext(supaMock.client, { role: 'student' }));
      expect(await toggleAttendanceByCard({ cardNumber: 'LIB-1' })).toEqual({
        success: false,
        error: 'Unauthorized access',
      });

      mockGetMe.mockResolvedValue(
        makeAuthContext(supaMock.client, { role: 'student_assistant', isDeactivatedSA: true })
      );
      expect(await toggleAttendanceByCard({ cardNumber: 'LIB-1' })).toEqual({
        success: false,
        error: 'Access denied: Staff account is currently deactivated.',
      });

      mockGetMe.mockResolvedValue(
        makeAuthContext(supaMock.client, {
          role: 'student_assistant',
          isDeactivatedSA: false,
          manageAttendance: false,
        })
      );
      expect(await toggleAttendanceByCard({ cardNumber: 'LIB-1' })).toEqual({
        success: false,
        error: 'Access denied: Missing required permission.',
      });
    });

    it('allows active student assistant with manage_attendance permission', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T03:00:00Z'));

      mockGetMe.mockResolvedValue(
        makeAuthContext(supaMock.client, {
          role: 'student_assistant',
          manageAttendance: true,
        })
      );
      supaMock.setTableResponse('library_cards', {
        user_id: 'patron-1',
        profiles: { full_name: 'Ana Santos', status: 'ACTIVE' },
      });

      const activeCheck = createMockQueryBuilder(null);
      const lastOutCheck = createMockQueryBuilder(null);
      const insertBuilder = createMockQueryBuilder(null);
      let attCalls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          attCalls += 1;
          if (attCalls === 1) return activeCheck;
          if (attCalls === 2) return lastOutCheck;
          return insertBuilder;
        }
        return supaMock.getTableBuilder(table);
      });

      const res = await toggleAttendanceByCard({ cardNumber: 'LIB-001' });
      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('IN');
    });
  });

  describe('toggleAttendanceByCard behavior', () => {
    it('checks in a patron by library card, notifies, and revalidates paths', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T02:30:00Z'));

      supaMock.setTableResponse('library_cards', {
        user_id: 'patron-1',
        profiles: { full_name: 'Maria Clara', status: 'ACTIVE' },
      });

      const activeCheck = createMockQueryBuilder(null);
      const lastOutCheck = createMockQueryBuilder(null);
      const insertBuilder = createMockQueryBuilder(null);
      let attCalls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          attCalls += 1;
          if (attCalls === 1) return activeCheck;
          if (attCalls === 2) return lastOutCheck;
          return insertBuilder;
        }
        return supaMock.getTableBuilder(table);
      });

      const res = await toggleAttendanceByCard({ cardNumber: '  LIB-1001  ' });

      expect(supaMock.getTableBuilder('library_cards').eq).toHaveBeenCalledWith('card_number', 'LIB-1001');
      expect(insertBuilder.insert).toHaveBeenCalledWith({
        user_id: 'patron-1',
        check_in_at: '2026-06-15T02:30:00.000Z',
      });
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'patron-1',
          title: 'Attendance: Time In',
          type: 'SYSTEM',
        })
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith('/attendance', 'page');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard', 'page');
      expect(res).toEqual({
        success: true,
        data: {
          status: 'IN',
          recordedAt: '2026-06-15T02:30:00.000Z',
          message: 'Welcome, Maria Clara!',
          description: 'Timed in successfully.',
          userName: 'Maria Clara',
        },
      });
    });

    it.each([{ isManual: true }, { confirmed: true }])(
      'allows an intentional immediate checkout when confirmation flag %j is passed',
      async (confirmation) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15T05:00:30Z'));

        supaMock.setTableResponse('library_cards', {
          user_id: 'patron-100',
          profiles: { full_name: 'Student', status: 'ACTIVE' },
        });
        const activeCheck = createMockQueryBuilder({
          id: 'fresh-visit',
          check_in_at: '2026-06-15T05:00:00Z',
        });
        const updateBuilder = createMockQueryBuilder(null);
        let attCalls = 0;
        supaMock.from.mockImplementation((table: string) => {
          if (table === 'attendance') {
            attCalls += 1;
            return attCalls === 1 ? activeCheck : updateBuilder;
          }
          return supaMock.getTableBuilder(table);
        });

        const result = await toggleAttendanceByCard({ cardNumber: 'LC-9999', ...confirmation });
        expect(result.success).toBe(true);
        expect(result.data?.status).toBe('OUT');
        expect(updateBuilder.update).toHaveBeenCalledWith({
          check_out_at: '2026-06-15T05:00:30.000Z',
        });
      }
    );

    it('falls back to student_id lookup and checks out an existing open session (>= 60s old)', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T05:00:00Z'));

      supaMock.setTableResponse('library_cards', null);
      supaMock.setTableResponse('profiles', {
        id: 'patron-2',
        full_name: 'Jose Rizal',
        status: 'ACTIVE',
      });

      const activeCheck = createMockQueryBuilder({
        id: 'att-open-1',
        check_in_at: '2026-06-15T04:00:00Z', // 1 hour ago
      });
      const updateBuilder = createMockQueryBuilder(null);
      let attCalls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          attCalls += 1;
          return attCalls === 1 ? activeCheck : updateBuilder;
        }
        return supaMock.getTableBuilder(table);
      });

      const res = await toggleAttendanceByCard({ cardNumber: '2024-0002' });

      expect(supaMock.getTableBuilder('profiles').eq).toHaveBeenCalledWith('student_id', '2024-0002');
      expect(updateBuilder.update).toHaveBeenCalledWith({
        check_out_at: '2026-06-15T05:00:00.000Z',
      });
      expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'att-open-1');
      expect(mockSendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'patron-2',
          title: 'Attendance: Time Out',
        })
      );
      expect(res).toEqual({
        success: true,
        data: {
          status: 'OUT',
          recordedAt: '2026-06-15T05:00:00.000Z',
          message: 'Goodbye, Jose Rizal!',
          description: 'Timed out successfully.',
          userName: 'Jose Rizal',
        },
      });
    });

    it('debounces rapid camera scan within 60s of check-in or check-out, unless isManual is true', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T05:00:30Z'));

      supaMock.setTableResponse('library_cards', {
        user_id: 'patron-1',
        profiles: [{ full_name: 'Maria Clara', status: 'ACTIVE' }],
      });

      // Rapid scan 30s after check-in -> stays IN without updating DB
      supaMock.setTableResponse('attendance', {
        id: 'att-1',
        check_in_at: '2026-06-15T05:00:00Z',
      });

      const rapidInRes = await toggleAttendanceByCard({ cardNumber: 'LIB-1001', isManual: false });
      expect(rapidInRes).toEqual({
        success: true,
        data: {
          status: 'IN',
          recordedAt: '2026-06-15T05:00:00Z',
          message: 'Already timed in, Maria Clara.',
          description: 'Already timed in.',
          userName: 'Maria Clara',
        },
      });
      expect(mockSendNotification).not.toHaveBeenCalled();

      // Rapid camera scan 30s after check-out -> stays OUT without inserting
      const activeNull = createMockQueryBuilder(null);
      const recentOut = createMockQueryBuilder({ check_out_at: '2026-06-15T05:00:00Z' });
      let calls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          calls += 1;
          return calls === 1 ? activeNull : recentOut;
        }
        return supaMock.getTableBuilder(table);
      });

      const rapidOutRes = await toggleAttendanceByCard({ cardNumber: 'LIB-1001', isManual: false });
      expect(rapidOutRes).toEqual({
        success: true,
        data: {
          status: 'OUT',
          recordedAt: '2026-06-15T05:00:00Z',
          message: 'Already timed out, Maria Clara.',
          description: 'Already timed out.',
          userName: 'Maria Clara',
        },
      });

      // Manual check-in right after check-out bypasses lastOut debounce
      const manualActiveNull = createMockQueryBuilder(null);
      const manualInsert = createMockQueryBuilder(null);
      let manualCalls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          manualCalls += 1;
          return manualCalls === 1 ? manualActiveNull : manualInsert;
        }
        return supaMock.getTableBuilder(table);
      });

      const manualInRes = await toggleAttendanceByCard({ cardNumber: 'LIB-1001', isManual: true });
      expect(manualInRes.success).toBe(true);
      expect(manualInRes.data?.status).toBe('IN');
      expect(manualInsert.insert).toHaveBeenCalledTimes(1);
    });

    it('rejects unrecognized identifiers, inactive profiles, and duplicate active session DB errors', async () => {
      supaMock.setTableResponse('library_cards', null);
      supaMock.setTableResponse('profiles', null);

      expect(await toggleAttendanceByCard({ cardNumber: 'BAD-QR', isManual: false })).toEqual({
        success: false,
        error: 'Invalid or inactive library card. Please ensure the card is activated in the system.',
      });
      expect(await toggleAttendanceByCard({ cardNumber: 'BAD-ID', isManual: true })).toEqual({
        success: false,
        error: 'The identifier is not recognized by the system. Please ensure the user has an active account.',
      });

      supaMock.setTableResponse('library_cards', {
        user_id: 'patron-suspended',
        profiles: { full_name: 'Suspended User', status: 'SUSPENDED' },
      });
      expect(await toggleAttendanceByCard({ cardNumber: 'LIB-SUSP' })).toEqual({
        success: false,
        error: 'User account is suspended. Attendance restricted.',
      });

      // Duplicate key 23505 on insert
      supaMock.setTableResponse('library_cards', {
        user_id: 'patron-1',
        profiles: { full_name: 'Maria Clara', status: 'ACTIVE' },
      });
      const activeNull = createMockQueryBuilder(null);
      const insertDupErr = createMockQueryBuilder(null, { code: '23505', message: 'duplicate key' });
      let calls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          calls += 1;
          return calls === 1 ? activeNull : insertDupErr;
        }
        return supaMock.getTableBuilder(table);
      });

      expect(await toggleAttendanceByCard({ cardNumber: 'LIB-1001', isManual: true })).toEqual({
        success: false,
        error: 'An active attendance session is already in progress for this card.',
      });
    });
  });

  describe('getAttendanceHistory', () => {
    it('throws Unauthorized when unauthenticated and Forbidden when a student queries another user', async () => {
      mockGetMe.mockResolvedValue(null);
      await expect(getAttendanceHistory()).rejects.toThrow('Unauthorized');

      mockGetMe.mockResolvedValue(makeAuthContext(supaMock.client, { id: 'student-1', role: 'student' }));
      await expect(getAttendanceHistory('student-2')).rejects.toThrow('Forbidden');
    });

    it('returns staff today records with sanitized search and limit, unwrapping array profiles', async () => {
      vi.useFakeTimers();
      // 2026-06-15T17:00:00Z = 2026-06-16 01:00:00 Asia/Manila -> Manila date is 2026-06-16
      vi.setSystemTime(new Date('2026-06-15T17:00:00Z'));

      supaMock.setTableResponse('attendance', [
        {
          id: 'att-1',
          check_in_at: '2026-06-16T00:10:00+08:00',
          check_out_at: null,
          user_id: 'patron-1',
          notes: null,
          profiles: [{ full_name: 'Maria Clara', student_id: '2024-0001' }],
        },
      ]);

      const res = await getAttendanceHistory(undefined, {
        range: 'today',
        limit: 20,
        search: 'Maria,():*\\',
      });

      const attBuilder = supaMock.getTableBuilder('attendance');
      expect(attBuilder.select).toHaveBeenCalledWith(
        'id, check_in_at, check_out_at, user_id, notes, profiles!inner(full_name, student_id)'
      );
      expect(attBuilder.gte).toHaveBeenCalledWith('check_in_at', '2026-06-16T00:00:00+08:00');
      expect(attBuilder.or).toHaveBeenCalledWith(
        'full_name.ilike.%Maria%,student_id.ilike.%Maria%',
        { referencedTable: 'profiles' }
      );
      expect(attBuilder.limit).toHaveBeenCalledWith(20);
      expect(res).toEqual([
        {
          id: 'att-1',
          check_in_at: '2026-06-16T00:10:00+08:00',
          check_out_at: null,
          user_id: 'patron-1',
          notes: null,
          profiles: { full_name: 'Maria Clara', student_id: '2024-0001' },
        },
      ]);
    });

    it('paginates staff range all records when limit is omitted', async () => {
      const batch1 = Array.from({ length: 1000 }, (_, i) => ({
        id: `att-${i}`,
        check_in_at: '2026-06-15T00:00:00Z',
        check_out_at: null,
        user_id: 'patron-1',
        profiles: { full_name: 'Patron', student_id: '2024-0001' },
      }));
      const batch2 = [
        {
          id: 'att-1000',
          check_in_at: '2026-06-14T00:00:00Z',
          check_out_at: null,
          user_id: 'patron-1',
          profiles: { full_name: 'Patron', student_id: '2024-0001' },
        },
      ];

      const builder1 = createMockQueryBuilder(batch1);
      const builder2 = createMockQueryBuilder(batch2);
      let calls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          calls += 1;
          return calls === 1 ? builder1 : builder2;
        }
        return supaMock.getTableBuilder(table);
      });

      const res = await getAttendanceHistory(undefined, { range: 'all' });

      expect(builder1.gte).not.toHaveBeenCalled();
      expect(builder1.range).toHaveBeenCalledWith(0, 999);
      expect(builder2.range).toHaveBeenCalledWith(1000, 1999);
      expect(res).toHaveLength(1001);
    });

    it('returns own attendance history for a student without staff privileges and propagates DB errors', async () => {
      mockGetMe.mockResolvedValue(makeAuthContext(supaMock.client, { id: 'student-1', role: 'student' }));
      supaMock.setTableResponse('attendance', [
        {
          id: 'att-own-1',
          check_in_at: '2026-06-15T01:00:00Z',
          check_out_at: '2026-06-15T03:00:00Z',
          user_id: 'student-1',
          notes: null,
          profiles: { full_name: 'Student One', student_id: '2024-0100' },
        },
      ]);

      const ownRes = await getAttendanceHistory(undefined, { limit: 5 });
      const attBuilder = supaMock.getTableBuilder('attendance');
      expect(attBuilder.eq).toHaveBeenCalledWith('user_id', 'student-1');
      expect(attBuilder.limit).toHaveBeenCalledWith(5);
      expect(ownRes).toHaveLength(1);

      supaMock.setTableResponse('attendance', null, { message: 'DB read error' });
      await expect(getAttendanceHistory(undefined, { limit: 5 })).rejects.toEqual({
        message: 'DB read error',
      });
    });
  });
});
