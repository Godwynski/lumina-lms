'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBooks, softDeleteBook } from '@/lib/actions/catalog';
import { AlertTriangle, Plus, Trash2, Eye, Library } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function CatalogPage() {
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<any>(null);
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

  const handleDeleteClick = (book: any) => {
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
    } catch (error: any) {
      setDeleteError(error.message || 'Failed to delete book');
    }
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 text-sm font-medium">Loading catalog...</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-zinc-200/50 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Catalog & Inventory</h1>
          <p className="text-zinc-500 text-sm">Manage the library's physical collection.</p>
        </div>
        <Link href="/protected/catalog/add">
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 h-11">
            <Plus className="w-4 h-4 mr-2" />
            Add New Book
          </Button>
        </Link>
      </div>

      {/* Low Stock Alerts */}
      <div className="space-y-3">
        {books.filter(b => b.available_copies === 0 && b.total_copies > 0).map(book => (
          <div key={`alert-${book.id}`} className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl flex items-start shadow-sm">
            <AlertTriangle className="w-5 h-5 mr-3 mt-0.5 text-orange-600" />
            <div>
              <h3 className="font-semibold">Low Stock Alert: {book.title}</h3>
              <p className="text-sm opacity-90">There are no available copies left for this book. All physical copies are currently borrowed or lost.</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200/50">
                <th className="p-4 px-6 font-semibold text-zinc-900 text-sm uppercase tracking-wider">Book Information</th>
                <th className="p-4 px-6 font-semibold text-zinc-900 text-sm uppercase tracking-wider">Storage Location</th>
                <th className="p-4 px-6 font-semibold text-zinc-900 text-sm uppercase tracking-wider">Inventory Status</th>
                <th className="p-4 px-6 font-semibold text-zinc-900 text-sm uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {books.map(book => (
                <tr key={book.id} className="hover:bg-zinc-50 transition-colors group">
                  <td className="p-4 px-6">
                    <div className="font-semibold text-zinc-900 group-hover:text-indigo-600 transition-colors">{book.title}</div>
                    <div className="text-sm text-zinc-500">{book.author}</div>
                    <div className="text-xs text-zinc-400 mt-1 font-mono">ISBN: {book.isbn || 'N/A'}</div>
                  </td>
                  <td className="p-4 px-6">
                    <div className="text-sm font-medium text-zinc-700">{book.section || 'Unassigned'}</div>
                    <div className="text-xs text-zinc-500">{book.location || 'Unknown Shelf'}</div>
                  </td>
                  <td className="p-4 px-6">
                    <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${book.available_copies === 0 ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                       <div className={`text-sm font-semibold ${book.available_copies === 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        {book.available_copies} / {book.total_copies} Available
                      </div>
                    </div>
                  </td>
                  <td className="p-4 px-6">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/protected/catalog/${book.id}`}>
                        <Button variant="ghost" size="sm" className="rounded-lg text-zinc-600 hover:text-indigo-600 hover:bg-indigo-50">
                          <Eye className="w-4 h-4 mr-2" />
                          Manage
                        </Button>
                      </Link>
                      <Button 
                        onClick={() => handleDeleteClick(book)} 
                        variant="ghost" 
                        size="sm" 
                        className="rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {books.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-zinc-50 border border-zinc-100">
                        <Library className="w-8 h-8 text-zinc-300" />
                      </div>
                      <p className="text-zinc-400 font-medium">No books found in the catalog.</p>
                      <Link href="/protected/catalog/add">
                        <Button variant="outline" className="rounded-xl">Add your first book</Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Warning Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-zinc-900">Delete Book?</DialogTitle>
            <DialogDescription className="text-zinc-500 pt-2">
              Are you sure you want to delete <span className="font-semibold text-zinc-900">"{bookToDelete?.title}"</span>? This action will hide the book from the catalog.
              If there are active borrowed copies, this action will be blocked.
            </DialogDescription>
          </DialogHeader>
          
          {deleteError && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {deleteError}
            </div>
          )}

          <DialogFooter className="mt-6 gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} className="rounded-xl font-medium">Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium">Delete Permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
