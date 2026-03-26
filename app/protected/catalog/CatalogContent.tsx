'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { getBooks, softDeleteBook } from '@/lib/actions/catalog';
import { AlertTriangle } from 'lucide-react';
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Book, Category } from '@/lib/types';
import { ModernInventoryClient } from '@/components/inventory/ModernInventoryClient';

interface CatalogContentProps {
  initialData: { data: Book[]; count: number };
  categories: Category[];
  page: number;
  q: string;
  stock: string;
  categoryId: string;
}

export function CatalogSkeleton() {
  return (
    <div className="w-full space-y-4 pb-5 md:pb-7 animate-pulse">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm h-16 w-full" />
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm h-12 w-1/2" />
      <div className="space-y-2 mt-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 w-full rounded-lg bg-muted border border-border" />
        ))}
      </div>
    </div>
  );
}

export function CatalogContent({ initialData, categories, page, q, stock, categoryId }: CatalogContentProps) {
  const { data, mutate, isLoading } = useSWR(
    ['catalog', page, q, stock, categoryId],
    () => getBooks(q, categoryId || undefined, page, 9),
    { fallbackData: initialData, revalidateOnMount: true }
  );

  const books = data?.data || [];
  const totalCount = data?.count || 0;
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [deleteError, setDeleteError] = useState('');

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
      toast.success(`Removed "${bookToDelete.title}" from inventory`);
      mutate();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete book';
      setDeleteError(message);
    }
  };

  if (isLoading && !data) return <CatalogSkeleton />;

  return (
    <div className="w-full">
      <ModernInventoryClient 
        books={books || []} 
        totalItems={totalCount} 
        categories={categories}
        onDelete={handleDeleteClick} 
      />

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="rounded-xl border-border p-4 shadow-sm sm:max-w-[420px]">
          <DialogHeader>
            <div className="status-danger mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg">
              <AlertTriangle size={20} />
            </div>
            <DialogTitle className="text-center text-base font-semibold tracking-tight text-foreground">Remove from inventory?</DialogTitle>
            <DialogDescription className="pt-2 text-center text-sm leading-relaxed text-muted-foreground">
              You are about to remove <span className="font-semibold text-foreground">&quot;{bookToDelete?.title}&quot;</span>. This can be restored later.
            </DialogDescription>
          </DialogHeader>
          
          {deleteError && (
            <div className="status-danger mt-2 flex items-center gap-2 rounded-lg p-2 text-xs">
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
