import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAuditActivity } from '../audit';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { createMockSupabaseClient, type MockSupabaseClientHelper } from '@/test/mocks/supabase';

// Mock next/server with an `after` hook that runs callbacks
const mockAfter = vi.fn().mockImplementation((callback: () => Promise<unknown>) => {
  return callback();
});

vi.mock('next/server', () => ({
  after: (cb: () => Promise<unknown>) => mockAfter(cb),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Audit Service (logAuditActivity)', () => {
  let mockAdminHelper: MockSupabaseClientHelper;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminHelper = createMockSupabaseClient();
    vi.mocked(createAdminClient).mockReturnValue(
      mockAdminHelper.client as unknown as ReturnType<typeof createAdminClient>
    );
  });

  describe('Background Execution & Admin Client Insertion', () => {
    it('executes insertion inside next/server after() hook using createAdminClient', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      mockAdminHelper.from.mockReturnValue({
        insert: insertMock,
      });

      await logAuditActivity(
        'admin-uuid-1',
        'book',
        'book-uuid-99',
        'book_created',
        'Cataloged new acquisition',
        { title: 'The Pragmatic Programmer', copies: 3 },
        null,
        { id: 'book-uuid-99', title: 'The Pragmatic Programmer' }
      );

      // Verify createAdminClient was called to bypass RLS
      expect(createAdminClient).toHaveBeenCalled();

      // Verify next/server after() was invoked
      expect(mockAfter).toHaveBeenCalledTimes(1);

      // Verify audit_logs table insertion
      expect(mockAdminHelper.from).toHaveBeenCalledWith('audit_logs');
      expect(insertMock).toHaveBeenCalledWith({
        admin_id: 'admin-uuid-1',
        entity_type: 'book',
        entity_id: 'book-uuid-99',
        action: 'book_created',
        reason: 'Cataloged new acquisition',
        details: { title: 'The Pragmatic Programmer', copies: 3 },
        old_value: null,
        new_value: { id: 'book-uuid-99', title: 'The Pragmatic Programmer' },
      });

      // Verify success debug log
      expect(logger.debug).toHaveBeenCalledWith(
        'AUDIT_LOG_WRITTEN',
        'Audit recorded: book_created on book'
      );
    });

    it('handles null/undefined optional parameters with appropriate fallbacks', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      mockAdminHelper.from.mockReturnValue({
        insert: insertMock,
      });

      // Call with only actorId, entityType, and action
      await logAuditActivity(undefined, 'system', null, 'system_reboot');

      expect(insertMock).toHaveBeenCalledWith({
        admin_id: null,
        entity_type: 'system',
        entity_id: null,
        action: 'system_reboot',
        reason: null,
        details: {},
        old_value: null,
        new_value: null,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'AUDIT_LOG_WRITTEN',
        'Audit recorded: system_reboot on system'
      );
    });

    it('records audit events for diverse entity types (category, profile, policy, borrowing_record)', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      mockAdminHelper.from.mockReturnValue({
        insert: insertMock,
      });

      await logAuditActivity(
        'librarian-1',
        'category',
        'cat-1',
        'category_updated',
        'Updated description',
        { changed: ['description'] }
      );

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          admin_id: 'librarian-1',
          entity_type: 'category',
          entity_id: 'cat-1',
          action: 'category_updated',
        })
      );
    });
  });

  describe('Error Resilience & Non-blocking Guarantee', () => {
    it('catches and logs insertion errors without throwing to caller', async () => {
      const insertError = { message: 'Foreign key constraint violated on audit_logs' };
      const insertMock = vi.fn().mockResolvedValue({ error: insertError });
      mockAdminHelper.from.mockReturnValue({
        insert: insertMock,
      });

      // Must not throw
      await expect(
        logAuditActivity(
          'actor-1',
          'profile',
          'target-1',
          'role_change',
          'Promoted to staff'
        )
      ).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'AUDIT_APPEND_FAILED',
        'Could not persist to public.audit_logs',
        {
          error: insertError,
          action: 'role_change',
          entityId: 'target-1',
          actorId: 'actor-1',
        }
      );
    });

    it('catches fatal exceptions thrown during initialization without propagating to caller', async () => {
      vi.mocked(createAdminClient).mockImplementation(() => {
        throw new Error('Supabase admin client initialization failed');
      });

      // Must not throw
      await expect(
        logAuditActivity('actor-1', 'system', null, 'fatal_test')
      ).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        'AUDIT_FATAL_ERROR',
        'Exception thrown while initializing audit log',
        undefined,
        expect.any(Error)
      );
    });
  });
});
