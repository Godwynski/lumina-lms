"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit2, Archive, Check, RotateCcw, Hash, Type, AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Category } from "@/types/admin";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CategoryItemProps {
  category: Category;
  draftCategory?: Category;
  isBulkEditing: boolean;
  isChanged: boolean;
  onDraftChange?: (field: keyof Category, value: string) => void;
  onEdit?: (category: Category) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
}

/**
 * Minimalist category entry in the management list.
 * Supports standard display, archived states, and inline bulk editing.
 */
export function CategoryItem({
  category,
  draftCategory,
  isBulkEditing,
  isChanged,
  onDraftChange,
  onEdit,
  onArchive,
  onRestore,
}: CategoryItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center justify-between rounded-xl border border-border/60 bg-card p-4 transition-all duration-300 shadow-xs",
        isBulkEditing && isChanged && "border-primary/40 bg-primary/5",
        !category.is_active && !isBulkEditing && "opacity-60 grayscale-[0.4] bg-muted/20",
        "hover:bg-muted/10 hover:border-border"
      )}
    >
      <div className="flex-1 min-w-0">
        {isBulkEditing && draftCategory && onDraftChange ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                <Type className="h-3 w-3" />
                Category Name
              </label>
              <Input
                value={draftCategory.name}
                onChange={(e) => onDraftChange("name", e.target.value)}
                className="h-9 rounded-lg bg-background border-border text-xs font-semibold focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Category Name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                <Hash className="h-3 w-3" />
                Slug (URL Identifier)
              </label>
              <Input
                value={draftCategory.slug}
                onChange={(e) => onDraftChange("slug", e.target.value)}
                className="h-9 rounded-lg bg-background border-border text-xs font-mono font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="slug-identifier"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-1.5">
                <AlignLeft className="h-3 w-3" />
                Description
              </label>
              <Input
                value={draftCategory.description || ""}
                onChange={(e) => onDraftChange("description", e.target.value)}
                className="h-9 rounded-lg bg-background border-border text-xs font-medium focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Optional description"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors">
                {category.name}
              </h3>
              {!category.is_active && (
                <span className="px-2 py-0.5 rounded-full bg-muted border border-border/50 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Archived
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[10px] font-medium text-primary bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">
                {category.slug}
              </span>
              {category.description && (
                <p className="text-xs text-muted-foreground truncate max-w-[400px]">
                  {category.description}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 ml-4 shrink-0">
        {!isBulkEditing && onEdit && onArchive && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={() => onEdit(category)}
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                  aria-label="Edit category"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Change this category&apos;s name, web link, or summary.
              </TooltipContent>
            </Tooltip>

            {category.is_active ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={() => onArchive(category.id)}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                    aria-label="Archive category"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Hide this category from the public book catalog without deleting past records.
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={() => onRestore && onRestore(category.id)}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"
                    aria-label="Restore category"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Reactivate this category so students and staff can browse it again.
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        )}
        {isBulkEditing && isChanged && (
          <div className="h-8 flex items-center justify-center px-2.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold uppercase tracking-wider">
            <Check className="h-3 w-3 mr-1" />
            Modified
          </div>
        )}
      </div>
    </div>
  );
}
