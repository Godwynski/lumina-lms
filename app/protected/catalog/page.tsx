'use client';

import { useEffect, useState } from 'react';
import { getBooks, softDeleteBook } from '@/lib/actions/catalog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Book } from '@/lib/types';
import { ModernInventoryClient } from '@/components/inventory/ModernInventoryClient';

export default function CatalogPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      setLoading(true);
      const data = await getBooks();
      setBooks(data);
    } catch (error) {
      console.error('Failed to load books', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (book: Book) => {
    setBookToDelete(book);
    setDeleteError('');
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!bookToDelete) return;
    
    try {
      await softDeleteBook(bookToDelete.id);
      setDeleteModalOpen(false);
      loadBooks();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete book';
      setDeleteError(message);
    }
  };

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-slate-200" />
          <Loader2 className="absolute inset-0 h-16 w-16 animate-spin text-slate-600" />
        </div>
        <div className="text-center">
          <p className="mb-2 text-xl font-bold uppercase tracking-wider text-slate-900">Synchronizing inventory</p>
          <p className="text-sm text-slate-600">Loading current catalog records...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      <ModernInventoryClient books={books} onDelete={handleDeleteClick} />

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="rounded-xl border-border p-4 shadow-sm sm:max-w-[420px]">
          <DialogHeader>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600">
              <AlertTriangle size={20} />
            </div>
            <DialogTitle className="text-center text-base font-semibold tracking-tight text-foreground">Remove from inventory?</DialogTitle>
            <DialogDescription className="pt-2 text-center text-sm leading-relaxed text-muted-foreground">
              You are about to remove <span className="font-semibold text-foreground">&quot;{bookToDelete?.title}&quot;</span>. This can be restored later.
            </DialogDescription>
          </DialogHeader>
          
          {deleteError && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {deleteError}
            </div>
          )}

          <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-2">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} className="h-8 flex-1 rounded-md text-xs font-semibold uppercase tracking-wider">Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} className="h-8 flex-1 rounded-md text-xs font-semibold uppercase tracking-wider">Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

