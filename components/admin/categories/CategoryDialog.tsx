"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Layers, Type, Hash, AlignLeft, Check } from "lucide-react";
import { cn, toSlug } from "@/lib/utils";

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
}

interface CategoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  formData: CategoryFormData;
  setFormData: React.Dispatch<React.SetStateAction<CategoryFormData>>;
  onSave: () => void;
  loading: boolean;
  error: string | null;
  isChanged?: boolean;
}

/**
 * Minimalist dialog for creating or editing a book category.
 */
export function CategoryDialog({
  isOpen,
  onOpenChange,
  editingId,
  formData,
  setFormData,
  onSave,
  loading,
  error,
  isChanged = true,
}: CategoryDialogProps) {
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-border bg-background p-0 shadow-xl sm:max-w-md overflow-hidden">
        <div className="p-6 space-y-6">
          <DialogHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Layers className="h-5 w-5" />
              </div>
              <div className="px-2.5 py-0.5 rounded-full bg-muted border border-border/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Book Categories
              </div>
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                {editingId ? "Edit Category" : "Add Category"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-medium">
                {editingId ? "Update existing category details." : "Create a new book category or classification."}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center px-0.5">
                <Label htmlFor="name" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Type className="h-3.5 w-3.5 text-muted-foreground" />
                  Category Name
                </Label>
                <span className={cn(
                  "text-[10px] font-medium tabular-nums",
                  formData.name.length > 50 ? "text-rose-500 font-bold" : "text-muted-foreground/60"
                )}>
                  {formData.name.length}/50
                </span>
              </div>
              <Input
                id="name"
                placeholder="e.g. Theoretical Physics"
                value={formData.name}
                onChange={(e) =>
                  setFormData((p) => {
                    const nextName = e.target.value;
                    return {
                      ...p,
                      name: nextName,
                      slug: toSlug(p.slug ? p.slug : nextName),
                    };
                  })
                }
                disabled={loading}
                className={cn(
                  "h-10 rounded-xl bg-background border-border text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40",
                  formData.name.length > 50 && "border-rose-500 focus:ring-rose-500/20"
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-0.5">
                <Label htmlFor="slug" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  Slug (URL Identifier)
                </Label>
                <span className={cn(
                  "text-[10px] font-medium tabular-nums",
                  formData.slug.length > 60 ? "text-rose-500 font-bold" : "text-muted-foreground/60"
                )}>
                  {formData.slug.length}/60
                </span>
              </div>
              <Input
                id="slug"
                placeholder="e.g. theoretical-physics"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, slug: toSlug(e.target.value) }))
                }
                disabled={loading}
                className={cn(
                  "h-10 rounded-xl bg-background border-border text-xs font-mono font-medium focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40",
                  formData.slug.length > 60 && "border-rose-500 focus:ring-rose-500/20"
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-0.5">
                <Label htmlFor="description" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <AlignLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  Description
                </Label>
                <span className={cn(
                  "text-[10px] font-medium tabular-nums",
                  formData.description.length > 200 ? "text-rose-500 font-bold" : "text-muted-foreground/60"
                )}>
                  {formData.description.length}/200
                </span>
              </div>
              <Input
                id="description"
                placeholder="Brief summary of this category..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
                disabled={loading}
                className={cn(
                  "h-10 rounded-xl bg-background border-border text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40",
                  formData.description.length > 200 && "border-rose-500 focus:ring-rose-500/20"
                )}
              />
            </div>
          </div>
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <Button
            onClick={() => onOpenChange(false)}
            variant="outline"
            disabled={loading}
            className="flex-1 h-10 rounded-xl text-xs font-semibold uppercase tracking-wider border-border hover:bg-muted/50 transition-all"
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={
              loading || 
              formData.name.length > 50 || 
              formData.slug.length > 60 || 
              formData.description.length > 200 ||
              !formData.name.trim() ||
              (editingId !== null && !isChanged)
            }
            className="flex-[1.5] h-10 rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition-all"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
            ) : (
              <Check className="h-3.5 w-3.5 mr-2" />
            )}
            {editingId ? "Save Changes" : "Add Category"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
