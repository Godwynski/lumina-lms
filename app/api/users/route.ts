import { withAuthApi, apiSuccess, apiError } from "@/lib/api-utils";
import { normalizeUserRole, UserRole } from "@/lib/auth-helpers";
import { logAuditActivity } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserCreateSchema, UserPatchSchema } from "@/lib/validations/api";
import { mapProfileToUser } from "@/lib/utils/mappers";

const MANAGER_ROLES: UserRole[] = ["super_admin", "librarian"];

export const GET = withAuthApi(
  async (request, { supabase, role: requesterRole }) => {
    let query = supabase.from("profiles").select("*");

    // Librarian Restriction: Hide admins
    if (requesterRole === "librarian") {
      query = query.neq("role", "super_admin");
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return apiError(error.message, "DATABASE_ERROR", 400);
    }

    const users = (data ?? []).map((row) =>
      mapProfileToUser(row as Record<string, unknown>)
    );

    return apiSuccess({ users });
  },
  { allowedRoles: MANAGER_ROLES }
);

export const POST = withAuthApi(
  async (request, { supabase, user, role: requesterRole }) => {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return apiError("Invalid JSON body", "BAD_REQUEST", 400);
    }

    const parseResult = UserCreateSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return apiError(parseResult.error.issues[0]?.message || "Invalid input", "VALIDATION_ERROR", 400);
    }

    const body = parseResult.data;
    const email = body.email.toLowerCase();
    const requestedRole = normalizeUserRole(body.role as string);
    const department = body.department || "";

    if (requesterRole === "librarian" && body.role && requestedRole !== "student") {
      return apiError("Librarians are not allowed to assign roles", "FORBIDDEN", 403);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      return apiError(profileError.message, "DATABASE_ERROR", 400);
    }

    if (!profile) {
      return apiError(
        "No existing account found for this email. Ask the user to sign up first.",
        "USER_NOT_FOUND",
        404
      );
    }

    if (requestedRole === "super_admin" && profile.role !== "super_admin") {
      if (requesterRole === "super_admin") {
        const adminClient = createAdminClient();
        const { error: transferError } = await adminClient
          .rpc("transfer_super_admin_ownership", {
            p_current_admin_id: user.id,
            p_new_admin_id: profile.id
          });
        if (transferError) {
          return apiError(transferError.message, "DATABASE_ERROR", 400);
        }
        await logAuditActivity(
          user.id,
          "system",
          null,
          "ownership_transferred",
          `Super admin ownership transferred from ${user.email || user.id} to ${email}`,
          { from: user.id, to: profile.id }
        );
      } else {
        const { count, error: countError } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "super_admin");
        if (!countError && count && count > 0) {
          return apiError("Only one super administrator is allowed in the system.", "SUPER_ADMIN_EXISTS", 400);
        }
      }
    }

    const updates: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(profile, "role"))
      updates.role = requestedRole;
    if (Object.prototype.hasOwnProperty.call(profile, "status"))
      updates.status = "PENDING";
    if (Object.prototype.hasOwnProperty.call(profile, "department"))
      updates.department = department || "General";

    if (Object.keys(updates).length === 0) {
      return apiError(
        "No writable profile fields available",
        "NO_FIELDS_TO_UPDATE",
        400
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profile.id)
      .select("*")
      .single();

    if (updateError) {
      return apiError(updateError.message, "DATABASE_ERROR", 400);
    }

    await logAuditActivity(
      user.id,
      "profile",
      profile.id,
      "role_updated",
      `Upgraded user ${email} to ${requestedRole} (status set to pending)`,
      { department: updates.department },
      { role: profile.role, status: profile.status, department: profile.department },
      { role: updated.role, status: updated.status, department: updated.department }
    );

    return apiSuccess({
      user: mapProfileToUser(updated as Record<string, unknown>),
    });
  },
  { allowedRoles: MANAGER_ROLES }
);

