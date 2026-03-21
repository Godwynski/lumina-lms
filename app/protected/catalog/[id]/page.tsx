'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { getBookById, getBookCopies, createBookCopy, updateBookCopyStatus } from '@/lib/actions/catalog';
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
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRPrinterModal } from '@/components/qr-printer-modal';
import Link from 'next/link';
import { Book, BookCopy } from '@/lib/types';

const STATUS_CONFIG = {
  'AVAILABLE': { label: 'Available', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  'BORROWED': { label: 'Borrowed', icon: History, color: 'text-blue-600', bg: 'bg-blue-50' },
  'MAINTENANCE': { label: 'Maintenance', icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50' },
  'LOST': { label: 'Lost', icon: SearchX, color: 'text-red-600', bg: 'bg-red-50' },
};

function isBookCopyStatus(value: string): value is BookCopy['status'] {
  return value === 'AVAILABLE' || value === 'BORROWED' || value === 'MAINTENANCE' || value === 'LOST';
}

export default function StaffBookManagementPage() {
  const params = useParams();
  const id = params.id as string;
  
  const [book, setBook] = useState<Book | null>(null);
  const [copies, setCopies] = useState<BookCopy[]>([]);
  const [loading, setLoading] = useState(true);
  const [addCopyLoading, setAddCopyLoading] = useState(false);
  const [copyFilter, setCopyFilter] = useState<'ALL' | BookCopy['status']>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    async function loadData() {
      try {
        const [bookData, copiesData] = await Promise.all([
          getBookById(id),
          getBookCopies(id)
        ]);
        setBook(bookData);
        setCopies(copiesData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadData();
  }, [id]);

  const handleAddCopy = async () => {
    setAddCopyLoading(true);
    try {
      await createBookCopy(id, 'New Condition');
      const updatedCopies = await getBookCopies(id);
      setCopies(updatedCopies);
      // Refresh book data for the counts
      const updatedBook = await getBookById(id);
      setBook(updatedBook);
    } catch (err) {
      console.error(err);
    } finally {
      setAddCopyLoading(false);
    }
  };

  const handleStatusChange = async (copyId: string, newStatus: BookCopy['status']) => {
    try {
      await updateBookCopyStatus(copyId, newStatus);
      const updatedCopies = await getBookCopies(id);
      setCopies(updatedCopies);
      const updatedBook = await getBookById(id);
      setBook(updatedBook);
    } catch (err) {
      console.error(err);
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

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!book) return <div className="p-12 text-center text-muted-foreground">Book not found.</div>;

  return (
    <div className="w-full space-y-4 pb-6 md:pb-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <Link href="/protected/catalog">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-muted">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{book.title}</h1>
            <p className="text-xs text-muted-foreground">{book.author} - ID: {id.slice(0, 8)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={handleAddCopy} 
            disabled={addCopyLoading}
            className="h-8 rounded-md px-3 text-xs font-semibold"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Copy
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
        {/* Book Info Sidebar */}
        <div className="space-y-3 lg:col-span-4 xl:col-span-3">
          <div className="overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm">
            <div className="mb-3 flex items-start gap-3">
              <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                {book.cover_url ? (
                  <Image src={book.cover_url} alt={book.title} fill className="object-cover" />
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
                <span className="font-medium">Category:</span> {Array.isArray(book.categories) ? book.categories[0]?.name : book.categories?.name || 'Unassigned'}
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
                <SelectTrigger className="h-7 border-0 bg-transparent px-1 text-[11px] font-medium text-muted-foreground">
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
                      <p className="text-[11px] text-muted-foreground">Added {new Date(copy.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Select value={copy.status} onValueChange={(value) => {
                      if (!isBookCopyStatus(value)) return;
                      void handleStatusChange(copy.id, value);
                    }}>
                      <SelectTrigger className="h-7 rounded-md border border-border bg-muted px-2.5 text-[11px] font-medium text-muted-foreground">
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
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
              <span>
                Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, visibleCopies.length)} of {visibleCopies.length}
              </span>
              <div className="flex items-center gap-1.5">
                <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                  <SelectTrigger className="h-7 w-[72px] rounded-md border-border bg-card px-2 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / page</SelectItem>
                    <SelectItem value="20">20 / page</SelectItem>
                    <SelectItem value="30">30 / page</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-md px-2 text-[11px]"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Prev
                </Button>
                <span className="min-w-12 text-center text-[11px] font-medium text-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-md px-2 text-[11px]"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
