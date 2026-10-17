import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toggleAttendanceByCard, getAttendanceHistory } from '../attendance';
import { getMe } from '@/lib/auth-helpers';
import { sendNotification } from '@/lib/notifications';
import { revalidatePath } from 'next/cache';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';
import type { ProfileData, UserRole } from '@/lib/types';

vi.mock('@/lib/auth-helpers', () => ({
  getMe: vi.fn(),
}));

vi.mock('@/lib/notifications', () => ({
  sendNotification: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditActivity: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Attendance Server Actions', () => {
  let mockClientHelper: MockSupabaseClientHelper;

  const mockStaffUser = (
    role: UserRole = 'librarian',
    id = 'staff-user-1',
    permissions: Record<string, boolean> = { manage_attendance: true }
  ) => ({
    user: {
      id,
      email: 'staff@school.edu',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id,
      email: 'staff@school.edu',
      role,
      status: 'ACTIVE',
      full_name: 'Library Staff',
      permissions,
    } as unknown as ProfileData,
    role,
    isStaff: true,
    isAdmin: role === 'super_admin',
    isDeactivatedSA: false,
    hasPermission: vi.fn((perm: string) => Boolean(permissions[perm])),
    supabase: mockClientHelper.client,
  });

  const mockStudentUser = (id = 'student-user-1') => ({
    user: {
      id,
      email: 'student@school.edu',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    },
    profile: {
      id,
      email: 'student@school.edu',
      role: 'student' as UserRole,
      status: 'ACTIVE',
      full_name: 'Student User',
      permissions: {},
    } as unknown as ProfileData,
    role: 'student' as UserRole,
    isStaff: false,
    isAdmin: false,
    isDeactivatedSA: false,
    hasPermission: vi.fn().mockReturnValue(false),
    supabase: mockClientHelper.client,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockClientHelper = createMockSupabaseClient();
    vi.mocked(getMe).mockResolvedValue(
      mockStaffUser() as unknown as Awaited<ReturnType<typeof getMe>>
    );
    vi.mocked(sendNotification).mockResolvedValue({ success: true });
  });

  describe('toggleAttendanceByCard', () => {
    it('rejects unauthenticated callers', async () => {
      vi.mocked(getMe).mockResolvedValue(null);

      const result = await toggleAttendanceByCard({ cardNumber: 'CARD-123' });

      expect(result).toEqual({
        success: false,
        error: 'Authentication required',
      });
    });

    it('rejects unauthorized roles like student', async () => {
      vi.mocked(getMe).mockResolvedValue(
        mockStudentUser() as unknown as Awaited<ReturnType<typeof getMe>>
      );

      const result = await toggleAttendanceByCard({ cardNumber: 'CARD-123' });

      expect(result).toEqual({
        success: false,
        error: 'Unauthorized access',
      });
    });

    it('rejects deactivated student assistant accounts', async () => {
      const deactivatedSA = {
        ...mockStaffUser('student_assistant'),
        isDeactivatedSA: true,
      };
      vi.mocked(getMe).mockResolvedValue(
        deactivatedSA as unknown as Awaited<ReturnType<typeof getMe>>
      );

      const result = await toggleAttendanceByCard({ cardNumber: 'CARD-123' });

      expect(result).toEqual({
        success: false,
        error: 'Access denied: Staff account is currently deactivated.',
      });
    });

    it('rejects student assistant missing manage_attendance permission', async () => {
      const saWithoutPerm = {
        ...mockStaffUser('student_assistant', 'sa-1', { manage_attendance: false }),
        hasPermission: vi.fn().mockReturnValue(false),
      };
      vi.mocked(getMe).mockResolvedValue(
        saWithoutPerm as unknown as Awaited<ReturnType<typeof getMe>>
      );

      const result = await toggleAttendanceByCard({ cardNumber: 'CARD-123' });

      expect(result).toEqual({
        success: false,
        error: 'Access denied: Missing required permission.',
      });
    });

    it('checks in user when no active attendance session exists', async () => {
      // 1. Library card exists
      mockClientHelper.setTableResponse('library_cards', {
        user_id: 'patron-100',
        profiles: { full_name: 'John Doe', status: 'ACTIVE' },
      });

      // 2. Active attendance session does not exist
      mockClientHelper.setTableResponse('attendance', null);

      const result = await toggleAttendanceByCard({ cardNumber: 'LC-9999' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        status: 'IN',
        message: 'Welcome, John Doe!',
        description: 'Timed in successfully.',
        userName: 'John Doe',
      });

      const attendanceBuilder = mockClientHelper.getTableBuilder('attendance');
      expect(attendanceBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'patron-100',
          check_in_at: expect.any(String),
        })
      );

      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'patron-100',
          title: 'Attendance: Time In',
          type: 'SYSTEM',
        })
      );

      expect(revalidatePath).toHaveBeenCalledWith('/attendance', 'page');
      expect(revalidatePath).toHaveBeenCalledWith('/dashboard', 'page');
    });

    it('checks out user when an active attendance session is open', async () => {
      // 1. Library card exists
      mockClientHelper.setTableResponse('library_cards', {
        user_id: 'patron-100',
        profiles: [{ full_name: 'Jane Smith', status: 'ACTIVE' }],
      });

      // 2. Open attendance record exists
      const openRecord = { id: 'att-session-1', check_in_at: '2026-10-06T08:00:00Z' };
      mockClientHelper.setTableResponse('attendance', openRecord);

      const result = await toggleAttendanceByCard({ cardNumber: 'LC-9999' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        status: 'OUT',
        message: 'Goodbye, Jane Smith!',
        description: 'Timed out successfully.',
        userName: 'Jane Smith',
      });

      const attendanceBuilder = mockClientHelper.getTableBuilder('attendance');
      expect(attendanceBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          check_out_at: expect.any(String),
        })
      );
      expect(attendanceBuilder.eq).toHaveBeenCalledWith('id', 'att-session-1');

      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'patron-100',
          title: 'Attendance: Time Out',
          type: 'SYSTEM',
        })
      );
    });

    it('falls back to student ID lookup when card is not found', async () => {
      // Library card returns null
      mockClientHelper.setTableResponse('library_cards', null);

      // Profiles table finds student by student_id
      mockClientHelper.setTableResponse('profiles', {
        id: 'patron-200',
        full_name: 'Bob Ross',
        status: 'ACTIVE',
      });

      // No open attendance session
      mockClientHelper.setTableResponse('attendance', null);

      const result = await toggleAttendanceByCard({ cardNumber: '2023-00123' });

      expect(result.success).toBe(true);
      expect(result.data?.userName).toBe('Bob Ross');
      expect(result.data?.status).toBe('IN');

      const profilesBuilder = mockClientHelper.getTableBuilder('profiles');
      expect(profilesBuilder.eq).toHaveBeenCalledWith('student_id', '2023-00123');
    });

    it('rejects with descriptive message when identifier is not found (card and student_id fail)', async () => {
      mockClientHelper.setTableResponse('library_cards', null);
      mockClientHelper.setTableResponse('profiles', null);

      // Scanner scan (isManual: false)
      const scanResult = await toggleAttendanceByCard({ cardNumber: 'UNKNOWN-ID', isManual: false });
      expect(scanResult.success).toBe(false);
      expect(scanResult.error).toContain('Invalid or inactive library card');

      // Manual entry (isManual: true)
      const manualResult = await toggleAttendanceByCard({ cardNumber: 'UNKNOWN-ID', isManual: true });
      expect(manualResult.success).toBe(false);
      expect(manualResult.error).toContain('The identifier is not recognized by the system');
    });

    it('rejects attendance toggle when patron account is inactive or suspended', async () => {
      mockClientHelper.setTableResponse('library_cards', {
        user_id: 'patron-suspended',
        profiles: { full_name: 'Suspended Patron', status: 'SUSPENDED' },
      });

      const result = await toggleAttendanceByCard({ cardNumber: 'CARD-SUSPENDED' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('User account is suspended. Attendance restricted.');
    });

    it('handles database error when querying library cards', async () => {
      mockClientHelper.setTableResponse('library_cards', null, { message: 'DB connection failure' });

      const result = await toggleAttendanceByCard({ cardNumber: 'CARD-ERROR' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error while checking library card.');
    });

    it('handles database error when registering Time In', async () => {
      mockClientHelper.setTableResponse('library_cards', {
        user_id: 'patron-100',
        profiles: { full_name: 'John Doe', status: 'ACTIVE' },
      });

      // No active session, but insert fails
      const attBuilder = mockClientHelper.getTableBuilder('attendance');
      attBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      attBuilder.insert.mockImplementationOnce(() => ({
        error: { message: 'Insert constraint error' },
      }));

      const result = await toggleAttendanceByCard({ cardNumber: 'CARD-100' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to register Time In.');
    });
  });

  describe('getAttendanceHistory', () => {
    it('throws Unauthorized when caller is not authenticated', async () => {
      vi.mocked(getMe).mockResolvedValue(null);

      await expect(getAttendanceHistory()).rejects.toThrow('Unauthorized');
    });

    it('retrieves all of today records when staff user does not pass a userId', async () => {
      const todayRecords = [
        {
          id: 'att-1',
          check_in_at: '2026-10-06T09:00:00Z',
          check_out_at: '2026-10-06T11:00:00Z',
          user_id: 'u-1',
          profiles: { full_name: 'Alice' },
        },
        {
          id: 'att-2',
          check_in_at: '2026-10-06T08:30:00Z',
          check_out_at: null,
          user_id: 'u-2',
          profiles: [{ full_name: 'Bob' }], // Array profile test
        },
      ];
      mockClientHelper.setTableResponse('attendance', todayRecords);

      const result = await getAttendanceHistory();

      const attendanceBuilder = mockClientHelper.getTableBuilder('attendance');
      expect(attendanceBuilder.gte).toHaveBeenCalledWith('check_in_at', expect.any(String));
      expect(attendanceBuilder.order).toHaveBeenCalledWith('check_in_at', { ascending: false });

      expect(result).toEqual([
        { ...todayRecords[0], profiles: { full_name: 'Alice' } },
        { ...todayRecords[1], profiles: { full_name: 'Bob' } },
      ]);
    });

    it('retrieves targeted user attendance history for staff caller', async () => {
      const userRecords = [
        {
          id: 'att-3',
          check_in_at: '2026-10-05T08:00:00Z',
          check_out_at: '2026-10-05T10:00:00Z',
          user_id: 'target-student-id',
          profiles: { full_name: 'Charlie' },
        },
      ];
      mockClientHelper.setTableResponse('attendance', userRecords);

      const result = await getAttendanceHistory('target-student-id');

      const attendanceBuilder = mockClientHelper.getTableBuilder('attendance');
      expect(attendanceBuilder.eq).toHaveBeenCalledWith('user_id', 'target-student-id');
      expect(result).toEqual(userRecords);
    });

    it('allows student to query their own attendance history', async () => {
      const student = mockStudentUser('my-student-id');
      vi.mocked(getMe).mockResolvedValue(
        student as unknown as Awaited<ReturnType<typeof getMe>>
      );

      const myRecords = [
        {
          id: 'att-4',
          check_in_at: '2026-10-06T10:00:00Z',
          check_out_at: null,
          user_id: 'my-student-id',
          profiles: { full_name: 'Student User' },
        },
      ];
      mockClientHelper.setTableResponse('attendance', myRecords);

      const result = await getAttendanceHistory();

      const attendanceBuilder = mockClientHelper.getTableBuilder('attendance');
      expect(attendanceBuilder.eq).toHaveBeenCalledWith('user_id', 'my-student-id');
      expect(result).toEqual(myRecords);
    });

    it('rejects student attempting to view another user attendance history with Forbidden', async () => {
      const student = mockStudentUser('my-student-id');
      vi.mocked(getMe).mockResolvedValue(
        student as unknown as Awaited<ReturnType<typeof getMe>>
      );

      await expect(getAttendanceHistory('other-student-id')).rejects.toThrow('Forbidden');
    });

    it('throws error when database query fails during history lookup', async () => {
      mockClientHelper.setTableResponse('attendance', null, { message: 'Database read error' });

      await expect(getAttendanceHistory()).rejects.toThrow('Database read error');
    });
  });
});
