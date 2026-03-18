"use client";

import { useState, useEffect } from "react";
import { Book } from "@/lib/types";
import { updateBook } from "@/lib/actions/catalog";
import { 
  Dialog, 
  DialogContent, 
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
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-none rounded-[2.5rem] shadow-2xl">
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 text-white relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
             <div className="h-12 w-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                <BookIcon size={24} />
             </div>
             <div>
                <DialogTitle className="text-2xl font-black tracking-tight">Modify Asset Metadata</DialogTitle>
                <DialogDescription className="text-indigo-100 font-medium opacity-80">
                  Update physical classification and storage parameters.
                </DialogDescription>
             </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-white dark:bg-zinc-900">
           {error && (
             <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium">
               {error}
             </div>
           )}

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <Label htmlFor="title" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Asset Title</Label>
                 <div className="relative">
                    <BookIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input 
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="pl-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-indigo-500/20"
                      required
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <Label htmlFor="author" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Primary Author</Label>
                 <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input 
                      id="author"
                      value={formData.author}
                      onChange={(e) => setFormData({...formData, author: e.target.value})}
                      className="pl-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-indigo-500/20"
                      required
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <Label htmlFor="isbn" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Serial / ISBN</Label>
                 <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input 
                      id="isbn"
                      value={formData.isbn}
                      onChange={(e) => setFormData({...formData, isbn: e.target.value})}
                      className="pl-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <Label htmlFor="section" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Classification Zone</Label>
                 <div className="relative">
                    <Layers className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input 
                      id="section"
                      placeholder="e.g. Science Annex"
                      value={formData.section}
                      onChange={(e) => setFormData({...formData, section: e.target.value})}
                      className="pl-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                 </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                 <Label htmlFor="location" className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Precise Shelf Location</Label>
                 <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input 
                      id="location"
                      placeholder="e.g. Floor 2, Shelf B-14, Row 3"
                      value={formData.location}
                      onChange={(e) => setFormData({...formData, location: e.target.value})}
                      className="pl-12 h-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 border-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                 </div>
              </div>
           </div>

           <DialogFooter className="pt-6">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                className="h-12 rounded-xl font-bold px-6"
                disabled={loading}
              >
                Discard
              </Button>
              <Button 
                type="submit" 
                className={`h-12 rounded-xl font-black text-xs uppercase tracking-widest px-8 transition-all ${
                  success 
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white" 
                  : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
                disabled={loading || success}
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : success ? (
                  <span className="flex items-center gap-2">
                    <CheckCircle2 size={18} />
                    Synced
                  </span>
                ) : (
                  "Update Ledger"
                )}
              </Button>
           </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
