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

import { recordAttendanceByCard, getAttendanceHistory } from '@/lib/actions/attendance';

function makeAuthContext(
  supabase: ReturnType<typeof createMockSupabaseClient>['client'],
  overrides: {
    id?: string;
    role?: 'super_admin' | 'librarian' | 'library_staff' | 'patron';
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
    overrides.manageAttendance ?? (role === 'super_admin' || role === 'librarian' || role === 'library_staff');

  return {
    user: { id },
    profile: {
      id,
      role,
      status,
      permissions: { manage_attendance: manageAttendance },
    },
    role,
    isStaff: role !== 'patron',
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

  describe('recordAttendanceByCard RBAC & validation', () => {
    it('rejects unauthenticated callers, students, deactivated SAs, and SAs without manage_attendance', async () => {
      mockGetMe.mockResolvedValue(null);
      expect(await recordAttendanceByCard({ cardNumber: 'LIB-1', mode: 'in' })).toEqual({
        success: false,
        error: 'Authentication required',
      });

      mockGetMe.mockResolvedValue(makeAuthContext(supaMock.client, { role: 'patron' }));
      expect(await recordAttendanceByCard({ cardNumber: 'LIB-1', mode: 'in' })).toEqual({
        success: false,
        error: 'Unauthorized access',
      });

      mockGetMe.mockResolvedValue(
        makeAuthContext(supaMock.client, { role: 'library_staff', isDeactivatedSA: true })
      );
      expect(await recordAttendanceByCard({ cardNumber: 'LIB-1', mode: 'out' })).toEqual({
        success: false,
        error: 'Access denied: Staff account is currently deactivated.',
      });

      mockGetMe.mockResolvedValue(
        makeAuthContext(supaMock.client, {
          role: 'library_staff',
          isDeactivatedSA: false,
          manageAttendance: false,
        })
      );
      expect(await recordAttendanceByCard({ cardNumber: 'LIB-1', mode: 'in' })).toEqual({
        success: false,
        error: 'Access denied: Missing required permission.',
      });
    });

    it('rejects invalid or missing mode', async () => {
      const invalidMode = await recordAttendanceByCard({ cardNumber: 'LIB-1', mode: 'toggle' });
      expect(invalidMode.success).toBe(false);
      expect(invalidMode.error).toBe('Validation failed');

      const missingMode = await recordAttendanceByCard({ cardNumber: 'LIB-1' });
      expect(missingMode.success).toBe(false);
      expect(missingMode.error).toBe('Validation failed');
    });

    it('allows active student assistant with manage_attendance permission', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T03:00:00Z'));

      mockGetMe.mockResolvedValue(
        makeAuthContext(supaMock.client, {
          role: 'library_staff',
          manageAttendance: true,
        })
      );
      supaMock.setTableResponse('library_cards', {
        user_id: 'patron-1',
        profiles: { full_name: 'Ana Santos', status: 'ACTIVE' },
      });

      const activeCheck = createMockQueryBuilder(null);
      const insertBuilder = createMockQueryBuilder(null);
      let attCalls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          attCalls += 1;
          return attCalls === 1 ? activeCheck : insertBuilder;
        }
        return supaMock.getTableBuilder(table);
      });

      const res = await recordAttendanceByCard({ cardNumber: 'LIB-001', mode: 'in' });
      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('IN');
      expect(res.data?.outcome).toBe('CHECKED_IN');
    });
  });

  describe('recordAttendanceByCard 5 mode outcomes (QR and manual)', () => {
    it.each([false, true])(
      '1) mode=in, no open record -> checks in (isManual=%s)',
      async (isManual) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15T02:30:00Z'));

        supaMock.setTableResponse('library_cards', {
          user_id: 'patron-1',
          profiles: { full_name: 'Maria Clara', status: 'ACTIVE' },
        });

        const activeCheck = createMockQueryBuilder(null);
        const insertBuilder = createMockQueryBuilder(null);
        let attCalls = 0;
        supaMock.from.mockImplementation((table: string) => {
          if (table === 'attendance') {
            attCalls += 1;
            return attCalls === 1 ? activeCheck : insertBuilder;
          }
          return supaMock.getTableBuilder(table);
        });

        const res = await recordAttendanceByCard({
          cardNumber: '  LIB-1001  ',
          mode: 'in',
          isManual,
        });

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
            outcome: 'CHECKED_IN',
            recordedAt: '2026-06-15T02:30:00.000Z',
            message: 'Welcome, Maria Clara!',
            description: 'Timed in successfully.',
            userName: 'Maria Clara',
            userId: 'patron-1',
          },
        });
      }
    );

    it.each([false, true])(
      '2) mode=in, open record < 60s old (59s boundary) -> overwrites check_in_at with now and returns UPDATED (isManual=%s)',
      async (isManual) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15T05:00:59Z')); // 59s after check-in

        supaMock.setTableResponse('library_cards', {
          user_id: 'patron-1',
          profiles: [{ full_name: 'Maria Clara', status: 'ACTIVE' }],
        });

        const activeCheck = createMockQueryBuilder({
          id: 'att-fresh',
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

        const res = await recordAttendanceByCard({
          cardNumber: 'LIB-1001',
          mode: 'in',
          isManual,
        });

        expect(updateBuilder.update).toHaveBeenCalledWith({
          check_in_at: '2026-06-15T05:00:59.000Z',
        });
        expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'att-fresh');
        expect(mockSendNotification).not.toHaveBeenCalled();
        expect(mockRevalidatePath).toHaveBeenCalledWith('/attendance', 'page');
        expect(res).toEqual({
          success: true,
          data: {
            status: 'IN',
            outcome: 'UPDATED',
            recordedAt: '2026-06-15T05:00:59.000Z',
            message: 'Check-in updated for Maria Clara.',
            description: 'Check-in time updated.',
            userName: 'Maria Clara',
            userId: 'patron-1',
          },
        });
      }
    );

    it.each([
      { isManual: false, secondsElapsed: 60 },
      { isManual: true, secondsElapsed: 60 },
      { isManual: false, secondsElapsed: 61 },
      { isManual: true, secondsElapsed: 61 },
    ])(
      '3) mode=in, open record >= 60s old (isManual=$isManual, elapsed=$secondsElapsed s) -> returns ALREADY_IN with no write',
      async ({ isManual, secondsElapsed }) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(new Date('2026-06-15T05:00:00Z').getTime() + secondsElapsed * 1000));

        supaMock.setTableResponse('library_cards', {
          user_id: 'patron-1',
          profiles: { full_name: 'Maria Clara', status: 'ACTIVE' },
        });

        const activeCheck = createMockQueryBuilder({
          id: 'att-open',
          check_in_at: '2026-06-15T05:00:00Z',
        });
        supaMock.from.mockImplementation((table: string) => {
          if (table === 'attendance') return activeCheck;
          return supaMock.getTableBuilder(table);
        });

        const res = await recordAttendanceByCard({
          cardNumber: 'LIB-1001',
          mode: 'in',
          isManual,
        });

        expect(activeCheck.update).not.toHaveBeenCalled();
        expect(activeCheck.insert).not.toHaveBeenCalled();
        expect(mockSendNotification).not.toHaveBeenCalled();
        expect(mockRevalidatePath).not.toHaveBeenCalled();
        expect(res).toEqual({
          success: true,
          data: {
            status: 'ALREADY_IN',
            outcome: 'ALREADY_IN',
            recordedAt: '2026-06-15T05:00:00Z',
            message: 'You are already checked in',
            description: 'Maria Clara is already checked in.',
            userName: 'Maria Clara',
            userId: 'patron-1',
          },
        });
      }
    );

    it.each([false, true])(
      '4) mode=out, open record -> checks out via student_id or card (isManual=%s)',
      async (isManual) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-06-15T05:00:30Z'));

        supaMock.setTableResponse('library_cards', null);
        supaMock.setTableResponse('profiles', {
          id: 'patron-2',
          full_name: 'Jose Rizal',
          status: 'ACTIVE',
        });

        const activeCheck = createMockQueryBuilder({
          id: 'att-open-1',
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

        const res = await recordAttendanceByCard({
          cardNumber: '2024-0002',
          mode: 'out',
          isManual,
        });

        expect(supaMock.getTableBuilder('profiles').eq).toHaveBeenCalledWith('student_id', '2024-0002');
        expect(updateBuilder.update).toHaveBeenCalledWith({
          check_out_at: '2026-06-15T05:00:30.000Z',
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
            outcome: 'CHECKED_OUT',
            recordedAt: '2026-06-15T05:00:30.000Z',
            message: 'Goodbye, Jose Rizal!',
            description: 'Timed out successfully.',
            userName: 'Jose Rizal',
            userId: 'patron-2',
          },
        });
      }
    );

    it.each([false, true])(
      '5) mode=out, no open record -> returns NOT_CHECKED_IN with no write (isManual=%s)',
      async (isManual) => {
        supaMock.setTableResponse('library_cards', {
          user_id: 'patron-1',
          profiles: { full_name: 'Maria Clara', status: 'ACTIVE' },
        });
        const activeNull = createMockQueryBuilder(null);
        supaMock.from.mockImplementation((table: string) => {
          if (table === 'attendance') return activeNull;
          return supaMock.getTableBuilder(table);
        });

        const res = await recordAttendanceByCard({
          cardNumber: 'LIB-1001',
          mode: 'out',
          isManual,
        });

        expect(activeNull.update).not.toHaveBeenCalled();
        expect(activeNull.insert).not.toHaveBeenCalled();
        expect(mockSendNotification).not.toHaveBeenCalled();
        expect(mockRevalidatePath).not.toHaveBeenCalled();
        expect(res).toEqual({
          success: true,
          data: {
            status: 'NOT_CHECKED_IN',
            outcome: 'NOT_CHECKED_IN',
            recordedAt: null,
            message: 'Maria Clara is not currently checked in.',
            description: 'No active check-in session found.',
            userName: 'Maria Clara',
            userId: 'patron-1',
          },
        });
      }
    );

    it('rejects unrecognized identifiers, inactive profiles, and duplicate active session DB errors', async () => {
      supaMock.setTableResponse('library_cards', null);
      supaMock.setTableResponse('profiles', null);

      expect(await recordAttendanceByCard({ cardNumber: 'BAD-QR', mode: 'in', isManual: false })).toEqual({
        success: false,
        error: 'Invalid or inactive library card. Please ensure the card is activated in the system.',
      });
      expect(await recordAttendanceByCard({ cardNumber: 'BAD-ID', mode: 'in', isManual: true })).toEqual({
        success: false,
        error: 'The identifier is not recognized by the system. Please ensure the user has an active account.',
      });

      supaMock.setTableResponse('library_cards', {
        user_id: 'patron-suspended',
        profiles: { full_name: 'Suspended User', status: 'SUSPENDED' },
      });
      expect(await recordAttendanceByCard({ cardNumber: 'LIB-SUSP', mode: 'in' })).toEqual({
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

      expect(await recordAttendanceByCard({ cardNumber: 'LIB-1001', mode: 'in', isManual: true })).toEqual({
        success: false,
        error: 'An active attendance session is already in progress for this card.',
      });
    });

    it('surfaces database errors during card, profile, active session, recent update, checkout update, and insert', async () => {
      // 1. Card query DB error
      supaMock.setTableResponse('library_cards', null, { message: 'card db down' });
      expect(await recordAttendanceByCard({ cardNumber: 'LIB-1', mode: 'in' })).toEqual({
        success: false,
        error: 'Database error while checking library card.',
      });

      // 2. Profile fallback DB error
      supaMock.setTableResponse('library_cards', null, null);
      supaMock.setTableResponse('profiles', null, { message: 'profile db down' });
      expect(await recordAttendanceByCard({ cardNumber: '2024-1', mode: 'in' })).toEqual({
        success: false,
        error: 'Database error while checking student ID.',
      });

      // 3. Active session query DB error
      supaMock.setTableResponse('library_cards', {
        user_id: 'patron-1',
        profiles: { full_name: 'Maria Clara', status: 'ACTIVE' },
      });
      supaMock.setTableResponse('attendance', null, { message: 'active query error' });
      expect(await recordAttendanceByCard({ cardNumber: 'LIB-1', mode: 'in' })).toEqual({
        success: false,
        error: 'Database error while checking active sessions.',
      });

      // 4. Recent (<60s) check-in update DB error
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T05:00:30Z'));
      const freshOpen = createMockQueryBuilder({
        id: 'att-fresh',
        check_in_at: '2026-06-15T05:00:00Z',
      });
      const freshUpdateErr = createMockQueryBuilder(null, { message: 'update failed' });
      let freshCalls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          freshCalls += 1;
          return freshCalls === 1 ? freshOpen : freshUpdateErr;
        }
        return supaMock.getTableBuilder(table);
      });
      expect(await recordAttendanceByCard({ cardNumber: 'LIB-1', mode: 'in' })).toEqual({
        success: false,
        error: 'Failed to update Time In.',
      });

      // 5. Time Out update DB error
      const activeOpen = createMockQueryBuilder({
        id: 'att-open',
        check_in_at: '2026-06-15T01:00:00Z',
      });
      const outUpdateErr = createMockQueryBuilder(null, { message: 'update failed' });
      let outCalls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          outCalls += 1;
          return outCalls === 1 ? activeOpen : outUpdateErr;
        }
        return supaMock.getTableBuilder(table);
      });
      expect(await recordAttendanceByCard({ cardNumber: 'LIB-1', mode: 'out', isManual: true })).toEqual({
        success: false,
        error: 'Failed to register Time Out.',
      });

      // 6. Time In generic insert DB error
      const activeNone = createMockQueryBuilder(null);
      const inInsertErr = createMockQueryBuilder(null, { code: '42501', message: 'rls blocked' });
      let inCalls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          inCalls += 1;
          return inCalls === 1 ? activeNone : inInsertErr;
        }
        return supaMock.getTableBuilder(table);
      });
      expect(await recordAttendanceByCard({ cardNumber: 'LIB-1', mode: 'in', isManual: true })).toEqual({
        success: false,
        error: 'Failed to register Time In.',
      });
    });
  });

  describe('recordAttendanceByCard stale check-in handling (WP10 Part A)', () => {
    it.each([false, true])(
      'yesterday open record + mode=in today (isManual=%s) closes old row as No Log Out at closing time and creates new check-in',
      async (isManual) => {
        vi.useFakeTimers();
        // 2026-06-15 07:30:00 Asia/Manila (before 08:00 cron) = 2026-06-14T23:30:00Z
        vi.setSystemTime(new Date('2026-06-14T23:30:00Z'));

        supaMock.setTableResponse('library_cards', {
          user_id: 'patron-1',
          profiles: { full_name: 'Maria Clara', status: 'ACTIVE' },
        });
        supaMock.setTableResponse('system_settings', null); // defaults to 17:00

        // Checked in yesterday 2026-06-14 09:00 Asia/Manila = 2026-06-14T01:00:00Z
        const activeCheck = createMockQueryBuilder({
          id: 'att-yesterday',
          check_in_at: '2026-06-14T01:00:00Z',
        });
        const closeUpdateBuilder = createMockQueryBuilder(null);
        const insertBuilder = createMockQueryBuilder(null);
        let attCalls = 0;
        supaMock.from.mockImplementation((table: string) => {
          if (table === 'attendance') {
            attCalls += 1;
            if (attCalls === 1) return activeCheck;
            if (attCalls === 2) return closeUpdateBuilder;
            return insertBuilder;
          }
          return supaMock.getTableBuilder(table);
        });

        const res = await recordAttendanceByCard({ cardNumber: 'LIB-1001', mode: 'in', isManual });

        // 2026-06-14 17:00 Asia/Manila = 2026-06-14T09:00:00.000Z
        expect(closeUpdateBuilder.update).toHaveBeenCalledWith({
          check_out_at: '2026-06-14T09:00:00.000Z',
          notes: 'No Log Out',
        });
        expect(closeUpdateBuilder.eq).toHaveBeenCalledWith('id', 'att-yesterday');
        expect(insertBuilder.insert).toHaveBeenCalledWith({
          user_id: 'patron-1',
          check_in_at: '2026-06-14T23:30:00.000Z',
        });
        expect(mockSendNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 'patron-1',
            title: 'Attendance: Time In',
          })
        );
        expect(res).toEqual({
          success: true,
          data: {
            status: 'IN',
            outcome: 'CHECKED_IN',
            recordedAt: '2026-06-14T23:30:00.000Z',
            message: 'Welcome, Maria Clara!',
            description: 'Timed in successfully.',
            userName: 'Maria Clara',
            userId: 'patron-1',
          },
        });
      }
    );

    it('open record from after closing time yesterday never produces check_out_at earlier than check_in_at', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T00:00:00Z')); // 2026-06-15 08:00 Manila

      supaMock.setTableResponse('library_cards', {
        user_id: 'patron-1',
        profiles: { full_name: 'Maria Clara', status: 'ACTIVE' },
      });
      supaMock.setTableResponse('system_settings', { value: '17:00' });

      // Checked in yesterday at 18:30 Manila (10:30Z), which is AFTER 17:00 closing time (09:00Z)
      const activeCheck = createMockQueryBuilder({
        id: 'att-late',
        check_in_at: '2026-06-14T10:30:00.000Z',
      });
      const closeUpdateBuilder = createMockQueryBuilder(null);
      const insertBuilder = createMockQueryBuilder(null);
      let attCalls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          attCalls += 1;
          if (attCalls === 1) return activeCheck;
          if (attCalls === 2) return closeUpdateBuilder;
          return insertBuilder;
        }
        return supaMock.getTableBuilder(table);
      });

      const res = await recordAttendanceByCard({ cardNumber: 'LIB-1001', mode: 'in', isManual: false });

      expect(closeUpdateBuilder.update).toHaveBeenCalledWith({
        check_out_at: '2026-06-14T10:30:00.000Z',
        notes: 'No Log Out',
      });
      expect(insertBuilder.insert).toHaveBeenCalledWith({
        user_id: 'patron-1',
        check_in_at: '2026-06-15T00:00:00.000Z',
      });
      expect(res.success && res.data.outcome).toBe('CHECKED_IN');
    });

    it('respects custom library_closing_time for stale close and same-day ALREADY_IN checks', async () => {
      vi.useFakeTimers();
      // 2026-06-15 18:00 Asia/Manila = 2026-06-15T10:00:00Z
      vi.setSystemTime(new Date('2026-06-15T10:00:00Z'));

      supaMock.setTableResponse('library_cards', {
        user_id: 'patron-1',
        profiles: { full_name: 'Maria Clara', status: 'ACTIVE' },
      });
      // Custom closing time 19:30 Manila -> 18:00 Manila is still BEFORE closing
      supaMock.setTableResponse('system_settings', { value: '19:30' });

      const sameDayOpen = createMockQueryBuilder({
        id: 'att-today',
        check_in_at: '2026-06-15T08:00:00Z', // 16:00 Manila (same day, >60s ago)
      });
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') return sameDayOpen;
        return supaMock.getTableBuilder(table);
      });

      const alreadyRes = await recordAttendanceByCard({ cardNumber: 'LIB-1001', mode: 'in', isManual: false });
      expect(alreadyRes).toMatchObject({
        success: true,
        data: { status: 'ALREADY_IN', outcome: 'ALREADY_IN' },
      });
      expect(sameDayOpen.update).not.toHaveBeenCalled();

      // Yesterday open record with custom closing time 19:30 -> closes at 2026-06-14 19:30 Manila (11:30Z)
      const yesterdayOpen = createMockQueryBuilder({
        id: 'att-yday-custom',
        check_in_at: '2026-06-14T02:00:00Z',
      });
      const closeBuilder = createMockQueryBuilder(null);
      const insertBuilder = createMockQueryBuilder(null);
      let attCalls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          attCalls += 1;
          if (attCalls === 1) return yesterdayOpen;
          if (attCalls === 2) return closeBuilder;
          return insertBuilder;
        }
        return supaMock.getTableBuilder(table);
      });

      const customRes = await recordAttendanceByCard({ cardNumber: 'LIB-1001', mode: 'in', isManual: true });
      expect(closeBuilder.update).toHaveBeenCalledWith({
        check_out_at: '2026-06-14T11:30:00.000Z',
        notes: 'No Log Out',
      });
      expect(customRes.success && customRes.data.outcome).toBe('CHECKED_IN');
    });

    it('keeps a same-day session open after closing: evening check-out closes normally and a repeat scan does not duplicate (P4-ATT-003/006)', async () => {
      vi.useFakeTimers();
      // 2026-06-15 18:00 Manila = 10:00Z, past the 17:00 closing time
      vi.setSystemTime(new Date('2026-06-15T10:00:00Z'));
      supaMock.setTableResponse('library_cards', {
        user_id: 'patron-1',
        profiles: { full_name: 'Maria Clara', status: 'ACTIVE' },
      });
      supaMock.setTableResponse('system_settings', { value: '17:00' });

      // Checked in at 17:30 Manila (09:30Z). A second "in" scan must not close it and open another row.
      const openEvening = createMockQueryBuilder({ id: 'att-evening', check_in_at: '2026-06-15T09:30:00Z' });
      supaMock.from.mockImplementation((table: string) =>
        table === 'attendance' ? openEvening : supaMock.getTableBuilder(table)
      );
      const again = await recordAttendanceByCard({ cardNumber: 'LIB-1001', mode: 'in', isManual: false });
      expect(again).toMatchObject({ success: true, data: { outcome: 'ALREADY_IN' } });
      expect(openEvening.update).not.toHaveBeenCalled();
      expect(openEvening.insert).not.toHaveBeenCalled();

      // Checking out at 18:00 records the real time, without the No Log Out note.
      const outBuilder = createMockQueryBuilder(null);
      let attCalls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table !== 'attendance') return supaMock.getTableBuilder(table);
        attCalls += 1;
        return attCalls === 1 ? openEvening : outBuilder;
      });
      const out = await recordAttendanceByCard({ cardNumber: 'LIB-1001', mode: 'out', isManual: false });
      expect(outBuilder.update).toHaveBeenCalledWith({ check_out_at: '2026-06-15T10:00:00.000Z' });
      expect(out).toMatchObject({ success: true, data: { outcome: 'CHECKED_OUT', recordedAt: '2026-06-15T10:00:00.000Z' } });
    });

    it('falls back to 17:00 closing when the setting is invalid when closing a stale record', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T01:00:00Z')); // 09:00 Manila next day
      supaMock.setTableResponse('library_cards', {
        user_id: 'patron-1',
        profiles: { full_name: 'Maria Clara', status: 'ACTIVE' },
      });
      supaMock.setTableResponse('system_settings', { value: 'invalid-time' });

      const yesterdayOpen = createMockQueryBuilder({ id: 'att-y', check_in_at: '2026-06-14T01:00:00Z' });
      const closeBuilder = createMockQueryBuilder(null);
      const insertBuilder = createMockQueryBuilder(null);
      let attCalls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table !== 'attendance') return supaMock.getTableBuilder(table);
        attCalls += 1;
        return attCalls === 1 ? yesterdayOpen : attCalls === 2 ? closeBuilder : insertBuilder;
      });

      const res = await recordAttendanceByCard({ cardNumber: 'LIB-1001', mode: 'in', isManual: false });
      expect(closeBuilder.update).toHaveBeenCalledWith({
        check_out_at: '2026-06-14T09:00:00.000Z', // 17:00 Manila on the check-in day
        notes: 'No Log Out',
      });
      expect(res.success && res.data.outcome).toBe('CHECKED_IN');
    });

    it.each([false, true])(
      'mode=out on a stale open record (isManual=%s) closes it as No Log Out at closing time (not now) and returns a clear message',
      async (isManual) => {
        vi.useFakeTimers();
        // 2026-06-15 08:30 Manila = 2026-06-15T00:30:00Z
        vi.setSystemTime(new Date('2026-06-15T00:30:00Z'));

        supaMock.setTableResponse('library_cards', {
          user_id: 'patron-1',
          profiles: { full_name: 'Maria Clara', status: 'ACTIVE' },
        });
        supaMock.setTableResponse('system_settings', { value: '17:00' });

        const yesterdayOpen = createMockQueryBuilder({
          id: 'att-stale-out',
          check_in_at: '2026-06-14T02:00:00Z', // 10:00 Manila yesterday
        });
        const updateBuilder = createMockQueryBuilder(null);
        let attCalls = 0;
        supaMock.from.mockImplementation((table: string) => {
          if (table === 'attendance') {
            attCalls += 1;
            return attCalls === 1 ? yesterdayOpen : updateBuilder;
          }
          return supaMock.getTableBuilder(table);
        });

        const res = await recordAttendanceByCard({ cardNumber: 'LIB-1001', mode: 'out', isManual });

        expect(updateBuilder.update).toHaveBeenCalledWith({
          check_out_at: '2026-06-14T09:00:00.000Z',
          notes: 'No Log Out',
        });
        expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'att-stale-out');
        expect(res).toEqual({
          success: true,
          data: {
            status: 'OUT',
            outcome: 'CHECKED_OUT',
            recordedAt: '2026-06-14T09:00:00.000Z',
            message: 'Previous check-in for Maria Clara closed as No Log Out.',
            description: 'Closed previous session as No Log Out.',
            userName: 'Maria Clara',
            userId: 'patron-1',
          },
        });
      }
    );

    it('surfaces DB error when closing a stale record in mode=in and aborts new check-in', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T00:00:00Z'));

      supaMock.setTableResponse('library_cards', {
        user_id: 'patron-1',
        profiles: { full_name: 'Maria Clara', status: 'ACTIVE' },
      });

      const yesterdayOpen = createMockQueryBuilder({
        id: 'att-err',
        check_in_at: '2026-06-14T01:00:00Z',
      });
      const closeErr = createMockQueryBuilder(null, { message: 'close update failed' });
      let attCalls = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          attCalls += 1;
          return attCalls === 1 ? yesterdayOpen : closeErr;
        }
        return supaMock.getTableBuilder(table);
      });

      expect(await recordAttendanceByCard({ cardNumber: 'LIB-1001', mode: 'in' })).toEqual({
        success: false,
        error: 'Failed to close previous attendance session.',
      });
    });
  });

  describe('getAttendanceHistory', () => {
    it('applies Manila date bounds and patron search before the staff history limit', async () => {
      const older = { id: 'older', check_in_at: '2024-03-01T15:59:59.999Z', user_id: 'patron-1', check_out_at: null };
      supaMock.setTableResponse('attendance', [older]);

      expect(await getAttendanceHistory(undefined, {
        range: 'all', limit: 300, search: '2024-0001', dateRange: { from: '2024-03-01', to: '2024-03-01' },
      })).toMatchObject([older]);

      const query = supaMock.getTableBuilder('attendance');
      expect(query.gte).toHaveBeenCalledWith('check_in_at', '2024-03-01T00:00:00+08:00');
      expect(query.lt).toHaveBeenCalledWith('check_in_at', '2024-03-01T16:00:00.000Z');
      expect(query.or).toHaveBeenCalledWith('full_name.ilike.%2024-0001%,student_id.ilike.%2024-0001%', { referencedTable: 'profiles' });
      expect(query.gte.mock.invocationCallOrder[0]).toBeLessThan(query.limit.mock.invocationCallOrder[0]);
      expect(query.lt.mock.invocationCallOrder[0]).toBeLessThan(query.limit.mock.invocationCallOrder[0]);
    });

    it('fetches the next database batch with the same one-sided filter', async () => {
      const first = createMockQueryBuilder(Array.from({ length: 1000 }, (_, i) => ({ id: `current-${i}` })));
      const second = createMockQueryBuilder([{ id: 'older' }]);
      supaMock.from.mockReturnValueOnce(first).mockReturnValueOnce(second);

      const rows = await getAttendanceHistory(undefined, { range: 'all', limit: 1200, dateRange: { to: '2024-02-29' } });
      expect(rows).toHaveLength(1001);
      expect(rows.at(-1)?.id).toBe('older');
      expect(first.range).toHaveBeenCalledWith(0, 999);
      expect(second.range).toHaveBeenCalledWith(1000, 1199);
      for (const query of [first, second]) {
        expect(query.lt).toHaveBeenCalledWith('check_in_at', '2024-02-29T16:00:00.000Z');
        expect(query.gte).not.toHaveBeenCalled();
      }
    });

    it('rejects impossible or reversed dates and blocks staff date filters without attendance access', async () => {
      for (const dateRange of [{ from: '2026-02-29' }, { from: '2024-03-02', to: '2024-03-01' }]) {
        await expect(getAttendanceHistory(undefined, { range: 'all', limit: 25, dateRange })).rejects.toThrow('Invalid date range');
      }
      for (const profile of [
        { role: 'patron' },
        { role: 'library_staff', manageAttendance: false },
        { role: 'library_staff', isDeactivatedSA: true },
      ] as const) {
        mockGetMe.mockResolvedValue(makeAuthContext(supaMock.client, profile));
        await expect(getAttendanceHistory(undefined, { range: 'all', limit: 25, dateRange: { from: '2024-03-01' } })).rejects.toThrow('Forbidden');
      }
      expect(supaMock.from).not.toHaveBeenCalled();
    });

    it('throws Unauthorized when unauthenticated and Forbidden when a student queries another user', async () => {
      mockGetMe.mockResolvedValue(null);
      await expect(getAttendanceHistory()).rejects.toThrow('Unauthorized');

      mockGetMe.mockResolvedValue(makeAuthContext(supaMock.client, { id: 'student-1', role: 'patron' }));
      await expect(getAttendanceHistory('student-2')).rejects.toThrow('Forbidden');
    });

    it('returns staff today records with sanitized search and limit, unwrapping array profiles', async () => {
      vi.useFakeTimers();
      // 2026-06-15T17:00:00Z = 2026-06-16 01:00:00 Asia/Manila -> Manila date is 2026-06-16
      vi.setSystemTime(new Date('2026-06-15T17:00:00Z'));

      supaMock.setTableResponse('attendance', [
        {
          id: 'a1',
          check_in_at: '2026-06-16T00:10:00Z',
          check_out_at: null,
          user_id: 'stu-1',
          notes: null,
          profiles: [{ full_name: 'Maria Clara', student_id: '2024-0001' }],
        },
      ]);

      const res = await getAttendanceHistory(undefined, {
        range: 'today',
        limit: 25,
        search: 'Maria,(test)%*',
      });

      const builder = supaMock.getTableBuilder('attendance');
      expect(builder.select).toHaveBeenCalledWith(
        'id, check_in_at, check_out_at, user_id, notes, profiles!inner(full_name, student_id)'
      );
      expect(builder.gte).toHaveBeenCalledWith('check_in_at', '2026-06-16T00:00:00+08:00');
      expect(builder.or).toHaveBeenCalledWith(
        'full_name.ilike.%Maria  test%,student_id.ilike.%Maria  test%',
        { referencedTable: 'profiles' }
      );
      expect(builder.limit).toHaveBeenCalledWith(25);
      expect(res).toEqual([
        {
          id: 'a1',
          check_in_at: '2026-06-16T00:10:00Z',
          check_out_at: null,
          user_id: 'stu-1',
          notes: null,
          profiles: { full_name: 'Maria Clara', student_id: '2024-0001' },
        },
      ]);
    });

    it('paginates staff all-range records across multiple 1000-row pages and surfaces DB errors', async () => {
      const firstPage = Array.from({ length: 1000 }, (_, i) => ({
        id: `a-${i}`,
        check_in_at: '2026-06-14T01:00:00Z',
        check_out_at: '2026-06-14T02:00:00Z',
        user_id: 'stu-1',
        profiles: { full_name: 'Maria Clara', student_id: '2024-0001' },
      }));
      const secondPage = [
        {
          id: 'a-1000',
          check_in_at: '2026-06-13T01:00:00Z',
          check_out_at: null,
          user_id: 'stu-2',
          profiles: [{ full_name: 'Jose Rizal', student_id: '2024-0002' }],
        },
      ];

      const page1Builder = createMockQueryBuilder(firstPage);
      const page2Builder = createMockQueryBuilder(secondPage);
      let call = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          call += 1;
          return call === 1 ? page1Builder : page2Builder;
        }
        return supaMock.getTableBuilder(table);
      });

      const res = await getAttendanceHistory(undefined, { range: 'all' });
      expect(res).toHaveLength(1001);
      expect(page1Builder.range).toHaveBeenCalledWith(0, 999);
      expect(page2Builder.range).toHaveBeenCalledWith(1000, 1999);
      expect(res[1000].profiles).toEqual({ full_name: 'Jose Rizal', student_id: '2024-0002' });
    });

    it('handles student personal limited & paginated queries and throws on attendance DB errors', async () => {
      mockGetMe.mockResolvedValue(makeAuthContext(supaMock.client, { id: 'student-1', role: 'patron' }));
      supaMock.setTableResponse('attendance', [
        {
          id: 'p1',
          check_in_at: '2026-06-15T02:00:00Z',
          check_out_at: null,
          user_id: 'student-1',
          profiles: [{ full_name: 'Student One', student_id: '2024-0010' }],
        },
      ]);

      const ownRes = await getAttendanceHistory(undefined, { limit: 5 });
      expect(ownRes).toHaveLength(1);
      expect(ownRes[0].profiles).toEqual({ full_name: 'Student One', student_id: '2024-0010' });

      // Staff limited query error
      mockGetMe.mockResolvedValue(makeAuthContext(supaMock.client, { role: 'librarian' }));
      supaMock.setTableResponse('attendance', null, { message: 'staff limit error' });
      await expect(getAttendanceHistory(undefined, { limit: 5 })).rejects.toEqual({
        message: 'staff limit error',
      });

      // Staff paginated query error
      supaMock.setTableResponse('attendance', null, { message: 'staff page error' });
      await expect(getAttendanceHistory(undefined, { range: 'all' })).rejects.toEqual({
        message: 'staff page error',
      });

      // Staff today range without limit exercises today branch in paginated loop
      supaMock.setTableResponse('attendance', [
        {
          id: 'today-1',
          check_in_at: '2026-06-15T01:00:00Z',
          check_out_at: null,
          user_id: 'stu-1',
          profiles: null,
        },
      ]);
      const staffNoSearch = await getAttendanceHistory(undefined, { range: 'all', limit: 10 });
      expect(staffNoSearch).toHaveLength(1);

      // Staff default today range without limit (covers range='today' paginated branch)
      const todayBuilder = createMockQueryBuilder([
        {
          id: 't-1',
          check_in_at: '2026-06-15T02:00:00Z',
          check_out_at: null,
          user_id: 'stu-1',
          profiles: null,
        },
      ]);
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') return todayBuilder;
        return supaMock.getTableBuilder(table);
      });
      const todayRows = await getAttendanceHistory();
      expect(todayRows).toHaveLength(1);
      expect(todayBuilder.gte).toHaveBeenCalled();

      // Personal paginated multi-page loop & personal errors
      mockGetMe.mockResolvedValue(makeAuthContext(supaMock.client, { id: 'staff-1', role: 'librarian' }));
      const pPage1 = createMockQueryBuilder(
        Array.from({ length: 1000 }, (_, i) => ({
          id: `u-${i}`,
          check_in_at: '2026-06-15T01:00:00Z',
          check_out_at: null,
          user_id: 'target-user',
          profiles: { full_name: 'Target', student_id: '2024-99' },
        }))
      );
      const pPage2 = createMockQueryBuilder([
        {
          id: 'u-1000',
          check_in_at: '2026-06-14T01:00:00Z',
          check_out_at: null,
          user_id: 'target-user',
          profiles: [{ full_name: 'Target', student_id: '2024-99' }],
        },
      ]);
      let pCall = 0;
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') {
          pCall += 1;
          return pCall === 1 ? pPage1 : pPage2;
        }
        return supaMock.getTableBuilder(table);
      });
      const targetUserRows = await getAttendanceHistory('target-user');
      expect(targetUserRows).toHaveLength(1001);

      // Personal limited & paginated DB errors
      const errBuilder = createMockQueryBuilder(null, { message: 'personal query failed' });
      supaMock.from.mockImplementation((table: string) => {
        if (table === 'attendance') return errBuilder;
        return supaMock.getTableBuilder(table);
      });
      await expect(getAttendanceHistory('target-user', { limit: 3 })).rejects.toEqual({
        message: 'personal query failed',
      });
      await expect(getAttendanceHistory('target-user')).rejects.toEqual({
        message: 'personal query failed',
      });
    });
  });
});
