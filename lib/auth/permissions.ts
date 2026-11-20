import type { ComponentType } from "react";

export type Role = "patron" | "library_staff" | "librarian" | "super_admin" | null;

export interface Profile {
  full_name?: string | null;
  avatar_url?: string | null;
  status?: string;
  onboarding_completed?: boolean | null;
  role?: string | null;
  permissions?: {
    manage_circulation?: boolean;
    manage_attendance?: boolean;
    view_admin_dashboard?: boolean;
    manage_inventory?: boolean;
  } | null;
}

export const ROLE_RANKS: Record<Exclude<Role, null>, number> = {
  patron: 1,
  library_staff: 2,
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
  permissionKey?: "manage_circulation" | "manage_attendance" | "view_admin_dashboard" | "manage_inventory";
};

export function hasPermission(
  userRole: Role,
  item: NavItem,
  profile?: Profile | null
): boolean {
  const { minRole, exactRoles, permissionKey, excludeRoles } = item;
  const isDeactivatedSA = userRole === "library_staff" && profile?.status?.toUpperCase() !== "ACTIVE";

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
  if (isDeactivatedSA && (minRole !== "patron" || permissionKey)) {
    return false;
  }

  return true;
}

export function isStaff(role: Role, profile?: Profile | null): boolean {
  return (
    role === "super_admin" ||
    role === "librarian" ||
    (role === "library_staff" && profile?.status?.toUpperCase() === "ACTIVE")
  );
}

// Only ACTIVE accounts may use the app. The schema also allows PENDING, INACTIVE, SUSPENDED,
// GRADUATED, DELETED and ARCHIVED, and every one of them is blocked. A missing status is not blocked.
export function isAccessBlocked(profile?: Profile | null): boolean {
  const status = profile?.status?.trim().toUpperCase();
  return !!status && status !== "ACTIVE";
}

// An approved (ACTIVE) patron who never completed the profile form goes through onboarding first.
export function needsOnboarding(role: Role, profile?: Profile | null): boolean {
  return (
    role === "patron" &&
    profile?.status?.trim().toUpperCase() === "ACTIVE" &&
    profile.onboarding_completed === false
  );
}