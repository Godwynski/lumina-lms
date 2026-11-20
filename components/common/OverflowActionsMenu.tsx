"use client";

import * as React from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface OverflowAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

interface OverflowActionsMenuProps {
  actions: OverflowAction[];
  label?: string;
  className?: string;
  align?: "start" | "center" | "end";
}

/**
 * Accessible overflow ("more") menu for secondary toolbar/header actions on mobile.
 * Uses Radix DropdownMenu for keyboard navigation, Escape handling, and focus restoration.
 */
export function OverflowActionsMenu({
  actions,
  label = "More actions",
  className,
  align = "end",
}: OverflowActionsMenuProps) {
  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={label}
          className={cn(
            "h-11 w-11 shrink-0 rounded-xl border-border/30 bg-background/60 shadow-none hover:bg-muted/30",
            className
          )}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[12rem] rounded-xl p-1.5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <DropdownMenuItem
              key={action.id}
              disabled={action.disabled}
              onSelect={() => {
                if (!action.disabled) action.onSelect();
              }}
              className={cn(
                "min-h-11 cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold",
                action.destructive && "text-destructive focus:text-destructive"
              )}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
              <span>{action.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
