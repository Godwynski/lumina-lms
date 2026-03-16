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
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-100 dark:border-indigo-900 rounded-full"></div>
          <Loader2 className="w-16 h-16 text-indigo-600 animate-spin absolute inset-0" />
        </div>
        <div className="text-center">
          <p className="text-xl font-black text-zinc-900 dark:text-white mb-2 uppercase tracking-widest">Sychronizing Vault</p>
          <p className="text-zinc-500 text-sm font-medium">Acquiring primary inventory ledger...</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <ModernInventoryClient books={books} onDelete={handleDeleteClick} />

      {/* Delete Warning Modal - Kept here for clean logic flow */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="rounded-[2.5rem] sm:max-w-[450px] p-8 border-none shadow-2xl">
          <DialogHeader>
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-red-500 mb-6 mx-auto">
              <AlertTriangle size={32} />
            </div>
            <DialogTitle className="text-2xl font-black text-zinc-900 dark:text-white text-center tracking-tight">Decommission Asset?</DialogTitle>
            <DialogDescription className="text-zinc-500 pt-4 text-center text-base leading-relaxed">
              You are about to remove <span className="font-bold text-zinc-900 dark:text-white">&quot;{bookToDelete?.title}&quot;</span> from the active physical inventory.
              <br/><br/>
              <span className="text-sm italic">Note: This action is logically reversible but will block active circulation if not managed correctly.</span>
            </DialogDescription>
          </DialogHeader>
          
          {deleteError && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm flex items-center gap-3 mt-4">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {deleteError}
            </div>
          )}

          <DialogFooter className="mt-10 gap-3 sm:gap-0 sm:flex-row flex-col">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} className="rounded-2xl h-14 font-black text-xs uppercase tracking-widest flex-1">Aborted Action</Button>
            <Button variant="destructive" onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-2xl h-14 font-black text-xs uppercase tracking-widest flex-1 shadow-xl shadow-red-100 dark:shadow-none">Confirm Removal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