export const PATCH = withAuthApi(
  async (request, { supabase, user, role: requesterRole }) => {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return apiError("Invalid JSON body", "BAD_REQUEST", 400);
    }

    const parseResult = UserPatchSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return apiError(parseResult.error.issues[0]?.message || "Invalid update input", "VALIDATION_ERROR", 400);
    }

    const body = parseResult.data;
    const id = body.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (profileError) {
      return apiError(profileError.message, "DATABASE_ERROR", 400);
    }

    // Librarian Restriction: Cannot target admins
    if (requesterRole === "librarian") {
      if (profile.role === "super_admin") {
        return apiError("Librarians cannot modify admin accounts", "FORBIDDEN", 403);
      }
      if (profile.role === "librarian" && user.id !== id) {
        return apiError("Librarians cannot modify fellow librarian accounts", "FORBIDDEN", 403);
      }
    }
    
    // Check permissions: Manager roles can edit others, users can edit themselves
    if (requesterRole !== "super_admin" && requesterRole !== "librarian" && user.id !== id) {
      return apiError("Forbidden: Insufficient permissions", "FORBIDDEN", 403);
    }

    const updates: Record<string, unknown> = {};

    const nextName = typeof body.name === "string" ? body.name.trim() : null;
    if (
      nextName &&
      Object.prototype.hasOwnProperty.call(profile, "full_name")
    ) {
      updates.full_name = nextName;
    }

    const nextStudentId = typeof body.student_id === "string" ? body.student_id.trim() : null;
    if (
      nextStudentId !== null &&
      "student_id" in profile
    ) {
      updates.student_id = nextStudentId || null;
    }

    const nextEmail =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
    if (nextEmail && Object.prototype.hasOwnProperty.call(profile, "email")) {
      updates.email = nextEmail;
    }

    const nextRoleInput = body.role as string | undefined;
    if (
      nextRoleInput &&
      Object.prototype.hasOwnProperty.call(profile, "role")
    ) {
      const nextRole = normalizeUserRole(nextRoleInput);
      if (requesterRole === "librarian" && nextRole !== profile.role) {
        return apiError("Librarians are not allowed to assign or change user roles", "FORBIDDEN", 403);
      }
      if (nextRole === "super_admin" && profile.role !== "super_admin") {
        if (requesterRole === "super_admin") {
          const adminClient = createAdminClient();
          const { error: transferError } = await adminClient
            .rpc("transfer_super_admin_ownership", {
              p_current_admin_id: user.id,
              p_new_admin_id: id
            });
          if (transferError) {
            return apiError(transferError.message, "DATABASE_ERROR", 400);
          }
          await logAuditActivity(
            user.id,
            "system",
            null,
            "ownership_transferred",
            `Super admin ownership transferred from ${user.id} to ${profile.email || id}`,
            { from: user.id, to: id }
          );
        } else {
          const { count, error: countError } = await supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("role", "super_admin");
          if (!countError && count && count > 0) {
            return apiError("Only one super administrator is allowed in the system.", "SUPER_ADMIN_EXISTS", 400);
          }
        }
      }
      updates.role = nextRole;
    }

    const nextStatus =
      typeof body.status === "string" ? body.status.trim().toUpperCase() : null;
    if (
      nextStatus &&
      Object.prototype.hasOwnProperty.call(profile, "status")
    ) {
      if (nextStatus === "ARCHIVED" || nextStatus === "SUSPENDED") {
        if (requesterRole !== "super_admin") {
          return apiError("Only admins can archive or suspend users", "FORBIDDEN", 403);
        }
      }
      updates.status = nextStatus;
    }

    const nextDepartment =
      typeof body.department === "string" ? body.department.trim() : null;
    if (
      nextDepartment !== null &&
      Object.prototype.hasOwnProperty.call(profile, "department")
    ) {
      updates.department = nextDepartment || "General";
    }

    if (body.permissions !== undefined && typeof body.permissions === "object") {
      updates.permissions = body.permissions;
    }

    const nextAddress = typeof body.address === "string" ? body.address.trim() : null;
    if (nextAddress !== null && "address" in profile) {
      updates.address = nextAddress || null;
    }

    const nextPhone = typeof body.phone === "string" ? body.phone.trim() : null;
    if (nextPhone !== null && "phone" in profile) {
      updates.phone = nextPhone || null;
    }

    if (Object.keys(updates).length === 0) {
      return apiSuccess({
        user: mapProfileToUser(profile as Record<string, unknown>),
      });
    }

    const admin = createAdminClient();

    const { data: updated, error: updateError } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      return apiError(updateError.message, "DATABASE_ERROR", 400);
    }

    // Sync library card status if membership status changed
    // Sync library card status if profile status is updated
    if (updates.status) {
      const cardStatus = (updates.status as string).toUpperCase();
      
      const { error: cardSyncError } = await admin
        .from("library_cards")
        .update({ 
          status: cardStatus,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", id);
        
      if (cardSyncError) {
        console.error(`Failed to sync library card status for user ${id}:`, cardSyncError);
      }
    }

    await logAuditActivity(
      user.id,
      "profile",
      id,
      "profile_updated",
      `Modified user profile fields: ${Object.keys(updates).join(", ")}`,
      { updatedFields: Object.keys(updates) },
      profile,
      updated
    );

    return apiSuccess({
      user: mapProfileToUser(updated as Record<string, unknown>),
    });
  },
  { allowedRoles: MANAGER_ROLES }
);

