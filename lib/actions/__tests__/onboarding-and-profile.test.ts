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

    it('completes onboarding without setting student_id (the database assigns it)', async () => {
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
          updated_at: expect.any(String),
        })
      );
      expect(profilesBuilder.update.mock.calls[0][0]).not.toHaveProperty('student_id');
      expect(logAuditActivity).toHaveBeenCalledWith(
        'user-stu-1',
        'profile',
        'user-stu-1',
        'onboarding_completed',
        'Completed onboarding and profile setup.',
        expect.objectContaining({
          address: '123 Academic Way',
        })
      );
      expect(revalidatePath).toHaveBeenCalledWith('/');
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
    const ownAvatar = (userId: string) => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${userId}/1.jpg`;

    it('throws Unauthorized error when user is not authenticated', async () => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(updateAvatarUrl('https://example.com/new-avatar.png')).rejects.toThrow(
        'Unauthorized'
      );
    });

    // C6: the avatar URL is downloaded server-side later, so only the user's own bucket folder is allowed.
    it.each([
      'https://example.com/a.png',
      'https://placeholder.supabase.co/storage/v1/object/public/avatars/someone-else/1.jpg',
      'https://placeholder.supabase.co/storage/v1/object/public/avatars/user-1/../x/1.jpg',
    ])('rejects avatar URL %s', async (url) => {
      mockSupabaseHelper.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
      await expect(updateAvatarUrl(url)).rejects.toThrow('Invalid avatar URL.');
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

      const newAvatarUrl = ownAvatar('user-avatar-1');
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

      await expect(updateAvatarUrl(ownAvatar('user-avatar-err'))).rejects.toThrow(
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

      const result = await updateAvatarUrl(ownAvatar('user-avatar-sync-fail'));

      expect(result).toEqual({ success: true });
      expect(logAuditActivity).toHaveBeenCalled();
    });
  });
});
