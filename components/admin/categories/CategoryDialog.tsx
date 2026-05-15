"use client";

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
import { Loader2, Layers, Type, Hash, AlignLeft, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";


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

/**
 * Dialog for creating or editing a single category entry.
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
}: CategoryDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[3rem] border-border/40 bg-background p-0 shadow-2xl sm:max-w-md overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        
        <div className="p-8 space-y-10">
          <DialogHeader className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-14 w-14 rounded-2xl bg-primary/[0.03] flex items-center justify-center text-primary shadow-inner border border-primary/5">
                <Layers className="h-7 w-7" />
              </div>
              <div className="px-3 py-1 rounded-full bg-muted/40 border border-border/40 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 shadow-xs">
                Registry System
              </div>
            </div>
            <div className="space-y-1.5">
              <DialogTitle className="text-2xl font-black tracking-tight text-foreground">
                {editingId ? "Update Category" : "Register Category"}
              </DialogTitle>
              <DialogDescription className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 leading-none">
                {editingId ? "Modify existing registry parameters" : "Initialize a new classification node"}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2.5">
              <div className="flex justify-between items-center ml-1">
                <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 flex items-center gap-2">
                  <Type className="h-3 w-3" />
                  Display Label
                </Label>
                <span className={cn(
                  "text-[8px] font-bold tracking-widest",
                  formData.name.length > 50 ? "text-rose-500" : "text-muted-foreground/20"
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
                  "h-12 rounded-2xl bg-muted/5 border-border/20 focus:ring-4 focus:ring-primary/5 transition-all text-xs font-bold shadow-inner placeholder:text-muted-foreground/30",
                  formData.name.length > 50 && "border-rose-500/50 bg-rose-500/5"
                )}
              />
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center ml-1">
                <Label htmlFor="slug" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 flex items-center gap-2">
                  <Hash className="h-3 w-3" />
                  URL Identifier
                </Label>
                <span className={cn(
                  "text-[8px] font-bold tracking-widest",
                  formData.slug.length > 60 ? "text-rose-500" : "text-muted-foreground/20"
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
                  "h-12 rounded-2xl bg-muted/5 border-border/20 focus:ring-4 focus:ring-primary/5 transition-all text-xs font-mono font-bold shadow-inner placeholder:text-muted-foreground/30",
                  formData.slug.length > 60 && "border-rose-500/50 bg-rose-500/5"
                )}
              />
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between items-center ml-1">
                <Label htmlFor="description" className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 flex items-center gap-2">
                  <AlignLeft className="h-3 w-3" />
                  Meta Description
                </Label>
                <span className={cn(
                  "text-[8px] font-bold tracking-widest",
                  formData.description.length > 200 ? "text-rose-500" : "text-muted-foreground/20"
                )}>
                  {formData.description.length}/200
                </span>
              </div>
              <Input
                id="description"
                placeholder="Brief summary of this classification category..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
                disabled={loading}
                className={cn(
                  "h-12 rounded-2xl bg-muted/5 border-border/20 focus:ring-4 focus:ring-primary/5 transition-all text-xs font-medium shadow-inner placeholder:text-muted-foreground/30",
                  formData.description.length > 200 && "border-rose-500/50 bg-rose-500/5"
                )}
              />
            </div>

            {error && (
              <div className="rounded-2xl bg-rose-500/[0.03] border border-rose-500/10 p-4 text-[10px] font-bold text-rose-500 uppercase tracking-widest animate-in fade-in slide-in-from-top-2 duration-300">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="p-8 pt-0 flex gap-4">
          <Button
            onClick={() => onOpenChange(false)}
            variant="ghost"
            disabled={loading}
            className="flex-1 h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 hover:text-foreground hover:bg-muted/10 transition-all"
          >
            Abort
          </Button>
          <Button
            onClick={onSave}
            disabled={
              loading || 
              formData.name.length > 50 || 
              formData.slug.length > 60 || 
              formData.description.length > 200 ||
              !formData.name.trim()
            }
            className="flex-[2] h-14 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/10 hover:shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ShieldCheck className="h-4 w-4 mr-2" />
            )}
            {editingId ? "Update Protocol" : "Authorize Node"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

