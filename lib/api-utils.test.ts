import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { withAuthApi, apiSuccess, apiError } from './api-utils';
import { getMe } from './auth-helpers';
import { logger } from './logger';
import { isAbortError } from './error-utils';

// Mock Next.js NextResponse
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

vi.mock('./auth-helpers', () => ({
  getMe: vi.fn(),
}));

vi.mock('./logger', () => ({
  logger: {
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./error-utils', () => ({
  isAbortError: vi.fn(),
}));

describe('apiSuccess helper', () => {
  it('returns default status 200 with ok: true and merged payload', () => {
    const res = apiSuccess({ data: [1, 2, 3], total: 3 });
    expect(res).toEqual(
      expect.objectContaining({
        status: 200,
        body: { ok: true, data: [1, 2, 3], total: 3 },
      })
    );
  });

  it('supports custom HTTP status codes (e.g. 201 Created)', () => {
    const res = apiSuccess({ bookId: 'b-1' }, 201);
    expect(res).toEqual(
      expect.objectContaining({
        status: 201,
        body: { ok: true, bookId: 'b-1' },
      })
    );
  });
});

describe('apiError helper', () => {
  it('returns default status 500 and ERROR code with ok: false', () => {
    const res = apiError('Database connection failed');
    expect(res).toEqual(
      expect.objectContaining({
        status: 500,
        body: {
          ok: false,
          message: 'Database connection failed',
          code: 'ERROR',
          details: undefined,
        },
      })
    );
  });

  it('supports custom status codes, error codes, and details object', () => {
    const res = apiError('Validation failed', 'VALIDATION_ERROR', 422, { field: 'isbn' });
    expect(res).toEqual(
      expect.objectContaining({
        status: 422,
        body: {
          ok: false,
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: { field: 'isbn' },
        },
      })
    );
  });
});

describe('withAuthApi authorization wrapper', () => {
  let mockRequest: Request;
  let mockContext: { params: Promise<Record<string, string>> };
  let mockHandler: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest = { url: 'http://localhost/api/test' } as Request;
    mockContext = { params: Promise.resolve({ id: '1' }) };
    mockHandler = vi.fn().mockResolvedValue({ status: 200, ok: true });
  });

  describe('Authentication and Account Status', () => {
    it('returns 401 Unauthorized when unauthenticated (getMe returns null)', async () => {
      (getMe as Mock).mockResolvedValue(null);

      const wrappedHandler = withAuthApi(mockHandler);
      const response = await wrappedHandler(mockRequest, mockContext);

      expect(response).toEqual(
        expect.objectContaining({
          status: 401,
          body: { ok: false, message: 'Unauthorized', code: 'UNAUTHORIZED', details: undefined },
        })
      );
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('returns 403 Forbidden when user profile status is ARCHIVED', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'user-archived' },
        profile: { id: 'user-archived', status: 'ARCHIVED', email: 'archived@school.edu', role: 'student' },
        role: 'student',
      });

      const wrappedHandler = withAuthApi(mockHandler);
      const response = await wrappedHandler(mockRequest, mockContext);

      expect(response).toEqual(
        expect.objectContaining({
          status: 403,
          body: expect.objectContaining({
            ok: false,
            message: 'Account archived. Please contact administration.',
            code: 'FORBIDDEN',
          }),
        })
      );
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('requireStaff enforcement', () => {
    it('returns 403 Forbidden when requireStaff is true and user is a student', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'user-stu' },
        profile: { id: 'user-stu', status: 'ACTIVE', email: 'student@school.edu', role: 'student' },
        role: 'student',
      });

      const wrappedHandler = withAuthApi(mockHandler, { requireStaff: true });
      const response = await wrappedHandler(mockRequest, mockContext);

      expect(response).toEqual(
        expect.objectContaining({
          status: 403,
          body: expect.objectContaining({
            message: 'Forbidden: Staff access required or account disabled',
            code: 'FORBIDDEN',
          }),
        })
      );
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('returns 403 Forbidden when requireStaff is true and student_assistant is INACTIVE', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'user-sa-inactive' },
        profile: { id: 'user-sa-inactive', status: 'INACTIVE', email: 'sa_off@school.edu', role: 'student_assistant' },
        role: 'student_assistant',
        supabase: {},
      });

      const wrappedHandler = withAuthApi(mockHandler, { requireStaff: true });
      const response = await wrappedHandler(mockRequest, mockContext);

      expect(response.status).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('allows access when requireStaff is true and caller is super_admin', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'user-admin' },
        profile: { id: 'user-admin', status: 'ACTIVE', email: 'admin@school.edu', role: 'super_admin' },
        role: 'super_admin',
        supabase: {},
      });

      const wrappedHandler = withAuthApi(mockHandler, { requireStaff: true });
      await wrappedHandler(mockRequest, mockContext);

      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it('allows access when requireStaff is true and caller is librarian', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'user-lib' },
        profile: { id: 'user-lib', status: 'ACTIVE', email: 'lib@school.edu', role: 'librarian' },
        role: 'librarian',
        supabase: {},
      });

      const wrappedHandler = withAuthApi(mockHandler, { requireStaff: true });
      await wrappedHandler(mockRequest, mockContext);

      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it('allows access when requireStaff is true and caller is active student_assistant', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'user-sa-active' },
        profile: { id: 'user-sa-active', status: 'ACTIVE', email: 'sa@school.edu', role: 'student_assistant' },
        role: 'student_assistant',
        supabase: {},
      });

      const wrappedHandler = withAuthApi(mockHandler, { requireStaff: true });
      await wrappedHandler(mockRequest, mockContext);

      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('allowedRoles enforcement', () => {
    it('returns 403 Forbidden when caller role is not in allowedRoles', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'user-stu' },
        profile: { id: 'user-stu', status: 'ACTIVE', email: 'student@school.edu', role: 'student' },
        role: 'student',
      });

      const wrappedHandler = withAuthApi(mockHandler, { allowedRoles: ['librarian', 'super_admin'] });
      const response = await wrappedHandler(mockRequest, mockContext);

      expect(response.status).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('returns 403 when SA has status INACTIVE and allowedRoles only specifies student_assistant', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'sa-disabled' },
        profile: { id: 'sa-disabled', status: 'INACTIVE', email: 'sa@school.edu', role: 'student_assistant' },
        role: 'student_assistant',
        supabase: {},
      });

      const wrappedHandler = withAuthApi(mockHandler, { allowedRoles: ['student_assistant'] });
      const response = await wrappedHandler(mockRequest, mockContext);

      expect(response.status).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('allows inactive SA when allowedRoles permits both student and student_assistant', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'sa-disabled' },
        profile: { id: 'sa-disabled', status: 'INACTIVE', email: 'sa@school.edu', role: 'student_assistant' },
        role: 'student_assistant',
        supabase: {},
      });

      const wrappedHandler = withAuthApi(mockHandler, {
        allowedRoles: ['student', 'student_assistant'],
      });
      await wrappedHandler(mockRequest, mockContext);

      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('allowedPermissions for student assistants', () => {
    it('returns 403 with PERMISSION_DENIED when SA lacks required permission', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'sa-1' },
        profile: {
          id: 'sa-1',
          status: 'ACTIVE',
          role: 'student_assistant',
          permissions: { manage_attendance: true, manage_circulation: false },
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
            code: 'PERMISSION_DENIED',
            message: 'Forbidden: Missing required permission for this action',
          }),
        })
      );
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('returns 403 Forbidden Account disabled when SA has permissions config but status is not ACTIVE', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'sa-inactive' },
        profile: {
          id: 'sa-inactive',
          status: 'INACTIVE',
          role: 'student_assistant',
          permissions: { manage_circulation: true },
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
            code: 'FORBIDDEN',
            message: 'Forbidden: Account disabled',
          }),
        })
      );
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('allows active SA possessing the required permission', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'sa-active' },
        profile: {
          id: 'sa-active',
          status: 'ACTIVE',
          role: 'student_assistant',
          permissions: { manage_circulation: true },
        },
        role: 'student_assistant',
        supabase: {},
      });

      const wrappedHandler = withAuthApi(mockHandler, {
        allowedPermissions: ['manage_circulation'],
      });
      await wrappedHandler(mockRequest, mockContext);

      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it('allows super_admin and librarian to bypass allowedPermissions checks entirely', async () => {
      // Super admin bypass
      (getMe as Mock).mockResolvedValue({
        user: { id: 'admin-1' },
        profile: {
          id: 'admin-1',
          status: 'ACTIVE',
          role: 'super_admin',
          permissions: null,
        },
        role: 'super_admin',
        supabase: {},
      });

      const adminHandler = withAuthApi(mockHandler, {
        allowedPermissions: ['manage_circulation', 'special_perm'],
      });
      await adminHandler(mockRequest, mockContext);
      expect(mockHandler).toHaveBeenCalledTimes(1);

      // Librarian bypass
      (getMe as Mock).mockResolvedValue({
        user: { id: 'lib-1' },
        profile: {
          id: 'lib-1',
          status: 'ACTIVE',
          role: 'librarian',
          permissions: {},
        },
        role: 'librarian',
        supabase: {},
      });

      const libHandler = withAuthApi(mockHandler, {
        allowedPermissions: ['manage_circulation'],
      });
      await libHandler(mockRequest, mockContext);
      expect(mockHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('Successful context injection', () => {
    it('executes handler and forwards request and auth context', async () => {
      const mockSupabaseClient = { from: vi.fn() };
      (getMe as Mock).mockResolvedValue({
        user: { id: 'stu-1' },
        profile: { id: 'stu-1', status: 'ACTIVE', email: 'stu@school.edu', role: 'student' },
        role: 'student',
        supabase: mockSupabaseClient,
      });

      const wrappedHandler = withAuthApi(mockHandler);
      const response = await wrappedHandler(mockRequest, mockContext);

      expect(response).toEqual({ status: 200, ok: true });
      expect(mockHandler).toHaveBeenCalledWith(
        mockRequest,
        expect.objectContaining({
          params: mockContext.params,
          user: { id: 'stu-1' },
          role: 'student',
          supabase: mockSupabaseClient,
        })
      );
    });
  });

  describe('Error and Abort Handling', () => {
    it('handles abort exceptions quietly with HTTP 499 (Client Closed Request) and empty body', async () => {
      (getMe as Mock).mockResolvedValue({
        user: { id: 'stu-1' },
        profile: { id: 'stu-1', status: 'ACTIVE', email: 'stu@school.edu', role: 'student' },
        role: 'student',
        supabase: {},
      });

      const abortError = new Error('The user aborted a request.');
      mockHandler.mockRejectedValue(abortError);
      (isAbortError as Mock).mockReturnValue(true);

      const wrappedHandler = withAuthApi(mockHandler);
      const response = await wrappedHandler(mockRequest, mockContext);

      expect(response.status).toBe(499);
      expect(response.body).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith('api', expect.stringContaining('Request aborted:'));
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('returns sanitized error in production mode (NODE_ENV=production)', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      try {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'stu-1' },
          profile: { id: 'stu-1', status: 'ACTIVE', email: 'stu@school.edu', role: 'student' },
          role: 'student',
          supabase: {},
        });

        mockHandler.mockRejectedValue(new Error('Sensitive database credentials failed'));
        (isAbortError as Mock).mockReturnValue(false);

        const wrappedHandler = withAuthApi(mockHandler);
        const response = await wrappedHandler(mockRequest, mockContext);

        expect(response.status).toBe(500);
        expect(response).toEqual(
          expect.objectContaining({
            body: expect.objectContaining({
              ok: false,
              message: 'An internal server error occurred',
              code: 'INTERNAL_SERVER_ERROR',
            }),
          })
        );
        expect(logger.error).toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('returns verbatim error message in development mode (NODE_ENV=development)', async () => {
      vi.stubEnv('NODE_ENV', 'development');

      try {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'stu-1' },
          profile: { id: 'stu-1', status: 'ACTIVE', email: 'stu@school.edu', role: 'student' },
          role: 'student',
          supabase: {},
        });

        mockHandler.mockRejectedValue(new Error('Detailed developer debug message'));
        (isAbortError as Mock).mockReturnValue(false);

        const wrappedHandler = withAuthApi(mockHandler);
        const response = await wrappedHandler(mockRequest, mockContext);

        expect(response.status).toBe(500);
        expect(response).toEqual(
          expect.objectContaining({
            body: expect.objectContaining({
              ok: false,
              message: 'Detailed developer debug message',
              code: 'INTERNAL_SERVER_ERROR',
            }),
          })
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('extracts error message from Supabase error objects that are not instances of Error', async () => {
      vi.stubEnv('NODE_ENV', 'development');

      try {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'stu-1' },
          profile: { id: 'stu-1', status: 'ACTIVE', email: 'stu@school.edu', role: 'student' },
          role: 'student',
          supabase: {},
        });

        // Supabase error object shape
        const supabaseError = { message: 'relation "books" does not exist', code: '42P01' };
        mockHandler.mockRejectedValue(supabaseError);
        (isAbortError as Mock).mockReturnValue(false);

        const wrappedHandler = withAuthApi(mockHandler);
        const response = await wrappedHandler(mockRequest, mockContext);

        expect(response.status).toBe(500);
        expect(response).toEqual(
          expect.objectContaining({
            body: expect.objectContaining({
              message: 'relation "books" does not exist',
            }),
          })
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });

    it('handles non-object primitive errors gracefully', async () => {
      vi.stubEnv('NODE_ENV', 'development');

      try {
        (getMe as Mock).mockResolvedValue({
          user: { id: 'stu-1' },
          profile: { id: 'stu-1', status: 'ACTIVE', email: 'stu@school.edu', role: 'student' },
          role: 'student',
          supabase: {},
        });

        mockHandler.mockRejectedValue('Fatal string exception');
        (isAbortError as Mock).mockReturnValue(false);

        const wrappedHandler = withAuthApi(mockHandler);
        const response = await wrappedHandler(mockRequest, mockContext);

        expect(response.status).toBe(500);
        expect(response).toEqual(
          expect.objectContaining({
            body: expect.objectContaining({
              message: 'Fatal string exception',
            }),
          })
        );
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });
});
