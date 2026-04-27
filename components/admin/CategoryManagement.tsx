"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Archive, Edit2, AlertCircle, Loader2 } from "lucide-react";

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Category management</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Manage catalog categories.</p>
        </div>
        <div className="flex items-center gap-1.5">
          {isBulkEditing ? (
            <>
              {changedIds.length > 0 && (
                <span className="rounded-md border border-border bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                  {changedIds.length} changed
                </span>
              )}
              <Button variant="outline" onClick={resetBulkEdit} className="h-8 rounded-md px-2.5 text-xs" disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleBulkSave} className="h-8 rounded-md px-2.5 text-xs" disabled={loading || changedIds.length === 0}>
                {loading ? "Saving..." : "Save changes"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsBulkEditing(true)} className="h-8 rounded-md px-2.5 text-xs">
                Edit list
              </Button>
              <Button onClick={() => openDialog()} className="h-8 rounded-md gap-1.5 px-2.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="status-danger rounded-lg px-3 py-2 text-xs">
          {error}
        </div>
      )}

      {categories.length === 0 ? (
        <Card className="border-border bg-card p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No categories yet.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {(isBulkEditing ? draftCategories : categories).map((category) => (
            <Card
              key={category.id}
              className={`flex items-center justify-between border-border bg-card p-3 shadow-sm ${
                isBulkEditing && changedSet.has(category.id) ? "border-l-4 border-l-primary" : ""
              } ${
                !category.is_active ? "opacity-50" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                {isBulkEditing ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input
                      value={category.name}
                      onChange={(e) =>
                        setDraftCategories((prev) =>
                          prev.map((c) => (c.id === category.id ? { ...c, name: e.target.value } : c)),
                        )
                      }
                      className="h-8 text-xs"
                    />
                    <Input
                      value={category.slug}
                      onChange={(e) =>
                        setDraftCategories((prev) =>
                          prev.map((c) => (c.id === category.id ? { ...c, slug: toSlug(e.target.value) } : c)),
                        )
                      }
                      className="h-8 text-xs"
                    />
                    <Input
                      value={category.description || ""}
                      onChange={(e) =>
                        setDraftCategories((prev) =>
                          prev.map((c) => (c.id === category.id ? { ...c, description: e.target.value } : c)),
                        )
                      }
                      className="h-8 text-xs"
                      placeholder="Description"
                    />
                  </div>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-foreground">{category.name}</h3>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{category.slug}</p>
                    {category.description && <p className="mt-1 text-xs text-muted-foreground">{category.description}</p>}
                  </>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                {!isBulkEditing && (
                  <>
                    <Button
                      onClick={() => openDialog(category)}
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 rounded-md p-0 text-muted-foreground"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      onClick={() => handleArchive(category.id)}
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 rounded-md p-0 text-destructive hover:bg-destructive/10"
                      title="Archive category"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit category" : "Create category"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update category details."
                : "Add a new category."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
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
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                placeholder="e.g., science-fiction"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, slug: toSlug(e.target.value) }))
                }
                disabled={loading}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Brief description of the category"
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
                disabled={loading}
                className="h-9"
              />
            </div>

            {error && (
              <p className="status-danger rounded-md p-2 text-xs">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setDialogOpen(false)}
              variant="outline"
              disabled={loading}
              className="h-8 rounded-md px-3 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="h-8 rounded-md px-3 text-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
