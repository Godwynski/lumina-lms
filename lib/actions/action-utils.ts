import { logger } from "../logger";
import { getMe } from "../auth-helpers";
import { logAuditActivity, AuditEntityType } from "../audit";
import { ZodError, ZodSchema, ZodIssue } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Standard response type for all Server Actions.
 * Ensures consistent handling on the client side.
 */
type ActionResult<T> = 
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: string; validationErrors?: Record<string, string[]> };

/**
 * Handlers can optionally return metadata for auditing.
 */
type AuditMetadata = {
  reason?: string;
  details?: Record<string, unknown>;
  oldValue?: unknown;
  newValue?: unknown;
  entityId?: string;
};

type SafeActionOptions = {
  /** The audit action name (e.g., 'create_book'). If provided, an audit log will be created. */
  auditAction?: string;
  /** The entity type being audited (e.g., 'book'). Required if auditAction is provided. */
  auditEntity?: string;
  /** Whether this action requires a specific role. */
  allowedRoles?: ('admin' | 'librarian' | 'staff' | 'student')[];
};

/**
 * Higher-order function to create a standardized Server Action.
 * Handles auth, error mapping, and logging centrally.
 */
export function createSafeAction<TInput, TOutput>(
  schema: ZodSchema<TInput> | null,
  handler: (
    input: TInput, 
    context: { userId: string; supabase: SupabaseClient }
  ) => Promise<TOutput | [TOutput, AuditMetadata]>,
  options: SafeActionOptions = {}
) {
  return async (input: unknown): Promise<ActionResult<TOutput>> => {
    try {
      // 1. Auth Check
      const me = await getMe();
      if (!me) {
        return { success: false, error: "Authentication required" };
      }

      if (options.allowedRoles && !options.allowedRoles.includes(me.role)) {
        return { success: false, error: "Unauthorized access" };
      }

      // 2. Validation
      let validatedInput: TInput;
      if (schema) {
        const result = schema.safeParse(input);
        if (!result.success) {
          const validationErrors: Record<string, string[]> = {};
          result.error.issues.forEach((err: ZodIssue) => {
            const path = err.path.join(".");
            if (!validationErrors[path]) validationErrors[path] = [];
            validationErrors[path].push(err.message);
          });
          return { success: false, error: "Validation failed", validationErrors };
        }
        validatedInput = result.data;
      } else {
        validatedInput = input as TInput;
      }

      // 3. Execution
      const result = await handler(validatedInput, { 
        userId: me.user.id, 
        supabase: me.supabase 
      });

      let data: TOutput;
      let auditMeta: AuditMetadata | undefined;

      if (Array.isArray(result) && result.length === 2) {
        [data, auditMeta] = result;
      } else {
        data = result as TOutput;
      }

      // 4. Audit Logging (Optional)
      if (options.auditAction && options.auditEntity) {
        const entityId = auditMeta?.entityId || (data as Record<string, unknown>)?.id as string || "system";
        
        await logAuditActivity(
          me.user.id,
          options.auditEntity as AuditEntityType,
          entityId,
          options.auditAction,
          auditMeta?.reason || `Action ${options.auditAction} performed on ${options.auditEntity}`,
          auditMeta?.details || null,
          auditMeta?.oldValue || null,
          auditMeta?.newValue || null
        );
      }

      return { success: true, data };

    } catch (error: unknown) {
      const err = error as Error;
      logger.error("action-utils", "Server action failed", { error: err.message, stack: err.stack });
      
      if (err instanceof ZodError) {
          return { success: false, error: "Input validation error" };
      }

      return { 
        success: false, 
        error: err.message || "An unexpected error occurred. Please try again." 
      };
    }
  };
}
