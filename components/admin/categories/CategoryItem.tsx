"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit2, Archive, Check, RotateCcw, Hash, Type, AlignLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Category } from "@/types/admin";

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
 * A single category entry in the management list.
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
        "group flex items-center justify-between rounded-[2rem] border border-border/10 bg-muted/[0.02] p-6 transition-all duration-500",
        isBulkEditing && isChanged && "border-primary/20 bg-primary/[0.02] shadow-[0_0_20px_rgba(var(--primary),0.02)]",
        !category.is_active && !isBulkEditing && "opacity-60 grayscale-[0.5] bg-muted/[0.05]",
        "hover:bg-muted/[0.05] hover:border-border/20"
      )}
    >
      <div className="flex-1 min-w-0">
        {isBulkEditing && draftCategory && onDraftChange ? (
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 ml-1 flex items-center gap-1.5">
                <Type className="h-2.5 w-2.5" />
                Display Name
              </label>
              <Input
                value={draftCategory.name}
                onChange={(e) => onDraftChange("name", e.target.value)}
                className="h-11 rounded-xl bg-background border-border/20 text-xs font-bold shadow-inner focus:ring-4 focus:ring-primary/5 transition-all"
                placeholder="Category Name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 ml-1 flex items-center gap-1.5">
                <Hash className="h-2.5 w-2.5" />
                URL Identifier
              </label>
              <Input
                value={draftCategory.slug}
                onChange={(e) => onDraftChange("slug", e.target.value)}
                className="h-11 rounded-xl bg-background border-border/20 text-xs font-mono font-bold shadow-inner focus:ring-4 focus:ring-primary/5 transition-all"
                placeholder="slug-identifier"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 ml-1 flex items-center gap-1.5">
                <AlignLeft className="h-2.5 w-2.5" />
                Description
              </label>
              <Input
                value={draftCategory.description || ""}
                onChange={(e) => onDraftChange("description", e.target.value)}
                className="h-11 rounded-xl bg-background border-border/20 text-xs font-medium shadow-inner focus:ring-4 focus:ring-primary/5 transition-all"
                placeholder="Optional description"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-black text-foreground tracking-tight group-hover:text-primary transition-colors duration-500">
                {category.name}
              </h3>
              {!category.is_active && (
                 <span className="px-2 py-0.5 rounded-full bg-muted/40 border border-border/40 text-[8px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 shadow-xs">
                   Archived
                 </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <p className="font-mono text-[10px] font-bold text-primary/40 bg-primary/[0.03] px-2 py-0.5 rounded-md border border-primary/5">
                {category.slug}
              </p>
              {category.description && (
                <p className="text-[11px] text-muted-foreground/50 font-medium truncate max-w-[400px]">
                  {category.description}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2.5 ml-8">
        {!isBulkEditing && onEdit && onArchive && (
          <>
            <Button
              onClick={() => onEdit(category)}
              size="sm"
              variant="outline"
              className="h-10 w-10 rounded-xl p-0 border-border/20 bg-background/50 backdrop-blur-sm text-muted-foreground/60 hover:text-primary hover:border-primary/20 hover:bg-primary/[0.03] transition-all duration-300 shadow-sm"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            {category.is_active ? (
              <Button
                onClick={() => onArchive(category.id)}
                size="sm"
                variant="outline"
                className="h-10 w-10 rounded-xl p-0 border-border/20 bg-background/50 backdrop-blur-sm text-muted-foreground/60 hover:text-rose-500 hover:border-rose-500/20 hover:bg-rose-500/[0.03] transition-all duration-300 shadow-sm"
                title="Archive category"
              >
                <Archive className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => onRestore && onRestore(category.id)}
                size="sm"
                variant="outline"
                className="h-10 w-10 rounded-xl p-0 border-border/20 bg-background/50 backdrop-blur-sm text-muted-foreground/60 hover:text-emerald-500 hover:border-emerald-500/20 hover:bg-emerald-500/[0.03] transition-all duration-300 shadow-sm"
                title="Restore category"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
        {isBulkEditing && isChanged && (
          <div className="h-11 flex items-center justify-center px-4 rounded-xl bg-primary/[0.03] text-primary border border-primary/20 shadow-sm animate-in fade-in zoom-in duration-500">
            <Check className="h-4 w-4 mr-2" />
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Modified</span>
          </div>
        )}
      </div>
    </div>
  );
}

