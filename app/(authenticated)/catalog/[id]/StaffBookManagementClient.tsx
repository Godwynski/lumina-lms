'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  getBookCopies,
  updateBookCopyStatus,
  updateBook,
  softDeleteBook,
  staffCancelReservation,
  getBookReservationQueue,
} from '@/lib/actions/catalog';
import {
  MapPin,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Wrench,
  SearchX,
  History,
  Filter,
  Edit3,
  Save,
  Loader2,
  Clock,
  UserCircle2,
  XCircle,
  Users,
  ArrowRight,
  CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { CompactPagination } from '@/components/ui/compact-pagination';
import { QRPrinterModal } from '@/components/qr-printer-modal';
import { AdminTableShell } from '@/components/admin/AdminTableShell';
import { FieldGroup } from '@/components/settings/SettingsShared';
import { cn } from '@/lib/utils';
import type { Book, BookCopyWithReservation } from '@/lib/types';

// ─── Config ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  AVAILABLE:   { label: 'Available',   icon: CheckCircle2, color: 'text-green-600',  bg: 'bg-green-50  dark:bg-green-950/30'  },
  BORROWED:    { label: 'Borrowed',    icon: History,      color: 'text-blue-600',   bg: 'bg-blue-50   dark:bg-blue-950/30'   },
  MAINTENANCE: { label: 'Maintenance', icon: Wrench,       color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  LOST:        { label: 'Lost',        icon: SearchX,      color: 'text-red-600',    bg: 'bg-red-50    dark:bg-red-950/30'    },
  RESERVED:    { label: 'Reserved',    icon: Clock,        color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30' },
} as const;

const EDITABLE_STATUSES = ['AVAILABLE', 'BORROWED', 'MAINTENANCE', 'LOST'] as const;
type EditableStatus = typeof EDITABLE_STATUSES[number];

function isEditableStatus(v: string): v is EditableStatus {
  return (EDITABLE_STATUSES as readonly string[]).includes(v);
}
function isBookCopyStatus(v: string): v is BookCopyWithReservation['status'] {
  return ['AVAILABLE', 'BORROWED', 'MAINTENANCE', 'LOST', 'RESERVED'].includes(v);
}

// ─── Types ─────────────────────────────────────────────────────────────────

type ReservationQueueEntry = Awaited<ReturnType<typeof getBookReservationQueue>>[number];

interface StaffBookManagementClientProps {
  initialBook: Book;
  initialCopies: BookCopyWithReservation[];
  initialReservationQueue: ReservationQueueEntry[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatRelativeTime(dateStr: string | null, mounted: boolean): string {
  if (!dateStr || !mounted) return '...';
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h remaining`;
  return 'Less than 1h';
}

// ─── Queue Panel ───────────────────────────────────────────────────────────

function ReservationQueuePanel({
  queue,
  bookId,
  mounted,
  onCancelled,
}: {
  queue: ReservationQueueEntry[];
  bookId: string;
  mounted: boolean;
  onCancelled: (reservationId: string) => void;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  if (queue.length === 0) return null;

  const readyEntry = queue.find((r) => r.status === 'READY');
  const activeQueue = queue.filter((r) => r.status === 'ACTIVE');

  const handleCancel = async (entry: ReservationQueueEntry) => {
    setCancellingId(entry.id);
    try {
      const result = await staffCancelReservation({ reservationId: entry.id, bookId });
      if (!result.success) throw new Error(result.error);
      toast.success(`Reservation cancelled for ${(entry.profiles as { full_name?: string } | null)?.full_name ?? 'student'}`);
      onCancelled(entry.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setCancellingId(null);
    }
  };

  const reserver = (entry: ReservationQueueEntry) => {
    const p = entry.profiles;
    const profile = Array.isArray(p) ? p[0] : p;
    return profile as {
      id: string;
      full_name: string | null;
      email: string | null;
      student_id: string | null;
      avatar_url: string | null;
    } | null;
  };

  const copyInfo = (entry: ReservationQueueEntry) => {
    const bc = entry.book_copies;
    const copy = Array.isArray(bc) ? bc[0] : bc;
    return copy as { qr_string: string } | null;
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden transition-all hover:shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-foreground">Reservation Queue</span>
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
            {queue.length}
          </span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {/* ── READY entry: the current hold ── */}
        {readyEntry && (() => {
          const r = reserver(readyEntry);
          const copy = copyInfo(readyEntry);
          const isCancelling = cancellingId === readyEntry.id;
          return (
            <div className="px-3 py-2.5 bg-violet-50/60 dark:bg-violet-950/20">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span className="rounded-full bg-violet-100 dark:bg-violet-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">
                  🔒 Hold Active
                </span>
                {copy && (
                  <span className="text-[10px] text-muted-foreground">
                    Copy: <span className="font-mono font-semibold">{copy.qr_string}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Avatar */}
                  <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-violet-200 dark:border-violet-800 bg-violet-100 dark:bg-violet-900">
                    {r?.avatar_url ? (
                      <Image src={r.avatar_url} alt="" fill className="object-cover" unoptimized />
                    ) : (
                      <UserCircle2 className="h-full w-full p-1 text-violet-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {r?.full_name ?? 'Unknown Student'}
                      </span>
                      {r?.student_id && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground font-mono">
                          {r.student_id}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {r?.email && (
                        <span className="text-[10px] text-muted-foreground">{r.email}</span>
                      )}
                      {readyEntry.hold_expires_at && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                          <CalendarClock className="h-3 w-3" />
                          {formatRelativeTime(readyEntry.hold_expires_at, mounted)}
                          <span className="text-muted-foreground font-normal">
                            ({mounted ? new Date(readyEntry.hold_expires_at).toLocaleDateString() : '...'})
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isCancelling}
                  onClick={() => handleCancel(readyEntry)}
                  className="h-7 shrink-0 rounded-md border border-red-200 bg-white dark:bg-transparent dark:border-red-800 px-2.5 text-[10px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-300"
                >
                  {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <><XCircle className="mr-1 h-3 w-3" />Cancel Hold</>}
                </Button>
              </div>
            </div>
          );
        })()}

        {/* ── ACTIVE queue entries ── */}
        {activeQueue.length > 0 && (
          <div className="px-3 pb-1 pt-2">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Waiting Queue
            </p>
            <div className="space-y-1">
              {activeQueue.map((entry, idx) => {
                const r = reserver(entry);
                const isCancelling = cancellingId === entry.id;
                const isNext = !readyEntry && idx === 0;
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 ${
                      isNext ? 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Queue badge */}
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                        isNext
                          ? 'bg-blue-500 text-white'
                          : 'bg-muted-foreground/20 text-muted-foreground'
                      }`}>
                        {entry.queue_position}
                      </div>
                      {/* Avatar */}
                      <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                        {r?.avatar_url ? (
                          <Image src={r.avatar_url} alt="" fill className="object-cover" unoptimized />
                        ) : (
                          <UserCircle2 className="h-full w-full p-0.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-foreground truncate">
                            {r?.full_name ?? 'Unknown'}
                          </span>
                          {r?.student_id && (
                            <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-mono text-muted-foreground">
                              {r.student_id}
                            </span>
                          )}
                          {isNext && (
                            <span className="flex items-center gap-0.5 rounded-full bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-300">
                              <ArrowRight className="h-2.5 w-2.5" />Next
                            </span>
                          )}
                        </div>
                        {r?.email && (
                          <p className="text-[10px] text-muted-foreground truncate">{r.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {entry.reserved_at && (
                        <span className="hidden sm:block text-[10px] text-muted-foreground" suppressHydrationWarning>
                          Reserved {mounted ? new Date(entry.reserved_at).toLocaleDateString() : '...'}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isCancelling}
                        onClick={() => handleCancel(entry)}
                        className="h-6 w-6 p-0 rounded-md border border-transparent text-muted-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                      >
                        {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer hint */}
        {activeQueue.length > 0 && (
          <div className="px-3 py-1.5 bg-muted/30">
            <p className="text-[10px] text-muted-foreground">
              When the current hold expires or is cancelled, position #1 will be automatically promoted.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export function StaffBookManagementClient({
  initialBook,
  initialCopies,
  initialReservationQueue,
}: StaffBookManagementClientProps) {
  const router = useRouter();
  const [book, setBook] = useState<Book>(initialBook);
  const [copies, setCopies] = useState<BookCopyWithReservation[]>(initialCopies);
  const [reservationQueue, setReservationQueue] = useState<ReservationQueueEntry[]>(initialReservationQueue);


  const [updateLoading, setUpdateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cancellingResId, setCancellingResId] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: initialBook.title,
    author: initialBook.author,
    isbn: initialBook.isbn || '',
    section: initialBook.section || '',
    location: initialBook.location || '',
  });

  const [copyFilter, setCopyFilter] = useState<'ALL' | BookCopyWithReservation['status']>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const refreshAll = async () => {
    const [updatedCopies, updatedQueue] = await Promise.all([
      getBookCopies(initialBook.id),
      getBookReservationQueue(initialBook.id),
    ]);
    setCopies(updatedCopies as BookCopyWithReservation[]);
    setReservationQueue(updatedQueue);
    return updatedCopies as BookCopyWithReservation[];
  };



  const handleUpdateBook = async () => {
    setUpdateLoading(true);
    try {
      const result = await updateBook({ id: book.id, bookData: editForm });
      if (!result.success) throw new Error(result.error);
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
      const result = await softDeleteBook(book.id);
      if (!result.success) throw new Error(result.error);
      toast.success('Book removed from inventory');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete book');
      setShowDeleteConfirm(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleStatusChange = async (copyId: string, newStatus: EditableStatus) => {
    try {
      const result = await updateBookCopyStatus({ id: copyId, status: newStatus });
      if (!result.success) throw new Error(result.error);
      const updatedCopies = await refreshAll();
      setBook(prev => ({
        ...prev,
        available_copies: updatedCopies.filter(c => c.status === 'AVAILABLE').length,
      }));
      toast.success('Copy status updated');
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status');
    }
  };

  const handleCancelReservationFromCopy = async (reservationId: string, _copyId: string) => {
    setCancellingResId(reservationId);
    try {
      const result = await staffCancelReservation({ reservationId, bookId: book.id });
      if (!result.success) throw new Error(result.error);
      const updatedCopies = await refreshAll();
      setBook(prev => ({
        ...prev,
        available_copies: updatedCopies.filter(c => c.status === 'AVAILABLE').length,
      }));
      toast.success('Reservation cancelled — copy released');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel reservation');
    } finally {
      setCancellingResId(null);
    }
  };

  // Called when queue panel cancels a reservation
  const handleQueueCancelled = async (_reservationId: string) => {
    const updatedCopies = await refreshAll();
    setBook(prev => ({
      ...prev,
      available_copies: updatedCopies.filter(c => c.status === 'AVAILABLE').length,
    }));
  };

  const visibleCopies = copies.filter(c => copyFilter === 'ALL' || c.status === copyFilter);
  const totalPages = Math.max(1, Math.ceil(visibleCopies.length / pageSize));
  const pagedCopies = visibleCopies.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [copyFilter, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  return (
    <AdminTableShell
      title={book.title}
      description={book.author}
      variant="default"
      className="pb-6 md:pb-8"
      headerActions={
        <div className="flex items-center gap-2">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2">
              <span className="text-[10px] font-bold text-destructive uppercase mr-1">Confirm?</span>
              <Button variant="destructive" size="sm" onClick={handleDeleteBook} disabled={deleteLoading} className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider">
                {deleteLoading ? <Loader2 className="animate-spin h-3 w-3" /> : 'Purge'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)} className="h-8 px-2 text-[10px] font-bold uppercase tracking-wider">Cancel</Button>
            </div>
          ) : (
            <>
              {isEditing ? (
                 <Button variant="outline" onClick={() => setIsEditing(false)} className="h-8 rounded-md px-3 text-xs font-semibold">
                   Cancel Edit
                 </Button>
              ) : (
                 <Button variant="outline" onClick={() => setIsEditing(true)} className="h-8 rounded-md px-3 text-xs font-semibold">
                   <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Edit Asset
                 </Button>
              )}
            </>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-6 p-4 md:p-6">
        
        {/* --- Edit Form --- */}
        {isEditing ? (
          <div className="rounded-xl border border-border/50 bg-muted/20 p-5 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Edit Metadata</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldGroup label="Asset Title">
                <Input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="h-9 bg-background" />
              </FieldGroup>
              <FieldGroup label="Primary Author">
                <Input value={editForm.author} onChange={e => setEditForm({ ...editForm, author: e.target.value })} className="h-9 bg-background" />
              </FieldGroup>
              <FieldGroup label="ISBN">
                <Input value={editForm.isbn} onChange={e => setEditForm({ ...editForm, isbn: e.target.value })} className="h-9 bg-background" />
              </FieldGroup>
              <FieldGroup label="Category">
                <Input value={editForm.section} onChange={e => setEditForm({ ...editForm, section: e.target.value })} className="h-9 bg-background" />
              </FieldGroup>
              <FieldGroup label="Precise Location">
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className="h-9 pl-8 bg-background" />
                </div>
              </FieldGroup>
            </div>
            <div className="mt-5 flex justify-end gap-2">
               <Button onClick={() => setShowDeleteConfirm(true)} variant="ghost" className="h-9 text-red-600 hover:text-red-700 hover:bg-red-50">Delete Asset</Button>
               <Button onClick={handleUpdateBook} disabled={updateLoading} className="h-9 font-semibold">
                 {updateLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                 Save Changes
               </Button>
            </div>
          </div>
        ) : (
          /* --- View Metadata --- */
          <div className="flex flex-col lg:flex-row gap-6 border-b border-border/40 pb-6">
            <div className="flex flex-1 gap-5">
              <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-lg border border-border shadow-sm">
                {book.cover_url
                  ? <Image src={book.cover_url} alt={book.title} fill className="object-cover" unoptimized />
                  : <BookOpen className="h-full w-full p-6 text-muted-foreground bg-muted/40" />}
              </div>
              <div className="flex flex-col justify-center gap-3">
                <div className="flex flex-wrap gap-2">
                  <span className={cn(
                     "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                     book.available_copies > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  )}>
                     {book.available_copies > 0 ? "In Stock" : "Unavailable"}
                  </span>
                  {book.tags?.map((tag, i) => (
                     <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">{tag}</span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-muted-foreground uppercase">ISBN</span>
                     <span className="font-medium text-foreground">{book.isbn || 'N/A'}</span>
                   </div>
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-muted-foreground uppercase">Category</span>
                     <span className="font-medium text-foreground">{(Array.isArray(book.categories) ? book.categories[0]?.name : book.categories?.name) || 'Unassigned'}</span>
                   </div>
                   <div className="flex flex-col">
                     <span className="text-[10px] font-bold text-muted-foreground uppercase">Location</span>
                     <span className="font-medium text-foreground flex items-center gap-1"><MapPin size={12}/>{book.location || book.section || 'N/A'}</span>
                   </div>
                </div>
              </div>
            </div>
            
            {/* Inventory Overview */}
            <div className="flex items-center gap-4 lg:gap-6 px-5 py-4 bg-muted/30 rounded-xl border border-border/50 shrink-0">
               <div className="text-center">
                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total</p>
                 <p className="text-2xl font-black text-foreground">{book.total_copies}</p>
               </div>
               <div className="w-px h-8 bg-border"></div>
               <div className="text-center">
                 <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Avail</p>
                 <p className="text-2xl font-black text-primary">{book.available_copies}</p>
               </div>
               {reservationQueue.length > 0 && (
                 <>
                   <div className="w-px h-8 bg-border"></div>
                   <div className="text-center">
                     <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Waitlist</p>
                     <p className="text-2xl font-black text-violet-600">{reservationQueue.length}</p>
                   </div>
                 </>
               )}
            </div>
          </div>
        )}

        {/* --- Reservation Queue --- */}
        {reservationQueue.length > 0 && (
          <div className="pt-2 max-w-3xl">
             <ReservationQueuePanel queue={reservationQueue} bookId={book.id} mounted={mounted} onCancelled={handleQueueCancelled} />
          </div>
        )}

        {/* --- Copies List --- */}
        <div className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">Copies ({visibleCopies.length}/{copies.length})</h2>
            <div className="inline-flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={copyFilter} onValueChange={(v) => {
                if (v === 'ALL' || isBookCopyStatus(v)) setCopyFilter(v as 'ALL' | BookCopyWithReservation['status']);
              }}>
                <SelectTrigger className="h-8 w-[140px] text-xs bg-muted/30">
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

          <div className="space-y-2">
            {pagedCopies.map((copy) => {
              const statusCfg = STATUS_CONFIG[copy.status as keyof typeof STATUS_CONFIG] ?? {
                label: copy.status, icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted',
              };
              const StatusIcon = statusCfg.icon;
              const isReserved = copy.status === 'RESERVED';
              const res = copy.reservation;
              const reserver = res?.profiles as { full_name?: string | null; email?: string | null; student_id?: string | null; avatar_url?: string | null } | null;
              const isCancelling = cancellingResId === res?.id;

              return (
                <div key={copy.id} className="flex flex-col justify-between gap-3 rounded-xl border border-border/50 bg-card p-3 shadow-sm transition-all hover:border-border/80 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 shrink-0 rounded-lg ${statusCfg.bg} flex items-center justify-center`}>
                      <StatusIcon className={`h-5 w-5 ${statusCfg.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">{copy.qr_string}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${statusCfg.bg} ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5" suppressHydrationWarning>
                        Added {mounted ? new Date(copy.created_at).toLocaleDateString() : '...'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {isReserved && res ? (
                      <div className="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <UserCircle2 className="h-4 w-4 text-violet-500 shrink-0" />
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-violet-700">
                              {reserver?.full_name ?? 'Unknown Student'}
                            </span>
                            {res.hold_expires_at && (
                              <span className="text-[10px] text-amber-600 font-medium">
                                {formatRelativeTime(res.hold_expires_at, mounted)}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isCancelling}
                          onClick={() => handleCancelReservationFromCopy(res.id, copy.id)}
                          className="ml-2 h-7 rounded-md bg-white px-2 text-[10px] font-semibold text-red-600 hover:bg-red-50 border border-red-100"
                        >
                          {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cancel Hold'}
                        </Button>
                      </div>
                    ) : (
                      <Select value={copy.status} onValueChange={(v) => {
                        if (isEditableStatus(v)) void handleStatusChange(copy.id, v);
                      }}>
                        <SelectTrigger className="h-8 w-[130px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EDITABLE_STATUSES.map((key) => (
                            <SelectItem key={key} value={key}>{STATUS_CONFIG[key].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <QRPrinterModal qrString={copy.qr_string} bookTitle={book.title} />
                  </div>
                </div>
              );
            })}

            {visibleCopies.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 py-12 text-center">
                <AlertCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
                <p className="text-sm font-medium text-muted-foreground">No copies match this filter.</p>
              </div>
            )}
          </div>

          {visibleCopies.length > 0 && (
            <div className="pt-4">
              <CompactPagination
                page={page}
                totalItems={visibleCopies.length}
                pageSize={pageSize}
                onPageChange={setPage}
                pageSizeOptions={[10, 20, 30]}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </div>

      </div>
    </AdminTableShell>
  );
}
