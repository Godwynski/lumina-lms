"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Layers, Edit3, Save, X, Loader2 } from "lucide-react";
import { CategoryItem } from "./categories/CategoryItem";
import { CategoryDialog } from "./categories/CategoryDialog";

import { toast } from "sonner";
import { Category } from "@/types/admin";

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Main management interface for system categories.
 * Handles CRUD operations and bulk modifications.
 */
export function CategoryManagement({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [draftCategories, setDraftCategories] = useState<Category[]>(initialCategories);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
  });

  const resetForm = () => {
    setFormData({ name: "", slug: "", description: "" });
    setEditingId(null);
    setError(null);
  };

  const resetBulkEdit = () => {
    setDraftCategories(categories);
    setIsBulkEditing(false);
    setError(null);
  };

  const openDialog = (category?: Category) => {
    if (category) {
      setFormData({
        name: category.name,
        slug: category.slug,
        description: category.description || "",
      });
      setEditingId(category.id);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const normalizedSlug = toSlug(formData.slug || formData.name);
    if (!formData.name || !normalizedSlug) {
      toast.error("Label and identifier are required");
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        const response = await fetch(`/api/admin/categories/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            slug: normalizedSlug,
            is_active: true,
          }),
        });

        if (!response.ok) throw new Error("Failed to update category protocol");

        const updated = await response.json();
        setCategories((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        setDraftCategories((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        toast.success("Category updated successfully");
      } else {
        const response = await fetch("/api/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, slug: normalizedSlug }),
        });

        if (!response.ok) throw new Error("Failed to initialize new category");

        const newCategory = await response.json();
        setCategories((prev) => [...prev, newCategory]);
        setDraftCategories((prev) => [...prev, newCategory]);
        toast.success("New category registered");
      }
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Internal system error";
      toast.error(msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });

      if (!response.ok) throw new Error("Failed to archive category");

      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: false } : c)));
      setDraftCategories((prev) => prev.map((c) => (c.id === id ? { ...c, is_active: false } : c)));
      toast.success("Category archived");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });

      if (!response.ok) throw new Error("Failed to restore category");

      const updated = await response.json();
      setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setDraftCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
      toast.success("Category restored to active state");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setLoading(false);
    }
  };

  const changedIds = draftCategories.filter((draft) => {
    const current = categories.find((c) => c.id === draft.id);
    if (!current) return false;
    return current.name !== draft.name || current.slug !== draft.slug || (current.description || "") !== (draft.description || "");
  }).map((c) => c.id);

  const changedSet = new Set(changedIds);

  const handleBulkSave = async () => {
    if (changedIds.length === 0) {
      setIsBulkEditing(false);
      return;
    }

    setLoading(true);
    try {
      for (const id of changedIds) {
        const draft = draftCategories.find((c) => c.id === id);
        if (!draft) continue;

        const response = await fetch(`/api/admin/categories/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name,
            slug: draft.slug,
            description: draft.description || "",
            is_active: draft.is_active,
          }),
        });

        if (!response.ok) throw new Error(`Failed to commit changes for ${draft.name}`);
      }

      setCategories(draftCategories);
      setIsBulkEditing(false);
      toast.success(`Successfully committed ${changedIds.length} modifications`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk commit failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDraftChange = (id: string, field: keyof Category, value: string) => {
    setDraftCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: field === "slug" ? toSlug(value) : value } : c))
    );
  };

  return (
    <div className="w-full space-y-8 p-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/[0.03] flex items-center justify-center text-primary/40 border border-primary/10">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 leading-none mb-1">
              Registry Overview
            </p>
            <h2 className="text-sm font-black text-foreground tracking-tight">
              {categories.length} Registered {categories.length === 1 ? 'Category' : 'Categories'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isBulkEditing ? (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-500">
              {changedIds.length > 0 && (
                <div className="px-4 py-1.5 rounded-full bg-primary/[0.03] border border-primary/10 text-[9px] font-black uppercase tracking-[0.2em] text-primary shadow-xs">
                  {changedIds.length} Pending Mods
                </div>
              )}
              <Button
                variant="ghost"
                onClick={resetBulkEdit}
                disabled={loading}
                className="h-11 rounded-2xl px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 hover:text-foreground hover:bg-muted/10 transition-all"
              >
                <X className="h-4 w-4 mr-2" />
                Discard
              </Button>
              <Button
                onClick={handleBulkSave}
                disabled={loading || changedIds.length === 0}
                className="h-11 rounded-2xl px-8 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Commit Changes
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setIsBulkEditing(true)}
                className="h-11 rounded-2xl px-6 text-[10px] font-black uppercase tracking-[0.2em] border-border/20 bg-muted/5 text-muted-foreground/60 hover:text-foreground hover:bg-muted/10 hover:border-border/40 transition-all shadow-xs"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Bulk Management
              </Button>
              <Button
                onClick={() => openDialog()}
                className="h-11 rounded-2xl gap-2.5 px-8 text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-primary/10 hover:shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
              >
                <Plus className="h-4 w-4" />
                Add Category
              </Button>
            </div>
          )}
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-[2.5rem] border border-dashed border-border/20 bg-muted/[0.02] p-16 text-center group hover:bg-muted/[0.04] transition-all duration-700">
          <div className="h-20 w-20 rounded-[2rem] bg-muted/5 flex items-center justify-center text-muted-foreground/20 mx-auto mb-6 group-hover:scale-110 group-hover:text-primary/30 group-hover:bg-primary/5 transition-all duration-700">
            <Layers className="h-10 w-10" />
          </div>
          <h3 className="text-sm font-black text-foreground/60 group-hover:text-foreground transition-colors mb-2">No categories defined</h3>
          <p className="text-xs text-muted-foreground/40 font-medium max-w-[280px] mx-auto leading-relaxed">
            Initialize your organization&apos;s classification system by adding your first category.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {(isBulkEditing ? draftCategories : categories).map((category) => (
            <CategoryItem
              key={category.id}
              category={category}
              draftCategory={draftCategories.find((c) => c.id === category.id)}
              isBulkEditing={isBulkEditing}
              isChanged={changedSet.has(category.id)}
              onDraftChange={(field: keyof Category, value: string) => handleDraftChange(category.id, field, value)}
              onEdit={openDialog}
              onArchive={handleArchive}
              onRestore={handleRestore}
            />
          ))}
        </div>
      )}

      <CategoryDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        editingId={editingId}
        formData={formData}
        setFormData={setFormData}
        onSave={handleSave}
        loading={loading}
        error={error}
      />
    </div>
  );
}

