import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAcademicPrograms, submitOnboarding } from '../onboarding';
import { updateAvatarUrl } from '../profile';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { logAuditActivity } from '@/lib/audit';
import { ensureStaticLibraryCardAssets } from '@/lib/library-card-assets.server';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  logAuditActivity: vi.fn(),
}));

vi.mock('@/lib/library-card-assets.server', () => ({
  ensureStaticLibraryCardAssets: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Onboarding & Profile Server Actions', () => {
  let mockSupabaseHelper: MockSupabaseClientHelper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseHelper = createMockSupabaseClient();
    vi.mocked(createClient).mockResolvedValue(
      mockSupabaseHelper.client as unknown as Awaited<ReturnType<typeof createClient>>
    );
    vi.mocked(logAuditActivity).mockResolvedValue(undefined);
    vi.mocked(ensureStaticLibraryCardAssets).mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof ensureStaticLibraryCardAssets>>);
  });

  describe('getAcademicPrograms', () => {
    it('returns default programs list when system setting is missing or query fails', async () => {
      mockSupabaseHelper.setTableResponse('system_settings', null, new Error('Table not found'));

      const programs = await getAcademicPrograms();

      expect(programs).toEqual([
        'Information Technology',
        'Computer Science',
        'Business Administration',
        'Engineering',
      ]);
    });

    it('parses valid JSON array formatted settings', async () => {
      mockSupabaseHelper.setTableResponse('system_settings', {
        value: '["BSIT", "BSCS", "BSBA", "BSHM"]',
      });

      const programs = await getAcademicPrograms();

      expect(programs).toEqual(['BSIT', 'BSCS', 'BSBA', 'BSHM']);
    });

    it('parses comma-separated string formatted settings', async () => {
      mockSupabaseHelper.setTableResponse('system_settings', {
        value: 'Information Technology, Computer Science, Accountancy',
      });

      const programs = await getAcademicPrograms();

      expect(programs).toEqual([
        'Information Technology',
        'Computer Science',
        'Accountancy',
      ]);
    });

    it('falls back to comma-separated parsing if JSON parsing fails', async () => {
      mockSupabaseHelper.setTableResponse('system_settings', {
        value: '[Invalid JSON, Fallback Program]',
      });

      const programs = await getAcademicPrograms();

      expect(programs).toEqual(['[Invalid JSON', 'Fallback Program]']);
    });
  });

  describe('submitOnboarding', () => {
    const validFormData = {
      address: '123 Academic Way',
      phone: '09123456789',
      department: 'College of Information Technology',
    };

    it('throws Unauthorized error when user is not logged in', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(submitOnboarding(validFormData)).rejects.toThrow('Unauthorized');
    });

    it('derives student ID from STI student email and completes onboarding', async () => {
      const mockUser = {
        id: 'user-stu-1',
        email: 'juan.delacruz.202401@alabang.sti.edu.ph',
      };
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Existing profile has no student_id yet
      mockSupabaseHelper.setTableResponse('profiles', {
        student_id: null,
        role: 'student',
        email: mockUser.email,
      });

      const result = await submitOnboarding(validFormData);

      expect(result).toEqual({ success: true });
      const profilesBuilder = mockSupabaseHelper.getTableBuilder('profiles');
      expect(profilesBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          address: '123 Academic Way',
          phone: '09123456789',
          department: 'College of Information Technology',
          onboarding_completed: true,
          status: 'PENDING',
          student_id: 'STU-202401',
          updated_at: expect.any(String),
        })
      );
      expect(logAuditActivity).toHaveBeenCalledWith(
        'user-stu-1',
        'profile',
        'user-stu-1',
        'onboarding_completed',
        'Completed onboarding and profile setup.',
        expect.objectContaining({
          address: '123 Academic Way',
          student_id_assigned: 'STU-202401',
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith('/');
    });

    it('does not overwrite existing student_id when already present in profile', async () => {
      const mockUser = {
        id: 'user-stu-existing',
        email: 'maria.santos@gmail.com',
      };
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Profile already has assigned student_id
      mockSupabaseHelper.setTableResponse('profiles', {
        student_id: 'STU-2023-999',
        role: 'student',
        email: mockUser.email,
      });

      const result = await submitOnboarding(validFormData);

      expect(result).toEqual({ success: true });
      const profilesBuilder = mockSupabaseHelper.getTableBuilder('profiles');
      const updateCallArg = profilesBuilder.update.mock.calls[0][0] as Record<string, unknown>;
      // student_id should NOT be modified in update payload
      expect(updateCallArg.student_id).toBeUndefined();
      expect(updateCallArg.onboarding_completed).toBe(true);
    });

    it('derives unique faculty ID for faculty email when no student ID is set', async () => {
      const mockUser = {
        id: 'user-fac-1',
        email: 'prof.smith@alabang.sti.edu.ph',
      };
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseHelper.setTableResponse('profiles', {
        student_id: null,
        role: 'librarian',
        email: mockUser.email,
      });

      const result = await submitOnboarding(validFormData);

      expect(result).toEqual({ success: true });
      const profilesBuilder = mockSupabaseHelper.getTableBuilder('profiles');
      const updateCallArg = profilesBuilder.update.mock.calls[0][0] as Record<string, unknown>;
      expect(updateCallArg.student_id).toMatch(/^FAC-/);
    });

    it('throws error when database update fails', async () => {
      const mockUser = {
        id: 'user-error',
        email: 'user@example.com',
      };
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabaseHelper.setTableResponse('profiles', {
        student_id: null,
        role: 'student',
        email: mockUser.email,
      });

      // Inject error into profiles builder update
      const profilesBuilder = mockSupabaseHelper.getTableBuilder('profiles');
      profilesBuilder.update.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'Database constraint violation' } }),
      });

      await expect(submitOnboarding(validFormData)).rejects.toThrow(
        'Database constraint violation'
      );
    });
  });

  describe('updateAvatarUrl', () => {
    it('throws Unauthorized error when user is not authenticated', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(updateAvatarUrl('https://example.com/new-avatar.png')).rejects.toThrow(
        'Unauthorized'
      );
    });

    it('updates avatar URL, logs audit, and triggers static library card asset sync', async () => {
      const mockUser = {
        id: 'user-avatar-1',
        email: 'user@example.com',
      };
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const profilesBuilder = mockSupabaseHelper.getTableBuilder('profiles');
      profilesBuilder.update.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      const newAvatarUrl = 'https://example.com/custom-avatar.webp';
      const result = await updateAvatarUrl(newAvatarUrl);

      expect(result).toEqual({ success: true });
      expect(profilesBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          avatar_url: newAvatarUrl,
          updated_at: expect.any(String),
        })
      );
      expect(ensureStaticLibraryCardAssets).toHaveBeenCalledWith({
        userId: 'user-avatar-1',
        fallbackEmail: 'user@example.com',
        fallbackAvatarUrl: newAvatarUrl,
      });
      expect(logAuditActivity).toHaveBeenCalledWith(
        'user-avatar-1',
        'profile',
        'user-avatar-1',
        'avatar_updated',
        'Updated profile picture.',
        { avatar_url: newAvatarUrl }
      );
      expect(revalidatePath).toHaveBeenCalledWith('/profile');
    });

    it('throws friendly error when avatar update database query fails', async () => {
      const mockUser = {
        id: 'user-avatar-err',
        email: 'user@example.com',
      };
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const profilesBuilder = mockSupabaseHelper.getTableBuilder('profiles');
      profilesBuilder.update.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'Storage connection failure' } }),
      });

      await expect(updateAvatarUrl('https://example.com/avatar.png')).rejects.toThrow(
        'Failed to update profile picture.'
      );
    });

    it('still succeeds if static library card assets sync encounters an exception', async () => {
      const mockUser = {
        id: 'user-avatar-sync-fail',
        email: 'user@example.com',
      };
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const profilesBuilder = mockSupabaseHelper.getTableBuilder('profiles');
      profilesBuilder.update.mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      vi.mocked(ensureStaticLibraryCardAssets).mockRejectedValue(
        new Error('Sharp processing failed')
      );

      const result = await updateAvatarUrl('https://example.com/avatar.png');

      expect(result).toEqual({ success: true });
      expect(logAuditActivity).toHaveBeenCalled();
    });
  });
});
