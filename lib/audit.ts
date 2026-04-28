import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";

export type AuditEntityType = 
  | "profile" 
  | "book" 
  | "book_copy" 
  | "borrowing_record" 
  | "library_card"
  | "reservation"
  | "system";

/**
 * Persists an audit log strictly for administrative mutations.
 * Executes in the background (using Next.js `after`) to avoid blocking UI responses.
 * 
 * @param actorId The UUID of the authenticated admin/librarian performing the action (auth.uid()).
 * @param entityType The core system entity being modified.
 * @param entityId The specific ID of the entity (if applicable).
 * @param action The specific action taken (e.g., 'created', 'approved', 'hard_delete').
 * @param reason Human-readable justification if provided in the workflow.
 */
export async function logAuditActivity(
  actorId: string | null | undefined,
  entityType: AuditEntityType,
  entityId: string | null = null,
  action: string,
  reason?: string | null,
  details?: Record<string, unknown> | null
) {
  try {
    // Use the admin client to bypass RLS and guarantee the write.
    // Important since some workflows use service_role to wipe data and auth.uid() is null contextually.
    const supabase = createAdminClient();

    const { after } = await import("next/server");
    after(async () => {
      const { error } = await supabase
        .from("audit_logs")
        .insert({
          admin_id: actorId || null,
          entity_type: entityType,
          entity_id: entityId,
          action: action,
          reason: reason || null,
          details: details || {},
        });

      if (error) {
        // Fallback to our server logger if DB insert fails
        logger.error("AUDIT_APPEND_FAILED", "Could not persist to public.audit_logs", { error, action, entityId, actorId });
      } else {
        logger.debug("AUDIT_LOG_WRITTEN", `Audit recorded: ${action} on ${entityType}`);
      }
    });

  } catch (error) {
     logger.error("AUDIT_FATAL_ERROR", "Exception thrown while initializing audit log", undefined, error);
  }
}
