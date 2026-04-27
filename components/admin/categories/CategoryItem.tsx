"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit2, Archive, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
}

interface CategoryItemProps {
  category: Category;
  draftCategory?: Category;
  isBulkEditing: boolean;
  isChanged: boolean;
  onDraftChange?: (field: keyof Category, value: string) => void;
  onEdit?: (category: Category) => void;
  onArchive?: (id: string) => void;
}

export function CategoryItem({
  category,
  draftCategory,
  isBulkEditing,
  isChanged,
  onDraftChange,
  onEdit,
  onArchive,
}: CategoryItemProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-2xl border border-border/40 bg-card/30 p-5 shadow-none transition-all hover:bg-card/50",
        isBulkEditing && isChanged && "border-l-4 border-l-primary bg-primary/5",
        !category.is_active && "opacity-50 grayscale"
      )}
    >
      <div className="flex-1 min-w-0">
        {isBulkEditing && draftCategory && onDraftChange ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Name</label>
              <Input
                value={draftCategory.name}
                onChange={(e) => onDraftChange("name", e.target.value)}
                className="h-10 rounded-xl bg-background border-border/40 text-xs shadow-sm focus:ring-2 focus:ring-primary/20"
                placeholder="Category Name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Slug</label>
              <Input
                value={draftCategory.slug}
                onChange={(e) => onDraftChange("slug", e.target.value)}
                className="h-10 rounded-xl bg-background border-border/40 text-xs font-mono shadow-sm focus:ring-2 focus:ring-primary/20"
                placeholder="slug"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Description</label>
              <Input
                value={draftCategory.description || ""}
                onChange={(e) => onDraftChange("description", e.target.value)}
                className="h-10 rounded-xl bg-background border-border/40 text-xs shadow-sm focus:ring-2 focus:ring-primary/20"
                placeholder="Optional description"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black text-foreground tracking-tight">{category.name}</h3>
              {!category.is_active && (
                 <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                   Archived
                 </span>
              )}
            </div>
            <p className="font-mono text-[11px] font-semibold text-primary/60">{category.slug}</p>
            {category.description && (
              <p className="text-xs text-muted-foreground font-medium mt-1">{category.description}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 ml-6">
        {!isBulkEditing && onEdit && onArchive && (
          <>
            <Button
              onClick={() => onEdit(category)}
              size="sm"
              variant="outline"
              className="h-9 w-9 rounded-xl p-0 border-border/40 text-muted-foreground hover:text-primary transition-colors"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => onArchive(category.id)}
              size="sm"
              variant="outline"
              className="h-9 w-9 rounded-xl p-0 border-border/40 text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/10 transition-colors"
              title="Archive category"
            >
              <Archive className="h-4 w-4" />
            </Button>
          </>
        )}
        {isBulkEditing && isChanged && (
          <div className="h-9 flex items-center justify-center px-3 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Check className="h-4 w-4 mr-1.5" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Edited</span>
          </div>
        )}
      </div>
    </div>
  );
}
