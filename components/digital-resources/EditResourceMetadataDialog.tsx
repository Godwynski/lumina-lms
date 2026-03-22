"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Resource = {
  id: string;
  title: string;
  author: string;
  type: string;
  category_id: string | null;
  access_level: string;
  published_year?: number | null;
};

type Category = { id: string; name: string };

export default function EditResourceMetadataDialog({
  resource,
  categories,
}: {
  resource: Resource;
  categories: Category[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(resource.title);
  const [author, setAuthor] = useState(resource.author);
  const [type, setType] = useState(resource.type || "ebook");
  const [categoryId, setCategoryId] = useState(resource.category_id || "none");
  const [accessLevel, setAccessLevel] = useState(resource.access_level || "STUDENT");
  const [publishedYear, setPublishedYear] = useState(
    resource.published_year ? String(resource.published_year) : ""
  );

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/resources/manage/${resource.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          author,
          type,
          categoryId: categoryId === "none" ? null : categoryId,
          accessLevel,
          publishedYear,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save metadata.");
      }

      setOpen(false);
      router.refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save metadata.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 rounded-md border-border px-2.5 text-[11px] text-muted-foreground hover:text-foreground">
          Edit Metadata
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-xl p-4">
        <DialogHeader>
          <DialogTitle className="text-sm">Edit Resource Metadata</DialogTitle>
          <DialogDescription className="text-xs">
            Update title, author, category, type, and access level.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-author">Author</Label>
            <Input id="edit-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-published-year">Year Published</Label>
            <Input
              id="edit-published-year"
              placeholder="e.g. 2024"
              value={publishedYear}
              onChange={(e) => setPublishedYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ebook">E-Book</SelectItem>
                  <SelectItem value="journal">Journal</SelectItem>
                  <SelectItem value="thesis">Thesis</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Access Level</Label>
              <Select value={accessLevel} onValueChange={setAccessLevel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">Student</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                  <SelectItem value="LIBRARIAN">Librarian</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" className="h-8 rounded-md text-xs" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving} className="h-8 rounded-md bg-primary text-xs text-primary-foreground hover:bg-primary/90">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
