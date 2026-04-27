"use client";

import * as React from "react";
import { cn } from "@/lib/utils";


interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  // User/General
  active: "status-success",
  pending: "status-warning",
  suspended: "status-danger",
  
  // Book Copies (Uppercase from DB)
  AVAILABLE: "status-success",
  BORROWED: "status-warning",
  MAINTENANCE: "status-neutral bg-amber-100 text-amber-700 border-amber-200",
  LOST: "status-danger",

  // Reservations/General logic
  READY: "status-success bg-emerald-50 text-emerald-700 border-emerald-200",
  ACTIVE: "status-warning",
  CANCELLED: "status-danger opacity-70",
  COMPLETED: "status-neutral",
  EXPIRED: "status-danger brightness-90",
  RETURNED: "status-success bg-emerald-50 text-emerald-700 border-emerald-200",
  OVERDUE: "status-danger brightness-90",
};

const statusLabels: Record<string, string> = {
  // Overrides for display if needed
  AVAILABLE: "Available",
  BORROWED: "Borrowed",
  MAINTENANCE: "Maintenance",
  LOST: "Lost",
  READY: "Ready",
  ACTIVE: "Active",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
  RETURNED: "Returned",
  OVERDUE: "Overdue",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalized = status.toUpperCase();
  const rawNormalized = status.toLowerCase();
  
  // Try exact match, then try uppercase (for DB enums), then try lowercase
  const styleClass = statusStyles[status] || statusStyles[normalized] || statusStyles[rawNormalized] || "status-neutral";
  const label = statusLabels[status] || statusLabels[normalized] || status;

  return (
    <span 
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider leading-none transition-colors",
        styleClass,
        className
      )}
    >
      {label}
    </span>
  );
}
