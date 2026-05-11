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
  student: "text-muted-foreground font-medium",
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const normalized = role.toLowerCase();
  const displayName = normalized === "student_assistant" ? "Student Assistant" : role;
  
  return (
    <span className={cn("text-[11px] uppercase tracking-tight", roleStyles[normalized] || "text-muted-foreground", className)}>
      {displayName}
    </span>
  );
}
