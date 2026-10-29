"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  GraduationCap,
  Plus,
  Edit3,
  Edit2,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface IdentityListManagerProps {
  value: string;
  initialValue: string;
  onChange: (val: string) => void;
  disabled: boolean;
}

const MAX_ITEM_LENGTH = 60;

/**
 * Minimalist management interface for academic programs under System Data > Identity.
 * Provides full parity with Categories: itemized list, inline edit dialog, and bulk management.
 */
export function IdentityListManager({
  value,
  initialValue,
  onChange,
  disabled,
}: IdentityListManagerProps) {
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [draftItems, setDraftItems] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formName, setFormName] = useState("");

  const currentItems = useMemo(() => {
    try {
      if (value.startsWith("[") && value.endsWith("]")) {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((i) => typeof i === "string") : [];
      }
      return value.split(",").map((i) => i.trim()).filter(Boolean);
    } catch {
      return value.split(",").map((i) => i.trim()).filter(Boolean);
    }
  }, [value]);

  const initialItems = useMemo(() => {
    try {
      if (initialValue.startsWith("[") && initialValue.endsWith("]")) {
        const parsed = JSON.parse(initialValue);
        return Array.isArray(parsed) ? parsed.filter((i) => typeof i === "string") : [];
      }
      return initialValue.split(",").map((i) => i.trim()).filter(Boolean);
    } catch {
      return initialValue.split(",").map((i) => i.trim()).filter(Boolean);
    }
  }, [initialValue]);

  // Bulk edit handling
  const startBulkEdit = () => {
    setDraftItems([...currentItems]);
    setIsBulkEditing(true);
  };

  const cancelBulkEdit = () => {
    setIsBulkEditing(false);
    setDraftItems([]);
  };

  const handleDraftChange = (index: number, val: string) => {
    setDraftItems((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const removeDraftItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addDraftRow = () => {
    setDraftItems((prev) => [...prev, ""]);
  };

  const saveBulkEdit = () => {
    const cleaned = draftItems.map((i) => i.trim()).filter(Boolean);
    const unique = Array.from(new Set(cleaned));
    onChange(JSON.stringify(unique));
    setIsBulkEditing(false);
    toast.success(`Updated ${unique.length} academic programs`);
  };

  // Single item edit/add dialog
  const openAddDialog = () => {
    setEditingIndex(null);
    setFormName("");
    setDialogOpen(true);
  };

  const openEditDialog = (index: number) => {
    setEditingIndex(index);
    setFormName(currentItems[index] || "");
    setDialogOpen(true);
  };

  const handleSaveDialog = () => {
    const trimmed = formName.trim();
    if (!trimmed) {
      toast.error("Program name cannot be empty");
      return;
    }
    if (trimmed.length > MAX_ITEM_LENGTH) {
      toast.error(`Program name cannot exceed ${MAX_ITEM_LENGTH} characters`);
      return;
    }

    if (editingIndex !== null) {
      const updated = [...currentItems];
      updated[editingIndex] = trimmed;
      onChange(JSON.stringify(updated));
      toast.success("Program updated");
    } else {
      if (currentItems.includes(trimmed)) {
        toast.error("Program already exists in the list");
        return;
      }
      const updated = [...currentItems, trimmed];
      onChange(JSON.stringify(updated));
      toast.success("Program added");
    }

    setDialogOpen(false);
    setFormName("");
    setEditingIndex(null);
  };

  const removeItem = (index: number) => {
    const updated = currentItems.filter((_, i) => i !== index);
    onChange(JSON.stringify(updated));
    toast.success("Program removed");
  };

  const isFormValid = formName.trim().length > 0 && formName.length <= MAX_ITEM_LENGTH;

  return (
    <div className="w-full space-y-6">
      {/* Header Overview & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shrink-0">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Overview
            </p>
            <h4 className="text-sm font-bold text-foreground tracking-tight">
              {currentItems.length} Registered {currentItems.length === 1 ? "Program" : "Programs"}
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {isBulkEditing ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={cancelBulkEdit}
                disabled={disabled}
                className="h-9 px-4 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
              >
                <X className="h-3.5 w-3.5 mr-1.5" />
                Discard
              </Button>
              <Button
                type="button"
                onClick={saveBulkEdit}
                disabled={disabled}
                className="h-9 px-5 rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Save Changes
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={startBulkEdit}
                disabled={disabled}
                className="h-9 px-4 rounded-xl text-xs font-semibold border-border hover:bg-muted/50 transition-all"
              >
                <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                Bulk Management
              </Button>
              <Button
                type="button"
                onClick={openAddDialog}
                disabled={disabled}
                className="h-9 px-4 rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Program
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isBulkEditing ? (
        /* Bulk Edit Mode */
        <div className="space-y-3">
          <div className="p-3 bg-muted/40 rounded-xl border border-border/50 text-xs text-muted-foreground flex items-center justify-between">
            <span>Edit course and program names directly in the fields below.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addDraftRow}
              className="h-7 text-xs rounded-lg"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Row
            </Button>
          </div>

          <div className="grid gap-2.5">
            {draftItems.map((item, index) => (
              <div
                key={`bulk-${index}`}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-border/60 bg-card hover:border-primary/30 transition-all shadow-xs"
              >
                <span className="text-[11px] font-mono font-bold text-muted-foreground/60 w-6 text-center shrink-0">
                  {index + 1}
                </span>
                <Input
                  value={item}
                  onChange={(e) => handleDraftChange(index, e.target.value)}
                  placeholder="e.g. BS Information Technology"
                  disabled={disabled}
                  maxLength={MAX_ITEM_LENGTH}
                  className="h-9 rounded-lg bg-background text-xs font-medium border-border"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeDraftItem(index)}
                  disabled={disabled}
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Standard Itemized List View */
        <div className="space-y-3">
          {currentItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/5 p-12 text-center">
              <div className="h-12 w-12 rounded-xl bg-muted/20 flex items-center justify-center text-muted-foreground mx-auto mb-3">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-semibold text-foreground mb-1">No Academic Programs</h4>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-4">
                No programs have been registered. Add your first program for student registration.
              </p>
              <Button
                type="button"
                onClick={openAddDialog}
                disabled={disabled}
                size="sm"
                className="rounded-xl text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Program
              </Button>
            </div>
          ) : (
            <div className="grid gap-2.5">
              {currentItems.map((item, index) => {
                const isNew = !initialItems.includes(item);
                return (
                  <div
                    key={`${item}-${index}`}
                    className="group flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-muted/10 transition-all shadow-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-8 w-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary/70 border border-primary/10 shrink-0 group-hover:bg-primary/10 transition-colors">
                        <GraduationCap className="h-4 w-4" />
                      </div>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {item}
                        </span>
                        {isNew && (
                          <Badge
                            variant="secondary"
                            className="bg-primary/10 text-primary border-primary/20 text-[9px] uppercase font-bold tracking-wider py-0 px-2"
                          >
                            New
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(index)}
                        disabled={disabled}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                        title="Edit program name"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        disabled={disabled}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                        title="Remove program"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Edit / Add Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-2xl border-border bg-background p-0 shadow-xl sm:max-w-md overflow-hidden">
          <div className="p-6 space-y-5">
            <DialogHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div className="px-2.5 py-0.5 rounded-full bg-muted border border-border/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  System Data
                </div>
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                  {editingIndex !== null ? "Edit Program" : "Add Academic Program"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-medium">
                  {editingIndex !== null
                    ? "Update the academic program title."
                    : "Add a new degree program for student onboarding and filtering."}
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-0.5">
                <label className="text-xs font-semibold text-foreground">
                  Program Name
                </label>
                <span
                  className={cn(
                    "text-[10px] font-medium tabular-nums",
                    formName.length > MAX_ITEM_LENGTH
                      ? "text-rose-500 font-bold"
                      : "text-muted-foreground/60"
                  )}
                >
                  {formName.length}/{MAX_ITEM_LENGTH}
                </span>
              </div>
              <Input
                placeholder="e.g. BS Information Technology"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (isFormValid) handleSaveDialog();
                  }
                }}
                disabled={disabled}
                autoFocus
                className={cn(
                  "h-10 rounded-xl bg-background border-border text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40",
                  formName.length > MAX_ITEM_LENGTH && "border-rose-500 focus:ring-rose-500/20"
                )}
              />
            </div>
          </div>

          <div className="p-6 pt-0 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={disabled}
              className="flex-1 h-10 rounded-xl text-xs font-semibold uppercase tracking-wider border-border hover:bg-muted/50 transition-all"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveDialog}
              disabled={disabled || !isFormValid}
              className="flex-[1.5] h-10 rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition-all"
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              {editingIndex !== null ? "Save Changes" : "Add Program"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
