"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role: string;
  className?: string;
}

const roleStyles: Record<string, string> = {
  admin: "text-foreground font-bold",
  librarian: "text-blue-700 font-semibold",
  student_assistant: "text-indigo-700 font-semibold",
  staff: "text-indigo-700 font-semibold", // Legacy support
  student: "text-muted-foreground font-medium",
};

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  librarian: "Librarian",
  student_assistant: "Staff / SA",
  staff: "Staff / SA", // Legacy support
  student: "Student",
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const normalized = role.toLowerCase();
  const displayName = roleLabels[normalized] || role;
  
  return (
    <span className={cn("text-[11px] uppercase tracking-tight", roleStyles[normalized] || "text-muted-foreground", className)}>
      {displayName}
    </span>
  );
}
