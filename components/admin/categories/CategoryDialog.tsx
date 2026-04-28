"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

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
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function CategoryDialog({
  isOpen,
  onOpenChange,
  editingId,
  formData,
  setFormData,
  onSave,
  loading,
  error,
}: CategoryDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-border/40 bg-card p-6 shadow-2xl sm:max-w-md">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-black tracking-tight">
            {editingId ? "Edit Category" : "New Category"}
          </DialogTitle>
          <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
            {editingId ? "Update category details" : "Add a new catalog category"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-[11px] font-bold uppercase tracking-widest text-foreground/80">Name</Label>
            <Input
              id="name"
              placeholder="e.g., Science Fiction"
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
              className="h-11 rounded-xl bg-muted/20 border-border/40 focus:ring-2 focus:ring-primary/20 transition-all text-sm shadow-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug" className="text-[11px] font-bold uppercase tracking-widest text-foreground/80">Slug</Label>
            <Input
              id="slug"
              placeholder="e.g., science-fiction"
              value={formData.slug}
              onChange={(e) =>
                setFormData((p) => ({ ...p, slug: toSlug(e.target.value) }))
              }
              disabled={loading}
              className="h-11 rounded-xl bg-muted/20 border-border/40 focus:ring-2 focus:ring-primary/20 transition-all text-sm font-mono shadow-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-[11px] font-bold uppercase tracking-widest text-foreground/80">Description</Label>
            <Input
              id="description"
              placeholder="Brief description of the category"
              value={formData.description}
              onChange={(e) =>
                setFormData((p) => ({ ...p, description: e.target.value }))
              }
              disabled={loading}
              className="h-11 rounded-xl bg-muted/20 border-border/40 focus:ring-2 focus:ring-primary/20 transition-all text-sm shadow-sm"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs font-medium text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <Button
            onClick={() => onOpenChange(false)}
            variant="ghost"
            disabled={loading}
            className="h-11 rounded-xl px-6 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={loading}
            className="h-11 rounded-xl px-8 text-xs font-bold uppercase tracking-wider shadow-lg shadow-primary/20"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Category"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
