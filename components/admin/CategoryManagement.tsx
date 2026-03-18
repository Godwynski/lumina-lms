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
import { Plus, Trash2, Edit2, AlertCircle, Loader2 } from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_active: boolean;
}

export function CategoryManagement({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
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
    if (!formData.name || !formData.slug) {
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
          body: JSON.stringify(formData),
        });

        if (!response.ok) throw new Error("Failed to create category");

        const newCategory = await response.json();
        setCategories((prev) => [...prev, newCategory]);
      }

      setDialogOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete category");

      setCategories((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Category Management</h2>
          <p className="text-sm text-zinc-500 mt-1">Manage book categories and genres</p>
        </div>
        <Button
          onClick={() => openDialog()}
          className="bg-indigo-600 hover:bg-indigo-700 rounded-lg gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {categories.length === 0 ? (
        <Card className="p-12 text-center border-zinc-200/50">
          <AlertCircle className="h-12 w-12 text-zinc-300 mx-auto mb-4" />
          <p className="text-zinc-500">No categories yet. Create your first one!</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {categories.map((category) => (
            <Card
              key={category.id}
              className={`p-4 border-zinc-200/50 flex items-center justify-between hover:shadow-md transition-shadow ${
                !category.is_active ? "opacity-50" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-zinc-900">{category.name}</h3>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">{category.slug}</p>
                {category.description && (
                  <p className="text-sm text-zinc-600 mt-1">{category.description}</p>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  onClick={() => openDialog(category)}
                  size="sm"
                  variant="ghost"
                  className="rounded-lg text-indigo-600 hover:bg-indigo-50"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => handleDelete(category.id)}
                  size="sm"
                  variant="ghost"
                  className="rounded-lg text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Category" : "Create Category"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the category details below"
                : "Add a new book category or genre"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Category Name</Label>
              <Input
                id="name"
                placeholder="e.g., Science Fiction"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                placeholder="e.g., science-fiction"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, slug: e.target.value }))
                }
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                placeholder="Brief description of the category"
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
                disabled={loading}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setDialogOpen(false)}
              variant="outline"
              disabled={loading}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Category"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
