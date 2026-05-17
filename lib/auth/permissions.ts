import type { ComponentType } from "react";

export type Role = "student" | "student_assistant" | "librarian" | "super_admin" | null;

export interface Profile {
  full_name?: string | null;
  avatar_url?: string | null;
  status?: string;
  role?: string | null;
  permissions?: {
    manage_circulation?: boolean;
    manage_attendance?: boolean;
    view_admin_dashboard?: boolean;
  } | null;
}

export const ROLE_RANKS: Record<Exclude<Role, null>, number> = {
  student: 1,
  student_assistant: 2,
  librarian: 3,
  super_admin: 4,
};

export type NavItem = {
  href: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  minRole?: Exclude<Role, null>;
  exactRoles?: Exclude<Role, null>[];
  excludeRoles?: Exclude<Role, null>[];
  permissionKey?: "manage_circulation" | "manage_attendance" | "view_admin_dashboard";
};

export function hasPermission(
  userRole: Role,
  item: NavItem,
  profile?: Profile | null
): boolean {
  const { minRole, exactRoles, permissionKey, excludeRoles } = item;
  const isDeactivatedSA = userRole === "student_assistant" && profile?.status?.toUpperCase() !== "ACTIVE";

  if (excludeRoles && userRole && excludeRoles.includes(userRole)) {
    return false;
  }

  // 1. Exact role match (highest priority)
  if (exactRoles && exactRoles.length > 0) {
    if (userRole && exactRoles.includes(userRole)) return true;
    // If exactRoles is specified and no match, and no minRole fallback, deny access
    if (!minRole) return false;
  }

  // 2. Minimum rank check
  if (!userRole) return false;
  const roleRank = ROLE_RANKS[userRole];
  const minRank = minRole ? ROLE_RANKS[minRole] : 0;

  if (roleRank < minRank) return false;

  // 3. Specific permission requirement for staff/admin tools
  if (permissionKey) {
    if (userRole === "super_admin" || userRole === "librarian") return true;
    const permissions = profile?.permissions;
    if (!permissions || !permissions[permissionKey as keyof typeof permissions]) {
      return false;
    }
  }

  // 4. Deactivation check
  if (isDeactivatedSA && (minRole !== "student" || permissionKey)) {
    return false;
  }

  return true;
}

export function isStaff(role: Role, profile?: Profile | null): boolean {
  return (
    role === "super_admin" ||
    role === "librarian" ||
    (role === "student_assistant" && profile?.status?.toUpperCase() === "ACTIVE")
  );
}

export function isAccessBlocked(profile?: Profile | null): boolean {
  return (
    profile?.status === "PENDING" ||
    profile?.status === "SUSPENDED" ||
    profile?.status === "INACTIVE"
  );
}
