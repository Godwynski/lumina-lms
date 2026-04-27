"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Plus } from "lucide-react";
import { CategoryItem } from "./categories/CategoryItem";
import { CategoryDialog } from "./categories/CategoryDialog";

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
}

export function CategoryManagement({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [draftCategories, setDraftCategories] = useState<Category[]>(initialCategories);
  const [isBulkEditing, setIsBulkEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog state
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
      setError("Name and slug are required");
      return;
    }

    setLoading(true);
    setError(null);

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

        if (!response.ok) throw new Error("Failed to update category");

        const updated = await response.json();
        setCategories((prev) =>
          prev.map((c) => (c.id === editingId ? updated : c))
        );
      } else {
        const response = await fetch("/api/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...formData, slug: normalizedSlug }),
        });

        if (!response.ok) throw new Error("Failed to create category");

        const newCategory = await response.json();
        setCategories((prev) => [...prev, newCategory]);
        setDraftCategories((prev) => [...prev, newCategory]);
      }

      setDialogOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Are you sure you want to archive this category?")) return;
 
    setLoading(true);
    setError(null);
 
    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });
 
      if (!response.ok) throw new Error("Failed to archive category");
 
      setCategories((prev) => prev.map((c) => c.id === id ? { ...c, is_active: false } : c));
      setDraftCategories((prev) => prev.map((c) => c.id === id ? { ...c, is_active: false } : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const changedIds = draftCategories
    .filter((draft) => {
      const current = categories.find((c) => c.id === draft.id);
      if (!current) return false;
      return current.name !== draft.name || current.slug !== draft.slug || (current.description || "") !== (draft.description || "");
    })
    .map((c) => c.id);

  const changedSet = new Set(changedIds);

  const handleBulkSave = async () => {
    if (changedIds.length === 0) {
      setIsBulkEditing(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      for (const id of changedIds) {
        const draft = draftCategories.find((c) => c.id === id);
        if (!draft) continue;

        const normalizedSlug = toSlug(draft.slug || draft.name);
        if (!draft.name || !normalizedSlug) {
          throw new Error("Name and slug are required");
        }

        const response = await fetch(`/api/admin/categories/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name,
            slug: normalizedSlug,
            description: draft.description || "",
            is_active: draft.is_active,
          }),
        });

        if (!response.ok) throw new Error("Failed to update categories");
      }

      setCategories(draftCategories.map((c) => ({ ...c, slug: toSlug(c.slug || c.name) })));
      setIsBulkEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
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
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
        <div>
          <h2 className="text-xl font-black text-foreground tracking-tight">Catalog Categories</h2>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mt-1">
            Manage your library&apos;s taxonomy
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {isBulkEditing ? (
            <>
              {changedIds.length > 0 && (
                <span className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-primary mr-2">
                  {changedIds.length} changes
                </span>
              )}
              <Button 
                variant="ghost" 
                onClick={resetBulkEdit} 
                className="h-9 rounded-xl px-4 text-[11px] font-bold uppercase tracking-wider" 
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleBulkSave} 
                className="h-9 rounded-xl px-6 text-[11px] font-bold uppercase tracking-wider shadow-md" 
                disabled={loading || changedIds.length === 0}
              >
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={() => setIsBulkEditing(true)} 
                className="h-9 rounded-xl px-6 text-[11px] font-bold uppercase tracking-wider border-border/40 hover:bg-muted"
              >
                Bulk Edit
              </Button>
              <Button 
                onClick={() => openDialog()} 
                className="h-9 rounded-xl gap-2 px-6 text-[11px] font-bold uppercase tracking-wider shadow-md shadow-primary/20"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Category
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-medium text-destructive">
          {error}
        </div>
      )}

      {categories.length === 0 ? (
        <div className="rounded-3xl border border-border/40 bg-card/30 p-12 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-muted-foreground/40" />
          <h3 className="text-base font-bold text-foreground">No categories defined</h3>
          <p className="mt-1 text-sm text-muted-foreground">Get started by creating a new category for your catalog.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {(isBulkEditing ? draftCategories : categories).map((category) => (
            <CategoryItem
              key={category.id}
              category={category}
              draftCategory={draftCategories.find((c) => c.id === category.id)}
              isBulkEditing={isBulkEditing}
              isChanged={changedSet.has(category.id)}
              onDraftChange={(field, value) => handleDraftChange(category.id, field, value)}
              onEdit={openDialog}
              onArchive={handleArchive}
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
