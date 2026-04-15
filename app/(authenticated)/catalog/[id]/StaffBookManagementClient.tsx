'use client';

import { useState, useEffect, useTransition } from 'react';
import Image from 'next/image';
import {
  getBookCopies,
  createBookCopy,
  updateBookCopyStatus,
  updateBook,
  softDeleteBook,
  staffCancelReservation,
  getBookReservationQueue,
} from '@/lib/actions/catalog';
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
  Clock,
  UserCircle2,
  BadgeCheck,
  XCircle,
  Users,
  ArrowRight,
  CalendarClock,
  BookMarked,
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
      await staffCancelReservation(entry.id, bookId);
      toast.success(`Reservation cancelled for ${(entry.profiles as { full_name?: string } | null)?.full_name ?? 'student'}`);
      onCancelled(entry.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setCancellingId(null);
    }
  };

  const reserver = (entry: ReservationQueueEntry) =>
    entry.profiles as {
      id: string;
      full_name: string | null;
      email: string | null;
      student_id: string | null;
      avatar_url: string | null;
    } | null;

  const copyInfo = (entry: ReservationQueueEntry) =>
    entry.book_copies as { qr_string: string } | null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
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

  const [addCopyLoading, setAddCopyLoading] = useState(false);
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
  const [, startTransition] = useTransition();

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

  const handleAddCopy = async () => {
    setAddCopyLoading(true);
    try {
      await createBookCopy(initialBook.id, 'New Condition');
      const updatedCopies = await refreshAll();
      setBook(prev => ({
        ...prev,
        total_copies: (prev.total_copies || 0) + 1,
        available_copies: (prev.available_copies || 0) + 1,
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

  const handleStatusChange = async (copyId: string, newStatus: EditableStatus) => {
    try {
      await updateBookCopyStatus(copyId, newStatus);
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

  const handleCancelReservationFromCopy = async (reservationId: string, copyId: string) => {
    setCancellingResId(reservationId);
    try {
      await staffCancelReservation(reservationId, book.id);
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
    <div className="w-full space-y-4 pb-6 md:pb-8">
      {/* ── Header ── */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon" className="h-11 w-11 md:h-8 md:w-8 rounded-md hover:bg-muted">
            <Link href="/catalog"><ChevronLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="hidden md:block">
            <h1 className="text-lg font-semibold text-foreground">{book.title}</h1>
            <p className="text-xs text-muted-foreground">{book.author} · ID: {book.id.slice(0, 8)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2">
              <span className="text-[10px] font-bold text-destructive uppercase mr-1">Confirm removal?</span>
              <Button variant="destructive" size="sm" onClick={handleDeleteBook} disabled={deleteLoading} className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider">
                {deleteLoading ? <Loader2 className="animate-spin h-3 w-3" /> : 'Yes, Purge'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)} className="h-8 px-2 text-[10px] font-bold uppercase tracking-wider">Cancel</Button>
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setIsEditing(!isEditing)}
                className={`h-8 rounded-md px-3 text-xs font-semibold ${isEditing ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : ''}`}
              >
                {isEditing ? <X className="mr-1.5 h-3.5 w-3.5" /> : <Edit3 className="mr-1.5 h-3.5 w-3.5" />}
                {isEditing ? 'Cancel Edit' : 'Modify Records'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(true)}
                className="h-8 border-destructive/20 text-destructive hover:bg-destructive/5 hover:border-destructive/40 rounded-md px-3 text-xs font-semibold"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />Purge from Vault
              </Button>
              <div className="mx-1 h-4 w-[1px] bg-border" />
              <Button onClick={handleAddCopy} disabled={addCopyLoading} className="h-8 rounded-md px-3 text-xs font-semibold">
                <Plus className="mr-1.5 h-3.5 w-3.5" />Add Copy
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
        {/* ── Sidebar ── */}
        <div className="space-y-3 lg:col-span-4 xl:col-span-3">
          {/* Book info card */}
          <div className="overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm">
            {isEditing ? (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Asset Title</Label>
                    <Input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="h-9 text-xs border-primary/20 bg-primary/5" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Primary Author</Label>
                    <Input value={editForm.author} onChange={e => setEditForm({ ...editForm, author: e.target.value })} className="h-9 text-xs border-primary/20 bg-primary/5" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">ISBN</Label>
                      <Input value={editForm.isbn} onChange={e => setEditForm({ ...editForm, isbn: e.target.value })} className="h-9 text-xs bg-muted/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Classification</Label>
                      <Input value={editForm.section} onChange={e => setEditForm({ ...editForm, section: e.target.value })} className="h-9 text-xs bg-muted/50" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">Precise Location</Label>
                    <Input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className="h-9 text-xs bg-muted/50" />
                  </div>
                </div>
                <Button onClick={handleUpdateBook} disabled={updateLoading} className="w-full h-10 rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">
                  {updateLoading ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                  Save All Changes
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-start gap-3">
                  <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                    {book.cover_url
                      ? <Image src={book.cover_url} alt={book.title} fill className="object-cover" unoptimized />
                      : <BookOpen className="h-full w-full p-3 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold text-foreground">{book.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{book.author}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Hash className="h-3.5 w-3.5" /><span className="font-medium">ISBN:</span>{book.isbn || 'Unknown'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Tag className="h-3.5 w-3.5" /><span className="font-medium">Category:</span>
                    {Array.isArray(book.categories) ? book.categories[0]?.name : (book.categories as { name?: string })?.name || 'Unassigned'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /><span className="font-medium">Section:</span>{book.section || 'N/A'}
                  </div>
                </div>
                {book.tags && book.tags.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Tags</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {book.tags.map((tag, i) => (
                        <span key={i} className="rounded-md border border-border/50 bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Copy snapshot */}
          <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-foreground">
              <QrCode className="h-3.5 w-3.5" />Copy Snapshot
            </h3>
            <div className="space-y-1.5 rounded-lg border border-border bg-muted p-2.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground font-medium">Total:</span>
                <span className="text-foreground font-semibold">{book.total_copies}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground font-medium">Available:</span>
                <span className="text-foreground font-semibold">{book.available_copies}</span>
              </div>
              {reservationQueue.length > 0 && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground font-medium flex items-center gap-1">
                    <BookMarked className="h-3 w-3" />In Queue:
                  </span>
                  <span className="font-semibold text-violet-600">{reservationQueue.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Reservation Queue Panel */}
          {reservationQueue.length > 0 && (
            <ReservationQueuePanel
              queue={reservationQueue}
              bookId={book.id}
              mounted={mounted}
              onCancelled={handleQueueCancelled}
            />
          )}
        </div>

        {/* ── Inventory List ── */}
        <div className="space-y-2.5 lg:col-span-8 xl:col-span-9">
          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
            <h2 className="text-sm font-semibold text-foreground">Copies ({visibleCopies.length}/{copies.length})</h2>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card p-1.5 shadow-sm">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={copyFilter} onValueChange={(v) => {
                if (v === 'ALL' || isBookCopyStatus(v)) setCopyFilter(v as 'ALL' | BookCopyWithReservation['status']);
              }}>
                <SelectTrigger className="h-11 md:h-7 border-0 bg-transparent px-2 md:px-1 text-sm md:text-[11px] font-medium text-muted-foreground">
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
              const statusCfg = STATUS_CONFIG[copy.status as keyof typeof STATUS_CONFIG] ?? {
                label: copy.status, icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted',
              };
              const StatusIcon = statusCfg.icon;
              const isReserved = copy.status === 'RESERVED';
              const res = copy.reservation;
              const reserver = res?.profiles as { full_name?: string | null; email?: string | null; student_id?: string | null; avatar_url?: string | null } | null;
              const isCancelling = cancellingResId === res?.id;

              return (
                <div key={copy.id} className="flex flex-col justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm md:flex-row md:items-center">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 shrink-0 rounded-md ${statusCfg.bg} flex items-center justify-center`}>
                      <StatusIcon className={`h-4 w-4 ${statusCfg.color}`} />
                    </div>
                    <div>
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{copy.qr_string}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${statusCfg.bg} ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground" suppressHydrationWarning>
                        Added {mounted ? new Date(copy.created_at).toLocaleDateString() : '...'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {isReserved && res ? (
                      /* ── Reservation context for this copy ── */
                      <div className="flex items-center gap-2 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 px-2.5 py-1.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <UserCircle2 className="h-3 w-3 text-violet-500 shrink-0" />
                            <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                              {reserver?.full_name ?? 'Unknown Student'}
                            </span>
                            {reserver?.student_id && (
                              <span className="rounded bg-violet-100 dark:bg-violet-900 px-1.5 py-0.5 text-[9px] font-bold text-violet-600 dark:text-violet-400">
                                {reserver.student_id}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-violet-500 dark:text-violet-400 flex-wrap">
                            {reserver?.email && <span>{reserver.email}</span>}
                            {res.hold_expires_at && (
                              <>
                                <span className="opacity-40">·</span>
                                <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium">
                                  <CalendarClock className="h-2.5 w-2.5" />
                                  {formatRelativeTime(res.hold_expires_at, mounted)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isCancelling}
                          onClick={() => handleCancelReservationFromCopy(res.id, copy.id)}
                          className="ml-1 h-7 shrink-0 rounded-md border border-red-200 dark:border-red-800 bg-white dark:bg-transparent px-2 text-[10px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <><XCircle className="mr-1 h-3 w-3" />Cancel</>}
                        </Button>
                      </div>
                    ) : (
                      /* ── Editable status dropdown ── */
                      <Select value={copy.status} onValueChange={(v) => {
                        if (isEditableStatus(v)) void handleStatusChange(copy.id, v);
                      }}>
                        <SelectTrigger className="h-11 md:h-7 rounded-md border border-border bg-muted px-4 md:px-2.5 text-sm md:text-[11px] font-medium text-muted-foreground">
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
