'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { getBookCopies, createBookCopy, updateBookCopyStatus, updateBook, softDeleteBook } from '@/lib/actions/catalog';
import {
  ChevronLeft,
  Plus,
  MapPin,
  Hash,
  Tag,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Wrench,
  SearchX,
  History,
  QrCode,
  Filter,
  Edit3,
  Trash2,
  Save,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { CompactPagination } from '@/components/ui/compact-pagination';
import { QRPrinterModal } from '@/components/qr-printer-modal';
import Link from 'next/link';
import type { Book, BookCopy } from '@/lib/types';

const STATUS_CONFIG = {
  'AVAILABLE': { label: 'Available', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  'BORROWED': { label: 'Borrowed', icon: History, color: 'text-blue-600', bg: 'bg-blue-50' },
  'MAINTENANCE': { label: 'Maintenance', icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50' },
  'LOST': { label: 'Lost', icon: SearchX, color: 'text-red-600', bg: 'bg-red-50' },
};

function isBookCopyStatus(value: string): value is BookCopy['status'] {
  return value === 'AVAILABLE' || value === 'BORROWED' || value === 'MAINTENANCE' || value === 'LOST';
}

interface StaffBookManagementClientProps {
  initialBook: Book;
  initialCopies: BookCopy[];
}

export function StaffBookManagementClient({ initialBook, initialCopies }: StaffBookManagementClientProps) {
  const router = useRouter();
  const [book, setBook] = useState<Book>(initialBook);
  const [copies, setCopies] = useState<BookCopy[]>(initialCopies);
  
  const [addCopyLoading, setAddCopyLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: initialBook.title,
    author: initialBook.author,
    isbn: initialBook.isbn || '',
    section: initialBook.section || '',
    location: initialBook.location || '',
  });

  const [copyFilter, setCopyFilter] = useState<'ALL' | BookCopy['status']>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAddCopy = async () => {
    setAddCopyLoading(true);
    try {
      await createBookCopy(initialBook.id, 'New Condition');
      const updatedCopies = await getBookCopies(initialBook.id);
      setCopies(updatedCopies);
      setBook(prev => ({ 
        ...prev, 
        total_copies: (prev.total_copies || 0) + 1, 
        available_copies: (prev.available_copies || 0) + 1 
      }));
      toast.success('Added new copy to inventory');
    } catch (err) {
      console.error(err);
      toast.error('Failed to add copy');
    } finally {
      setAddCopyLoading(false);
    }
  };

  const handleUpdateBook = async () => {
    setUpdateLoading(true);
    try {
      await updateBook(book.id, editForm);
      setBook(prev => ({ ...prev, ...editForm }));
      setIsEditing(false);
      toast.success('Book metadata updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update book');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDeleteBook = async () => {
    setDeleteLoading(true);
    try {
      await softDeleteBook(book.id);
      toast.success('Book removed from inventory');
      router.push('/catalog');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete book');
      setShowDeleteConfirm(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleStatusChange = async (copyId: string, newStatus: BookCopy['status']) => {
    try {
      await updateBookCopyStatus(copyId, newStatus);
      const updatedCopies = await getBookCopies(initialBook.id);
      setCopies(updatedCopies);
      
      const availCount = updatedCopies.filter(c => c.status === 'AVAILABLE').length;
      setBook(prev => ({
        ...prev,
        available_copies: availCount
      }));
      toast.success('Copy status updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    }
  };

  const visibleCopies = copies.filter((copy) => copyFilter === 'ALL' || copy.status === copyFilter);
  const totalPages = Math.max(1, Math.ceil(visibleCopies.length / pageSize));
  const pagedCopies = visibleCopies.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage(1);
  }, [copyFilter, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="w-full space-y-4 pb-6 md:pb-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8 rounded-md hover:bg-muted focus-visible:ring-2">
            <Link href="/catalog">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{book.title}</h1>
            <p className="text-xs text-muted-foreground">{book.author} - ID: {book.id.slice(0, 8)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2">
               <span className="text-[10px] font-bold text-destructive uppercase mr-1">Confirm removal?</span>
               <Button 
                variant="destructive" 
                size="sm" 
                onClick={handleDeleteBook}
                disabled={deleteLoading}
                className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider"
               >
                 {deleteLoading ? <Loader2 className="animate-spin h-3 w-3" /> : 'Yes, Purge'}
               </Button>
               <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowDeleteConfirm(false)}
                className="h-8 px-2 text-[10px] font-bold uppercase tracking-wider"
               >
                 Cancel
               </Button>
            </div>
          ) : (
            <>
              <Button 
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
                className={`h-8 rounded-md px-3 text-xs font-semibold focus-visible:ring-2 ${isEditing ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : ''}`}
              >
                {isEditing ? <X className="mr-1.5 h-3.5 w-3.5" /> : <Edit3 className="mr-1.5 h-3.5 w-3.5" />}
                {isEditing ? 'Cancel Edit' : 'Modify Records'}
              </Button>

              <Button 
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                className="h-8 border-destructive/20 text-destructive hover:bg-destructive/5 hover:border-destructive/40 rounded-md px-3 text-xs font-semibold focus-visible:ring-2"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Purge from Vault
              </Button>

              <div className="mx-1 h-4 w-[1px] bg-border" />

              <Button 
                onClick={handleAddCopy} 
                disabled={addCopyLoading}
                className="h-8 rounded-md px-3 text-xs font-semibold focus-visible:ring-2"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Copy
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
        {/* Book Info Sidebar */}
        <div className="space-y-3 lg:col-span-4 xl:col-span-3">
          <div className="overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm">
            {isEditing ? (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="space-y-3">
                   <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Asset Title</Label>
                      <Input 
                        value={editForm.title} 
                        onChange={e => setEditForm({...editForm, title: e.target.value})}
                        className="h-9 text-xs border-primary/20 bg-primary/5 focus-visible:ring-primary/30"
                      />
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Primary Author</Label>
                      <Input 
                        value={editForm.author} 
                        onChange={e => setEditForm({...editForm, author: e.target.value})}
                        className="h-9 text-xs border-primary/20 bg-primary/5 focus-visible:ring-primary/30"
                      />
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">ISBN</Label>
                        <Input 
                          value={editForm.isbn} 
                          onChange={e => setEditForm({...editForm, isbn: e.target.value})}
                          className="h-9 text-xs bg-muted/50"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Classification</Label>
                        <Input 
                          value={editForm.section} 
                          onChange={e => setEditForm({...editForm, section: e.target.value})}
                          className="h-9 text-xs bg-muted/50"
                        />
                      </div>
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Precise Location</Label>
                      <Input 
                        value={editForm.location} 
                        onChange={e => setEditForm({...editForm, location: e.target.value})}
                        className="h-9 text-xs bg-muted/50"
                      />
                   </div>
                </div>
                
                <Button 
                  onClick={handleUpdateBook} 
                  disabled={updateLoading}
                  className="w-full h-10 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  {updateLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                  Save All Changes
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-start gap-3">
                  <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {book.cover_url ? (
                      <Image src={book.cover_url} alt={book.title} fill className="object-cover" unoptimized={true} />
                    ) : (
                      <BookOpen className="h-full w-full p-3 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">{book.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{book.author}</p>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">ISBN:</span> {book.isbn || 'Unknown'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">Category:</span> {Array.isArray(book.categories) ? book.categories[0]?.name : (book.categories as { name?: string })?.name || 'Unassigned'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">Section:</span> {book.section || 'N/A'}
                  </div>
                </div>

                {book.tags && book.tags.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tags</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {book.tags.map((tag: string, i: number) => (
                        <span key={i} className="rounded-md border border-border/50 bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
             <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-foreground">
               <QrCode className="h-3.5 w-3.5" />
               Copy Snapshot
              </h3>
             <div className="space-y-1.5 rounded-lg border border-border bg-muted p-2.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground font-medium tracking-tight">Total:</span>
                  <span className="text-foreground font-semibold">{book.total_copies}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground font-medium tracking-tight">Available:</span>
                  <span className="text-foreground font-semibold">{book.available_copies}</span>
                </div>
             </div>
          </div>
        </div>

        {/* Inventory List */}
        <div className="space-y-2.5 lg:col-span-8 xl:col-span-9">
          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
            <h2 className="text-sm font-semibold text-foreground">Copies ({visibleCopies.length}/{copies.length})</h2>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card p-1.5 shadow-sm">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={copyFilter} onValueChange={(value) => {
                if (value === 'ALL' || isBookCopyStatus(value)) {
                  setCopyFilter(value as 'ALL' | BookCopy['status']);
                }
              }}>
                <SelectTrigger className="h-11 md:h-7 border-0 bg-transparent px-2 md:px-1 text-sm md:text-[11px] font-medium text-muted-foreground focus-visible:ring-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-1.5">
            {pagedCopies.map((copy) => {
              const status = STATUS_CONFIG[copy.status];
              const StatusIcon = status.icon;
              
              return (
                <div key={copy.id} className="flex flex-col justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm md:flex-row md:items-center">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 shrink-0 rounded-md ${status.bg} flex items-center justify-center`}>
                      <StatusIcon className={`h-4 w-4 ${status.color}`} />
                    </div>
                    <div>
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{copy.qr_string}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${status.bg} ${status.color}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                        Added {mounted ? new Date(copy.created_at).toLocaleDateString() : '...'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Select value={copy.status} onValueChange={(value) => {
                      if (isBookCopyStatus(value)) {
                        void handleStatusChange(copy.id, value);
                      }
                    }}>
                      <SelectTrigger className="h-11 md:h-7 rounded-md border border-border bg-muted px-4 md:px-2.5 text-sm md:text-[11px] font-medium text-muted-foreground focus-visible:ring-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <QRPrinterModal 
                      qrString={copy.qr_string} 
                      bookTitle={book.title}
                    />
                  </div>
                </div>
              );
            })}

            {visibleCopies.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-muted py-12 text-center">
                <AlertCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">No copies match this filter.</p>
                <p className="text-xs text-muted-foreground">Try another status or add a new copy.</p>
              </div>
            )}
          </div>

          {visibleCopies.length > 0 && (
            <CompactPagination
              page={page}
              totalItems={visibleCopies.length}
              pageSize={pageSize}
              onPageChange={setPage}
              pageSizeOptions={[10, 20, 30]}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>
      </div>
    </div>
  );
}
