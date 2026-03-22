"use client";

import { useState, useEffect } from "react";
import { Book } from "@/lib/types";
import { updateBook } from "@/lib/actions/catalog";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  MapPin, 
  Layers, 
  Book as BookIcon, 
  User, 
  Hash,
  Loader2,
  CheckCircle2
} from "lucide-react";

interface EditBookMetadataDialogProps {
  book: Book | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditBookMetadataDialog({ book, isOpen, onOpenChange, onSuccess }: EditBookMetadataDialogProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState({
    title: "",
    author: "",
    isbn: "",
    section: "",
    location: ""
  });

  useEffect(() => {
    if (book) {
      setFormData({
        title: book.title || "",
        author: book.author || "",
        isbn: book.isbn || "",
        section: book.section || "",
        location: book.location || ""
      });
      setSuccess(false);
      setError("");
    }
  }, [book, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book) return;

    setLoading(true);
    setError("");
    
    try {
      await updateBook(book.id, formData);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onOpenChange(false);
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update asset metadata");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-xl p-4">
        <DialogHeader>
          <DialogTitle className="text-sm">Edit Book</DialogTitle>
          <DialogDescription className="text-xs">
            Update title, author, ISBN, and shelf location details.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
           {error && (
             <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
               {error}
             </div>
           )}

           <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                 <Label htmlFor="title" className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Asset Title</Label>
                 <div className="relative">
                    <BookIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                     <Input
                       id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                       className="h-9 rounded-md border-border bg-muted pl-10"
                      required
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <Label htmlFor="author" className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Primary Author</Label>
                 <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                     <Input
                      id="author"
                      value={formData.author}
                      onChange={(e) => setFormData({...formData, author: e.target.value})}
                       className="h-9 rounded-md border-border bg-muted pl-10"
                      required
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <Label htmlFor="isbn" className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Serial / ISBN</Label>
                 <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                     <Input
                      id="isbn"
                      value={formData.isbn}
                      onChange={(e) => setFormData({...formData, isbn: e.target.value})}
                       className="h-9 rounded-md border-border bg-muted pl-10"
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <Label htmlFor="section" className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Classification Zone</Label>
                 <div className="relative">
                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                     <Input
                      id="section"
                      placeholder="e.g. Science Annex"
                      value={formData.section}
                      onChange={(e) => setFormData({...formData, section: e.target.value})}
                       className="h-9 rounded-md border-border bg-muted pl-10"
                    />
                 </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                 <Label htmlFor="location" className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Precise Shelf Location</Label>
                 <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                     <Input
                      id="location"
                      placeholder="e.g. Floor 2, Shelf B-14, Row 3"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                       className="h-9 rounded-md border-border bg-muted pl-10"
                    />
                 </div>
              </div>
           </div>

           <DialogFooter className="pt-1">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                className="h-8 rounded-md px-3 text-xs"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className={`h-8 rounded-md px-4 text-xs font-semibold uppercase tracking-wider transition-all ${
                  success 
                  ? "bg-emerald-500 hover:bg-emerald-600 text-primary-foreground" 
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
                }`}
                disabled={loading || success}
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : success ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    Saved
                  </span>
                ) : (
                  "Save Changes"
                )}
              </Button>
           </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
