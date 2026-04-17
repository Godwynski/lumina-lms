import { NextResponse } from 'next/server';
import { getMe, UserRole } from './auth-helpers';
import { logger } from './logger';
import { createClient } from './supabase/server';
import { SupabaseClient, User } from '@supabase/supabase-js';

export type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  message?: string;
  code?: string;
  details?: unknown;
};

/**
 * Standardized success response for API routes.
 */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

/**
 * Standardized error response for API routes.
 */
export function apiError(
  message: string,
  code = "ERROR",
  status = 500,
  details?: unknown
) {
  return NextResponse.json({ ok: false, message, code, details }, { status });
}

interface AuthOptions {
  allowedRoles?: UserRole[];
  requireStaff?: boolean;
}

/**
 * A higher-order function to wrap API route handlers with authentication and role checks.
 * Handles common error cases like 401 Unauthorized and 403 Forbidden.
 */
export function withAuthApi(
  handler: (
    req: Request,
    context: {
      user: User;
      profile: Record<string, unknown>;
      role: UserRole;
      supabase: SupabaseClient;
    }
  ) => Promise<NextResponse>,
  options: AuthOptions = {}
) {
  return async (req: Request, context: Record<string, unknown>) => {
    try {
      const me = await getMe();

      if (!me) {
        return apiError("Unauthorized", "UNAUTHORIZED", 401);
      }

      const { user, profile, role, isStaff, supabase } = me;

      if (options.requireStaff && !isStaff) {
        return apiError("Forbidden: Staff access required", "FORBIDDEN", 403);
      }

      if (options.allowedRoles && !options.allowedRoles.includes(role)) {
        return apiError(
          "Forbidden: Insufficient permissions",
          "FORBIDDEN",
          403
        );
      }

      return await handler(req, {
        ...context,
        user,
        profile: profile as Record<string, unknown>,
        role,
        supabase,
      } as {
        user: User;
        profile: Record<string, unknown>;
        role: UserRole;
        supabase: SupabaseClient;
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const isAbortError = error instanceof Error && (error.name === 'AbortError' || (error as any).code === 20);

      if (isAbortError) {
        // Quietly log aborts as they are expected when users navigate away or connections close
        logger.info("api", `Request aborted: ${req.url}`);
        return new NextResponse(null, { status: 499 }); // Client Closed Request
      }

      logger.error("api", `Unhandled API error: ${errorMessage}`, {
        url: req.url,
        stack: errorStack,
      });

      return apiError(
        process.env.NODE_ENV === "development"
          ? errorMessage
          : "An internal server error occurred",
        "INTERNAL_SERVER_ERROR",
        500
      );
    }
  };
}
