"use client";

import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type TableSortDirection = "asc" | "desc";

export function SortableTableHeader({
  children,
  direction,
  onToggle,
}: {
  children: ReactNode;
  direction?: TableSortDirection;
  onToggle: () => void;
}) {
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
  const state = direction === "asc" ? " (ascending)" : direction === "desc" ? " (descending)" : "";

  return (
    <button
      type="button"
      aria-label={typeof children === "string" ? `Sort by ${children}${state}` : undefined}
      className="inline-flex min-h-6 items-center gap-1 rounded-sm uppercase hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      onClick={onToggle}
    >
      {children}
      <Icon aria-hidden="true" className={cn("size-3 shrink-0", direction ? "text-foreground" : "opacity-60")} />
    </button>
  );
}

export function TableSortSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      aria-label="Sort by"
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      className={cn("app-toolbar-control w-auto min-w-0 max-w-full border border-border bg-background pl-3 pr-7 focus-visible:outline-2 focus-visible:outline-ring", className)}
    >
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}
