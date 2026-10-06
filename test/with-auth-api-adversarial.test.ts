import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { withAuthApi } from '@/lib/api-utils';
import { getMe } from '@/lib/auth-helpers';
import { isAbortError } from '@/lib/error-utils';
import { logger } from '@/lib/logger';
import { UserRole } from '@/lib/types';

// Mock Next.js NextResponse for hermetic execution in jsdom
vi.mock('next/server', () => {
  class NextResponseMock {
    body: unknown;
    status: number;
    options: unknown;
    constructor(body: unknown, options?: { status?: number } & Record<string, unknown>) {
      this.body = body;
      this.status = options?.status ?? 200;
      this.options = options;
      Object.assign(this, options || {});
    }
    static json = vi.fn((body: unknown, options?: { status?: number } & Record<string, unknown>) => ({
      body,
      status: options?.status ?? 200,
      ...(options || {}),
    }));
  }

  return {
    NextResponse: NextResponseMock,
  };
});

vi.mock('@/lib/auth-helpers', () => ({
  getMe: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/error-utils', () => ({
  isAbortError: vi.fn(),
}));

describe('Adversarial Challenge Suite: withAuthApi Security Boundaries', () => {
  let mockRequest: Request;
  let mockContext: { params: Promise<Record<string, string>> };
  let mockHandler: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest = new Request('http://localhost:3000/api/protected', {
      headers: {
        'x-forged-role': 'super_admin',
        Authorization: 'Bearer attacker-fake-token',
      },
    });
    mockContext = { params: Promise.resolve({ id: 'item-123' }) };
    mockHandler = vi.fn().mockResolvedValue({ status: 200, ok: true, data: 'secure_data' });
  });

  // =========================================================================
  // Challenge 1: Deactivated Student Assistant States
  // =========================================================================
  describe('Challenge 1: Deactivated Student Assistant States', () => {
    const deactivatedStatuses = [
      'INACTIVE',
      'inactive',
      'Inactive',
      'SUSPENDED',
      'suspended',
      'Suspended',
      'PENDING',
      'pending',
      'DEACTIVATED',
      'DISABLED',
      '',
      undefined,
      null,
    ];

    describe('when requireStaff is true', () => {
      deactivatedStatuses.forEach((status) => {
        it(`strictly blocks student_assistant with status "${status}" from staff-only routes`, async () => {
          (getMe as Mock).mockResolvedValue({
            user: { id: `sa-${status}` },
            profile: {
              id: `sa-${status}`,
              status,
              email: 'sa@test.edu',
              role: 'student_assistant',
              permissions: { manage_circulation: true },
            },
            role: 'student_assistant',
            supabase: {},
          });

          const wrappedHandler = withAuthApi(mockHandler, { requireStaff: true });
          const response = await wrappedHandler(mockRequest, mockContext);

          expect(response.status).toBe(403);
          expect(response).toEqual(
            expect.objectContaining({
              body: expect.objectContaining({
                ok: false,
                code: 'FORBIDDEN',
                message: 'Forbidden: Staff access required or account disabled',
              }),
            })
          );
          expect(mockHandler).not.toHaveBeenCalled();
        });
      });
    });

    describe('when allowedRoles specifies ["student_assistant"] only', () => {
      deactivatedStatuses.forEach((status) => {
        it(`strictly blocks student_assistant with status "${status}" when student role is not allowed`, async () => {
          (getMe as Mock).mockResolvedValue({
            user: { id: `sa-${status}` },
            profile: {
              id: `sa-${status}`,
              status,
              email: 'sa@test.edu',
              role: 'student_assistant',
            },
            role: 'student_assistant',
            supabase: {},
          });

          const wrappedHandler = withAuthApi(mockHandler, {
            allowedRoles: ['student_assistant'],
          });
          const response = await wrappedHandler(mockRequest, mockContext);

          expect(response.status).toBe(403);
          expect(response).toEqual(
            expect.objectContaining({
              body: expect.objectContaining({
                ok: false,
                code: 'FORBIDDEN',
                message: 'Forbidden: Insufficient permissions or account disabled',
              }),
            })
          );
          expect(mockHandler).not.toHaveBeenCalled();
        });
      });
    });

    describe('when allowedRoles allows both ["student", "student_assistant"]', () => {
      it('allows inactive student assistant to access general student endpoints as student fallback', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'sa-fallback' },
          profile: {
            id: 'sa-fallback',
            status: 'INACTIVE',
            email: 'sa@test.edu',
            role: 'student_assistant',
          },
          role: 'student_assistant',
          supabase: {},
        });

        const wrappedHandler = withAuthApi(mockHandler, {
          allowedRoles: ['student', 'student_assistant'],
        });
        const response = await wrappedHandler(mockRequest, mockContext);

        expect(response).toEqual(expect.objectContaining({ status: 200 }));
        expect(mockHandler).toHaveBeenCalledTimes(1);
      });

      it('strictly blocks inactive student assistant if allowedRoles only includes ["student"] but not "student_assistant"', async () => {
        // Because role is 'student_assistant', not 'student'
        (getMe as Mock).mockResolvedValue({
          user: { id: 'sa-fallback-denied' },
          profile: {
            id: 'sa-fallback-denied',
            status: 'INACTIVE',
            email: 'sa@test.edu',
            role: 'student_assistant',
          },
          role: 'student_assistant',
          supabase: {},
        });

        const wrappedHandler = withAuthApi(mockHandler, {
          allowedRoles: ['student'],
        });
        const response = await wrappedHandler(mockRequest, mockContext);

        expect(response.status).toBe(403);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    describe('when allowedPermissions is checked for student assistant', () => {
      deactivatedStatuses.forEach((status) => {
        it(`denies access to non-ACTIVE student_assistant with status "${status}" even if permission flag is true`, async () => {
          (getMe as Mock).mockResolvedValue({
            user: { id: `sa-perm-${status}` },
            profile: {
              id: `sa-perm-${status}`,
              status,
              email: 'sa@test.edu',
              role: 'student_assistant',
              permissions: { manage_circulation: true, manage_attendance: true },
            },
            role: 'student_assistant',
            supabase: {},
          });

          const wrappedHandler = withAuthApi(mockHandler, {
            allowedPermissions: ['manage_circulation'],
          });
          const response = await wrappedHandler(mockRequest, mockContext);

          expect(response.status).toBe(403);
          expect(response).toEqual(
            expect.objectContaining({
              body: expect.objectContaining({
                ok: false,
                code: 'FORBIDDEN',
                message: 'Forbidden: Account disabled',
              }),
            })
          );
          expect(mockHandler).not.toHaveBeenCalled();
        });
      });
    });

    describe('when student assistant is ACTIVE', () => {
      ['ACTIVE', 'active', 'Active'].forEach((activeStatus) => {
        it(`permits active student_assistant with status "${activeStatus}" under requireStaff`, async () => {
          (getMe as Mock).mockResolvedValue({
            user: { id: `sa-active-${activeStatus}` },
            profile: {
              id: `sa-active-${activeStatus}`,
              status: activeStatus,
              email: 'sa@test.edu',
              role: 'student_assistant',
            },
            role: 'student_assistant',
            supabase: {},
          });

          const wrappedHandler = withAuthApi(mockHandler, { requireStaff: true });
          const response = await wrappedHandler(mockRequest, mockContext);

          expect(response).toEqual(expect.objectContaining({ status: 200 }));
          expect(mockHandler).toHaveBeenCalledTimes(1);
        });
      });
    });
  });

  // =========================================================================
  // Challenge 2: Archived Account States
  // =========================================================================
  describe('Challenge 2: Archived Account States Across All Roles', () => {
    const roles: UserRole[] = ['super_admin', 'librarian', 'student_assistant', 'student'];
    const archivedVariations = ['ARCHIVED', 'archived', 'Archived', 'aRcHiVeD'];

    roles.forEach((role) => {
      archivedVariations.forEach((status) => {
        it(`denies ${role} with status "${status}" even with no endpoint options`, async () => {
          (getMe as Mock).mockResolvedValue({
            user: { id: `archived-${role}` },
            profile: {
              id: `archived-${role}`,
              status,
              email: `${role}@test.edu`,
              role,
            },
            role,
            supabase: {},
          });

          const wrappedHandler = withAuthApi(mockHandler);
          const response = await wrappedHandler(mockRequest, mockContext);

          expect(response.status).toBe(403);
          expect(response).toEqual(
            expect.objectContaining({
              body: expect.objectContaining({
                ok: false,
                code: 'FORBIDDEN',
                message: 'Account archived. Please contact administration.',
              }),
            })
          );
          expect(mockHandler).not.toHaveBeenCalled();
        });

        it(`denies archived ${role} even if endpoint explicitly allows their role`, async () => {
          (getMe as Mock).mockResolvedValue({
            user: { id: `archived-explicit-${role}` },
            profile: {
              id: `archived-explicit-${role}`,
              status,
              email: `${role}@test.edu`,
              role,
            },
            role,
            supabase: {},
          });

          const wrappedHandler = withAuthApi(mockHandler, {
            allowedRoles: [role],
          });
          const response = await wrappedHandler(mockRequest, mockContext);

          expect(response.status).toBe(403);
          expect(response).toEqual(
            expect.objectContaining({
              body: expect.objectContaining({
                ok: false,
                code: 'FORBIDDEN',
                message: 'Account archived. Please contact administration.',
              }),
            })
          );
          expect(mockHandler).not.toHaveBeenCalled();
        });
      });
    });
  });

  // =========================================================================
  // Challenge 3: Role Escalations and Privilege Boundaries
  // =========================================================================
  describe('Challenge 3: Role Escalations and Privilege Boundaries', () => {
    describe('Student role escalation attempts', () => {
      it('blocks student attempting to access super_admin only route', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'stu-attacker' },
          profile: { id: 'stu-attacker', status: 'ACTIVE', role: 'student' },
          role: 'student',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, { allowedRoles: ['super_admin'] });
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(403);
        expect(mockHandler).not.toHaveBeenCalled();
      });

      it('blocks student attempting to access librarian only route', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'stu-attacker' },
          profile: { id: 'stu-attacker', status: 'ACTIVE', role: 'student' },
          role: 'student',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, { allowedRoles: ['librarian'] });
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(403);
        expect(mockHandler).not.toHaveBeenCalled();
      });

      it('blocks student attempting to access student_assistant route', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'stu-attacker' },
          profile: { id: 'stu-attacker', status: 'ACTIVE', role: 'student' },
          role: 'student',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, { allowedRoles: ['student_assistant'] });
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(403);
        expect(mockHandler).not.toHaveBeenCalled();
      });

      it('blocks student attempting to access route requiring staff', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'stu-attacker' },
          profile: { id: 'stu-attacker', status: 'ACTIVE', role: 'student' },
          role: 'student',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, { requireStaff: true });
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(403);
        expect(mockHandler).not.toHaveBeenCalled();
      });

      it('blocks student attempting to access route with requireStaff and allowedPermissions', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'stu-attacker' },
          profile: { id: 'stu-attacker', status: 'ACTIVE', role: 'student' },
          role: 'student',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, {
          requireStaff: true,
          allowedPermissions: ['manage_circulation'],
        });
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(403);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    describe('Student Assistant privilege boundaries', () => {
      it('blocks active student assistant from librarian-only route', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'sa-user' },
          profile: { id: 'sa-user', status: 'ACTIVE', role: 'student_assistant' },
          role: 'student_assistant',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, { allowedRoles: ['librarian'] });
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(403);
        expect(mockHandler).not.toHaveBeenCalled();
      });

      it('blocks active student assistant from super_admin-only route', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'sa-user' },
          profile: { id: 'sa-user', status: 'ACTIVE', role: 'student_assistant' },
          role: 'student_assistant',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, { allowedRoles: ['super_admin'] });
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(403);
        expect(mockHandler).not.toHaveBeenCalled();
      });

      it('blocks active student assistant who lacks the required permission', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'sa-user' },
          profile: {
            id: 'sa-user',
            status: 'ACTIVE',
            role: 'student_assistant',
            permissions: { manage_attendance: true, manage_circulation: false },
          },
          role: 'student_assistant',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, {
          allowedPermissions: ['manage_circulation'],
        });
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(403);
        expect(res).toEqual(
          expect.objectContaining({
            body: expect.objectContaining({
              code: 'PERMISSION_DENIED',
              message: 'Forbidden: Missing required permission for this action',
            }),
          })
        );
        expect(mockHandler).not.toHaveBeenCalled();
      });

      it('blocks active student assistant when permissions object is empty', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'sa-user' },
          profile: {
            id: 'sa-user',
            status: 'ACTIVE',
            role: 'student_assistant',
            permissions: {},
          },
          role: 'student_assistant',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, {
          allowedPermissions: ['manage_circulation'],
        });
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(403);
        expect(res).toEqual(
          expect.objectContaining({
            body: expect.objectContaining({ code: 'PERMISSION_DENIED' }),
          })
        );
        expect(mockHandler).not.toHaveBeenCalled();
      });

      it('blocks active student assistant when permissions object is undefined or null', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'sa-user' },
          profile: {
            id: 'sa-user',
            status: 'ACTIVE',
            role: 'student_assistant',
            permissions: null,
          },
          role: 'student_assistant',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, {
          allowedPermissions: ['manage_circulation'],
        });
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(403);
        expect(res).toEqual(
          expect.objectContaining({
            body: expect.objectContaining({ code: 'PERMISSION_DENIED' }),
          })
        );
        expect(mockHandler).not.toHaveBeenCalled();
      });

      it('permits active student assistant if they have at least one allowed permission', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'sa-user' },
          profile: {
            id: 'sa-user',
            status: 'ACTIVE',
            role: 'student_assistant',
            permissions: { manage_attendance: true, manage_circulation: false },
          },
          role: 'student_assistant',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, {
          allowedPermissions: ['manage_circulation', 'manage_attendance'],
        });
        const res = await handler(mockRequest, mockContext);

        expect(res).toEqual(expect.objectContaining({ status: 200 }));
        expect(mockHandler).toHaveBeenCalledTimes(1);
      });
    });

    describe('Librarian privilege boundaries & Super Admin bypass', () => {
      it('blocks librarian from super_admin-only route', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'lib-user' },
          profile: { id: 'lib-user', status: 'ACTIVE', role: 'librarian' },
          role: 'librarian',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, { allowedRoles: ['super_admin'] });
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(403);
        expect(mockHandler).not.toHaveBeenCalled();
      });

      it('bypasses allowedPermissions checks for super_admin completely', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'super-admin' },
          profile: { id: 'super-admin', status: 'ACTIVE', role: 'super_admin', permissions: null },
          role: 'super_admin',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, {
          allowedPermissions: ['manage_circulation', 'restricted_perm'],
        });
        const res = await handler(mockRequest, mockContext);

        expect(res).toEqual(expect.objectContaining({ status: 200 }));
        expect(mockHandler).toHaveBeenCalledTimes(1);
      });

      it('bypasses allowedPermissions checks for librarian completely', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'librarian-user' },
          profile: { id: 'librarian-user', status: 'ACTIVE', role: 'librarian', permissions: null },
          role: 'librarian',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, {
          allowedPermissions: ['manage_circulation', 'restricted_perm'],
        });
        const res = await handler(mockRequest, mockContext);

        expect(res).toEqual(expect.objectContaining({ status: 200 }));
        expect(mockHandler).toHaveBeenCalledTimes(1);
      });
    });

    describe('Forged client headers or unknown roles', () => {
      it('ignores forged client request headers claiming super_admin role', async () => {
        // Authenticated user in session is actually a student
        (getMe as Mock).mockResolvedValue({
          user: { id: 'student-attacker' },
          profile: { id: 'student-attacker', status: 'ACTIVE', role: 'student' },
          role: 'student',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, { allowedRoles: ['super_admin'] });
        const res = await handler(mockRequest, mockContext);

        // Even though mockRequest header has x-forged-role: super_admin
        expect(res.status).toBe(403);
        expect(mockHandler).not.toHaveBeenCalled();
      });

      it('rejects unrecognized role values under allowedRoles', async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'unknown-role-user' },
          profile: { id: 'unknown-role-user', status: 'ACTIVE', role: 'intruder' },
          role: 'intruder' as UserRole,
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, {
          allowedRoles: ['student', 'student_assistant', 'librarian', 'super_admin'],
        });
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(403);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // Challenge 4: Unauthenticated Requests & Session Anomalies
  // =========================================================================
  describe('Challenge 4: Unauthenticated Requests & Session Anomalies', () => {
    it('returns 401 Unauthorized when getMe returns null', async () => {
      (getMe as Mock).mockResolvedValue(null);

      const handler = withAuthApi(mockHandler);
      const res = await handler(mockRequest, mockContext);

      expect(res.status).toBe(401);
      expect(res).toEqual(
        expect.objectContaining({
          body: {
            ok: false,
            message: 'Unauthorized',
            code: 'UNAUTHORIZED',
            details: undefined,
          },
        })
      );
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('returns 401 Unauthorized when getMe returns undefined', async () => {
      (getMe as Mock).mockResolvedValue(undefined);

      const handler = withAuthApi(mockHandler);
      const res = await handler(mockRequest, mockContext);

      expect(res.status).toBe(401);
      expect(res).toEqual(
        expect.objectContaining({
          body: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        })
      );
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('returns 500 when getMe throws an unhandled database error', async () => {
      (getMe as Mock).mockRejectedValue(new Error('PostgREST connection pool timeout'));
      (isAbortError as Mock).mockReturnValue(false);

      const handler = withAuthApi(mockHandler);
      const res = await handler(mockRequest, mockContext);

      expect(res.status).toBe(500);
      expect(res).toEqual(
        expect.objectContaining({
          body: expect.objectContaining({
            ok: false,
            code: 'INTERNAL_SERVER_ERROR',
          }),
        })
      );
      expect(mockHandler).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('api', expect.stringContaining('Unhandled API error: PostgREST connection pool timeout'), expect.any(Object));
    });

    it('returns 499 with empty body when request is aborted during getMe or handler execution', async () => {
      (getMe as Mock).mockRejectedValue(new Error('Client aborted request'));
      (isAbortError as Mock).mockReturnValue(true);

      const handler = withAuthApi(mockHandler);
      const res = await handler(mockRequest, mockContext);

      expect(res.status).toBe(499);
      expect(res.body).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith('api', expect.stringContaining('Request aborted:'));
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('sanitizes internal errors in production mode without leaking DB details', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      try {
        (getMe as Mock).mockRejectedValue(new Error('SELECT * FROM secret_keys WHERE id = 1 FAILED'));
        (isAbortError as Mock).mockReturnValue(false);

        const handler = withAuthApi(mockHandler);
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(500);
        expect(res).toEqual(
          expect.objectContaining({
            body: {
              ok: false,
              message: 'An internal server error occurred',
              code: 'INTERNAL_SERVER_ERROR',
              details: undefined,
            },
          })
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('reveals error message in development mode to assist debugging', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      try {
        (getMe as Mock).mockRejectedValue(new Error('Debug: specific query parse error'));
        (isAbortError as Mock).mockReturnValue(false);

        const handler = withAuthApi(mockHandler);
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(500);
        expect(res).toEqual(
          expect.objectContaining({
            body: expect.objectContaining({
              ok: false,
              message: 'Debug: specific query parse error',
              code: 'INTERNAL_SERVER_ERROR',
            }),
          })
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });

  // =========================================================================
  // Challenge 5: Concurrency and Context Isolation Stress Test
  // =========================================================================
  describe('Challenge 5: Concurrency and Request Isolation', () => {
    it('reliably evaluates 50 concurrent requests with varying roles and statuses without cross-contamination', async () => {
      interface TestCase {
        userId: string;
        role: UserRole;
        status: string;
        requireStaff?: boolean;
        expectedStatus: number;
      }

      const testMatrix: TestCase[] = [
        { userId: 'u-1', role: 'super_admin', status: 'ACTIVE', requireStaff: true, expectedStatus: 200 },
        { userId: 'u-2', role: 'student', status: 'ACTIVE', requireStaff: true, expectedStatus: 403 },
        { userId: 'u-3', role: 'student_assistant', status: 'INACTIVE', requireStaff: true, expectedStatus: 403 },
        { userId: 'u-4', role: 'student_assistant', status: 'ACTIVE', requireStaff: true, expectedStatus: 200 },
        { userId: 'u-5', role: 'librarian', status: 'ARCHIVED', requireStaff: true, expectedStatus: 403 },
      ];

      // Repeat matrix 10 times to produce 50 parallel requests
      const testCases: TestCase[] = [];
      for (let i = 0; i < 10; i++) {
        testMatrix.forEach((tc) => {
          testCases.push({ ...tc, userId: `${tc.userId}-iter-${i}` });
        });
      }

      const promises = testCases.map(async (tc) => {
        // Build isolated handler and mock getMe for each call
        const isolatedGetMe = vi.fn().mockResolvedValue({
          user: { id: tc.userId },
          profile: { id: tc.userId, status: tc.status, role: tc.role },
          role: tc.role,
          supabase: {},
        });

        // We temporarily replace getMe for this request execution
        (getMe as Mock).mockImplementationOnce(isolatedGetMe);

        const isolatedHandler = vi.fn().mockResolvedValue({ status: 200, ok: true, userId: tc.userId });
        const wrapped = withAuthApi(isolatedHandler, { requireStaff: tc.requireStaff });

        const req = new Request(`http://localhost/api/test?user=${tc.userId}`);
        const res = await wrapped(req, { params: Promise.resolve({ user: tc.userId }) });

        return {
          tc,
          status: res.status,
          isolatedHandlerCalled: isolatedHandler.mock.calls.length > 0,
        };
      });

      const results = await Promise.all(promises);

      results.forEach((r) => {
        expect(r.status).toBe(r.tc.expectedStatus);
        if (r.tc.expectedStatus === 200) {
          expect(r.isolatedHandlerCalled).toBe(true);
        } else {
          expect(r.isolatedHandlerCalled).toBe(false);
        }
      });
    });
  });

  // =========================================================================
  // Challenge 6: Truthy Injection & Strict Boolean Verification
  // =========================================================================
  describe('Challenge 6: Truthy Injection & Strict Boolean Verification', () => {
    const truthyNonBooleanValues = [
      'true',
      '1',
      1,
      {},
      [],
      'yes',
      Infinity,
    ];

    truthyNonBooleanValues.forEach((val) => {
      it(`rejects student assistant with non-boolean truthy permission value (${JSON.stringify(val)})`, async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'sa-truthy' },
          profile: {
            id: 'sa-truthy',
            status: 'ACTIVE',
            role: 'student_assistant',
            permissions: { manage_circulation: val },
          },
          role: 'student_assistant',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, {
          allowedPermissions: ['manage_circulation'],
        });
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(403);
        expect(res).toEqual(
          expect.objectContaining({
            body: expect.objectContaining({
              code: 'PERMISSION_DENIED',
              message: 'Forbidden: Missing required permission for this action',
            }),
          })
        );
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // Challenge 7: Empty Constraints and Edge Cases
  // =========================================================================
  describe('Challenge 7: Empty Constraints and Edge Cases', () => {
    it('blocks all users when allowedRoles is an empty array', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'admin-empty' },
        profile: { id: 'admin-empty', status: 'ACTIVE', role: 'super_admin' },
        role: 'super_admin',
        supabase: {},
      });

      const handler = withAuthApi(mockHandler, { allowedRoles: [] });
      const res = await handler(mockRequest, mockContext);

      expect(res.status).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('blocks student assistants when allowedPermissions is an empty array', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'sa-empty-perms' },
        profile: {
          id: 'sa-empty-perms',
          status: 'ACTIVE',
          role: 'student_assistant',
          permissions: { manage_circulation: true },
        },
        role: 'student_assistant',
        supabase: {},
      });

      const handler = withAuthApi(mockHandler, { allowedPermissions: [] });
      const res = await handler(mockRequest, mockContext);

      expect(res.status).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('blocks inactive SA even when allowedRoles permits student and SA has permission', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'sa-inactive-perm' },
        profile: {
          id: 'sa-inactive-perm',
          status: 'INACTIVE',
          role: 'student_assistant',
          permissions: { manage_circulation: true },
        },
        role: 'student_assistant',
        supabase: {},
      });

      const handler = withAuthApi(mockHandler, {
        allowedRoles: ['student', 'student_assistant'],
        allowedPermissions: ['manage_circulation'],
      });
      const res = await handler(mockRequest, mockContext);

      // In allowedRoles they would pass as student, but allowedPermissions blocks non-ACTIVE SAs!
      expect(res.status).toBe(403);
      expect(res).toEqual(
        expect.objectContaining({
          body: expect.objectContaining({
            code: 'FORBIDDEN',
            message: 'Forbidden: Account disabled',
          }),
        })
      );
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('passes context parameters and request object accurately to downstream handler', async () => {
      const mockClient = { auth: {} };
      (getMe as Mock).mockResolvedValue({
        user: { id: 'user-forwarded' },
        profile: { id: 'user-forwarded', status: 'ACTIVE', role: 'student', email: 'test@school.edu' },
        role: 'student',
        supabase: mockClient,
      });

      let capturedContext: unknown;
      const capturingHandler = vi.fn().mockImplementation(async (_req, ctx) => {
        capturedContext = ctx;
        return { status: 200, ok: true };
      });

      const wrapped = withAuthApi(capturingHandler);
      const customParams = Promise.resolve({ category: 'fiction', slug: 'dune' });
      const req = new Request('http://localhost:3000/api/books/fiction/dune');
      const res = await wrapped(req, { params: customParams, extraKey: 42 });

      expect(res).toEqual({ status: 200, ok: true });
      expect(capturingHandler).toHaveBeenCalledTimes(1);
      expect(capturedContext).toEqual(
        expect.objectContaining({
          params: customParams,
          extraKey: 42,
          user: { id: 'user-forwarded' },
          role: 'student',
          supabase: mockClient,
        })
      );
    });
  });

  // =========================================================================
  // Challenge 8: Fuzzed Role and Status Invariant Generator
  // =========================================================================
  describe('Challenge 8: Fuzzed Role and Status Invariant Generator', () => {
    const fuzzedAdversarialRoles = [
      'admin',
      'ADMIN',
      'root',
      'superadmin',
      'SuperAdmin',
      'librarian; DROP TABLE profiles;--',
      '<script>alert(1)</script>',
      'null',
      'undefined',
      '   ',
      '\x00super_admin',
      '__proto__',
      'constructor',
      'system',
      'operator',
      'guest',
      'anonymous',
      'manager',
      'staff',
    ];

    fuzzedAdversarialRoles.forEach((forgedRole) => {
      it(`reliably blocks fuzzed forged role "${forgedRole}" from staff routes`, async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: `attacker-${forgedRole}` },
          profile: { id: `attacker-${forgedRole}`, status: 'ACTIVE', role: forgedRole },
          role: forgedRole as UserRole,
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, {
          allowedRoles: ['super_admin', 'librarian'],
          requireStaff: true,
        });
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(403);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });

    const fuzzedDeactivatedStatuses = [
      'SUSPENDED',
      'suspended',
      'INACTIVE',
      'inactive',
      'PENDING',
      'pending',
      'DEACTIVATED',
      'deactivated',
      'DISABLED',
      'disabled',
      'BANNED',
      'TERMINATED',
      'EXPIRED',
      'LOCKED',
      'BLOCKED',
      'UNKNOWN',
    ];

    fuzzedDeactivatedStatuses.forEach((status) => {
      it(`reliably blocks student_assistant with fuzzed non-ACTIVE status "${status}" from requireStaff`, async () => {
        (getMe as Mock).mockResolvedValue({
          user: { id: `sa-status-${status}` },
          profile: { id: `sa-status-${status}`, status, role: 'student_assistant' },
          role: 'student_assistant',
          supabase: {},
        });

        const handler = withAuthApi(mockHandler, { requireStaff: true });
        const res = await handler(mockRequest, mockContext);

        expect(res.status).toBe(403);
        expect(mockHandler).not.toHaveBeenCalled();
      });
    });
  });
});


