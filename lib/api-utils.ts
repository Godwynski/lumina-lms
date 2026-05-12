import { NextResponse } from 'next/server';
import { getMe } from './auth-helpers';
import { ProfileData, UserRole } from './types';
import { logger } from './logger';
import { isAbortError } from './error-utils';
import { SupabaseClient, User } from '@supabase/supabase-js';


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
  /** Optional: Required permissions for student_assistants. 
   * If provided, an SA must have at least one of these permissions.
   * Admins and Librarians bypass this check.
   */
  allowedPermissions?: string[];
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
      profile: ProfileData & {
        id: string;
        email: string | null;
        role: string;
      };
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

      // Permission check for student assistants
      if (role === 'student_assistant' && options.allowedPermissions) {
        const permissions = profile.permissions || {};
        const hasPermission = options.allowedPermissions.some(p => permissions[p] === true);
        if (!hasPermission) {
          return apiError(
            "Forbidden: Missing required permission for this action",
            "PERMISSION_DENIED",
            403
          );
        }
      }

      return await handler(req, {
        ...context,
        user,
        profile,
        role,
        supabase,
      });
    } catch (error: unknown) {
      let errorMessage = "Unknown error";
      let errorStack = undefined;

      if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;
      } else if (typeof error === "object" && error !== null) {
        // Handle Supabase error objects which have a message property but aren't Error instances
        errorMessage = (error as { message?: string }).message || JSON.stringify(error);
      } else {
        errorMessage = String(error);
      }

      if (isAbortError(error)) {
        // Quietly log aborts as they are expected when users navigate away or connections close
        logger.debug("api", `Request aborted: ${req.url}`);
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
