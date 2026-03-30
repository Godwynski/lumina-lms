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
import { FileEdit, Loader2, AlertCircle } from "lucide-react";

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
  const [type, setType] = useState(resource.type || "capstone");
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
      if (!res.ok) throw new Error(data.error || "Failed to save metadata.");

      setOpen(false);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Internal Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 rounded-lg border-border px-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95">
          <FileEdit size={14} />
          Metadata
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border-border bg-card shadow-2xl">
        <div className="bg-muted/40 p-6 border-b border-border/50">
           <DialogHeader className="space-y-1.5 text-left">
             <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-2">
               <FileEdit size={20} strokeWidth={1.5} />
             </div>
             <DialogTitle className="text-xl font-bold tracking-tight">Modify Metadata</DialogTitle>
             <DialogDescription className="text-xs font-semibold text-muted-foreground">
               Update archival descriptions and classification for this thesis.
             </DialogDescription>
           </DialogHeader>
        </div>

        <div className="space-y-5 p-6 bg-card/60">
          {error && (
             <div className="flex items-center gap-2 rounded-xl bg-destructive/10 p-3 text-xs font-bold text-destructive">
               <AlertCircle size={15} /> {error}
             </div>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="col-span-full space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Full Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 rounded-lg font-medium" />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Lead Author</Label>
              <Input value={author} onChange={(e) => setAuthor(e.target.value)} className="h-10 rounded-lg font-medium" />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Release Year</Label>
              <Input
                placeholder="2024"
                value={publishedYear}
                onChange={(e) => setPublishedYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                className="h-10 rounded-lg font-medium"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Classification</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-10 rounded-lg font-medium"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="capstone">Capstone Project</SelectItem>
                  <SelectItem value="thesis">Graduate Thesis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Visibility Level</Label>
                <Select value={accessLevel} onValueChange={setAccessLevel}>
                    <SelectTrigger className="h-10 rounded-lg font-medium"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="STUDENT">Student Access</SelectItem>
                        <SelectItem value="STAFF">Faculty Only</SelectItem>
                        <SelectItem value="LIBRARIAN">Internal Admin</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="col-span-full space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Institutional Faculty</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-10 rounded-lg font-medium"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned / General</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
             <Button variant="ghost" className="h-10 rounded-xl px-6 font-bold tracking-tight opacity-60 hover:opacity-100" onClick={() => setOpen(false)} disabled={saving}>
               Ignore
             </Button>
             <Button onClick={save} disabled={saving} className="h-10 min-w-[140px] rounded-xl bg-primary font-bold tracking-tight shadow-lg shadow-primary/20">
               {saving ? <Loader2 size={16} className="animate-spin" /> : "Commit Changes"}
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
