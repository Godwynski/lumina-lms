"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role: string;
  className?: string;
}

const roleStyles: Record<string, string> = {
  super_admin: "text-foreground font-bold",
  admin: "text-foreground font-bold",
  librarian: "text-blue-700 font-semibold",
  library_staff: "text-indigo-700 font-semibold",
  patron: "text-muted-foreground font-medium",
};

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrator",
  librarian: "Librarian",
  library_staff: "Library Staff",
  patron: "Patron",
};

export function getRoleLabel(role?: string | null, fallback = "Patron"): string {
  if (!role) return fallback;
  const normalized = role.trim().toLowerCase();
  if (!normalized) return fallback;
  return ROLE_LABELS[normalized] || role;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const normalized = role.trim().toLowerCase();
  const displayName = ROLE_LABELS[normalized] || role;
  
  return (
    <span className={cn("text-[11px] uppercase tracking-tight", roleStyles[normalized] || "text-muted-foreground", className)}>
      {displayName}
    </span>
  );
}
