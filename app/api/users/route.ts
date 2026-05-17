import { withAuthApi, apiSuccess, apiError } from "@/lib/api-utils";
import { normalizeUserRole, UserRole } from "@/lib/auth-helpers";
import { logAuditActivity } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";

const MANAGER_ROLES: UserRole[] = ["super_admin", "librarian"];

function mapProfileToUser(row: Record<string, unknown>) {
  const createdAt = typeof row.created_at === "string" ? row.created_at : null;
  const created = createdAt ? new Date(createdAt) : null;
  const email = typeof row.email === "string" ? row.email : "";
  const nameFromEmail = email
    .split("@")[0]
    ?.split(".")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");

  return {
    id: String(row.id ?? ""),
    name:
      typeof row.full_name === "string" && row.full_name.trim()
        ? row.full_name
        : nameFromEmail || "Unnamed User",
    email,
    role: normalizeUserRole(row.role as string),
    status: typeof row.status === "string" ? row.status.toUpperCase() : "ACTIVE",
    student_id: typeof row.student_id === "string" ? row.student_id : null,
    department:
      typeof row.department === "string" && row.department.trim()
        ? row.department
        : "General",
    joined: created
      ? created.toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : "Unknown",
    address: typeof row.address === "string" ? row.address : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    permissions: (row.permissions as Record<string, boolean>) || {},
  };
}

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
    let body: { email?: unknown; role?: unknown; department?: unknown };
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body", "BAD_REQUEST", 400);
    }

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const requestedRole = normalizeUserRole(body.role as string);
    const department =
      typeof body.department === "string" ? body.department.trim() : "";

    if (requesterRole === "librarian" && body.role && requestedRole !== "student") {
      return apiError("Librarians are not allowed to assign roles", "FORBIDDEN", 403);
    }

    if (!email) {
      return apiError("Email is required", "EMAIL_REQUIRED", 400);
    }

    if (requestedRole === "student" && body.role !== "student") {
       // if it defaulted to student but user didn't want student, it might be invalid
       // but normalizeUserRole is robust. Let's just check if it's one of managers.
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
    let body: {
      id?: unknown;
      name?: unknown;
      email?: unknown;
      role?: unknown;
      status?: unknown;
      department?: unknown;
      student_id?: unknown;
      permissions?: unknown;
      address?: unknown;
      phone?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body", "BAD_REQUEST", 400);
    }

    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) {
      return apiError("User id is required", "ID_REQUIRED", 400);
    }

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

