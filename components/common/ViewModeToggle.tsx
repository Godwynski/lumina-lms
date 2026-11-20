"use client";

import { LayoutGrid, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export type CatalogViewMode = "cards" | "table";

/** Resolves the active view mode, preferring an explicit URL parameter over the saved preference. */
export function resolveViewMode(urlView: string | null, savedView: unknown): CatalogViewMode {
  if (urlView === "table" || urlView === "cards") return urlView;
  return savedView === "table" ? "table" : "cards";
}

interface ViewModeToggleProps {
  value: CatalogViewMode;
  onChange: (mode: CatalogViewMode) => void;
  ariaLabel?: string;
}

/** Shared Cards / Table segmented view toggle for Inventory and Catalog screens. */
export function ViewModeToggle({ value, onChange, ariaLabel = "View mode" }: ViewModeToggleProps) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex items-center rounded-xl border border-border/60 bg-muted/30 p-1 shrink-0">
      <Button
        type="button"
        variant={value === "cards" ? "default" : "ghost"}
        size="sm"
        aria-pressed={value === "cards"}
        onClick={() => onChange("cards")}
        className="h-11 min-w-11 sm:h-9 sm:min-w-0 rounded-lg px-3 gap-1.5 text-xs font-semibold"
      >
        <LayoutGrid className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Cards</span>
      </Button>
      <Button
        type="button"
        variant={value === "table" ? "default" : "ghost"}
        size="sm"
        aria-pressed={value === "table"}
        onClick={() => onChange("table")}
        className="h-11 min-w-11 sm:h-9 sm:min-w-0 rounded-lg px-3 gap-1.5 text-xs font-semibold"
      >
        <Table2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
        <span className="sr-only sm:not-sr-only">Table</span>
      </Button>
    </div>
  );
}
