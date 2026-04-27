'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  getBookCopies,
  updateBookCopyStatus,
  updateBook,
  softDeleteBook,
  getBookReservationQueue,
} from '@/lib/actions/catalog';
import {
  MapPin,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Trash2,
  SearchX,
  History,
  Filter,
  Edit3,
  Save,
  Loader2,
  Clock,
  UserCircle2,
  Users,
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
  AVAILABLE:   { label: 'Available',   icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400',  bg: 'bg-emerald-50/50 dark:bg-emerald-950/20', border: 'border-emerald-100 dark:border-emerald-900/30' },
  BORROWED:    { label: 'Borrowed',    icon: History,      color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50/50 dark:bg-blue-950/20',    border: 'border-blue-100 dark:border-blue-900/30'    },
  MAINTENANCE: { label: 'Maintenance', icon: Wrench,       color: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-50/50 dark:bg-amber-950/20',  border: 'border-amber-100 dark:border-amber-900/30'  },
  LOST:        { label: 'Lost',        icon: SearchX,      color: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-50/50 dark:bg-rose-950/20',    border: 'border-rose-100 dark:border-rose-900/30'    },
  RESERVED:    { label: 'Reserved',    icon: Clock,        color: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-50/50 dark:bg-indigo-950/20', border: 'border-indigo-100 dark:border-indigo-900/30' },
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
  bookId: _bookId,
  mounted,
}: {
  queue: ReservationQueueEntry[];
  bookId: string;
  mounted: boolean;
}) {
  if (queue.length === 0) return null;

  const readyEntry = queue.find((r) => r.status === 'READY');
  const activeQueue = queue.filter((r) => r.status === 'ACTIVE');

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
    <div className="overflow-hidden rounded-2xl border border-border/40 bg-background/50 shadow-sm backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Users size={12} />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/70">Reservation Queue</span>
          <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
            {queue.length}
          </span>
        </div>
      </div>

      <div className="divide-y divide-border/40">
        {/* ── READY entry: the current hold ── */}
        {readyEntry && (() => {
          const r = reserver(readyEntry);
          const copy = copyInfo(readyEntry);
          return (
            <div className="bg-indigo-50/30 dark:bg-indigo-950/10 px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-sm">
                  <Clock size={10} className="mr-0.5" /> Hold Active
                </span>
                {copy && (
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">
                    Copy <span className="font-mono text-foreground/80">{copy.qr_string}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border-2 border-background ring-1 ring-indigo-500/20 shadow-sm">
                    {r?.avatar_url ? (
                      <Image src={r.avatar_url} alt="" fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-indigo-50 dark:bg-indigo-900/40">
                        <UserCircle2 className="h-5 w-5 text-indigo-400" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">
                        {r?.full_name ?? 'Unknown Student'}
                      </span>
                      {r?.student_id && (
                        <span className="rounded-md bg-background/50 px-1.5 py-0.5 text-[10px] font-mono font-bold text-muted-foreground ring-1 ring-border/40">
                          {r.student_id}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {readyEntry.hold_expires_at && (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tighter">
                          <CalendarClock className="h-3 w-3" />
                          Expiring: {formatRelativeTime(readyEntry.hold_expires_at, mounted)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── ACTIVE queue entries ── */}
        {activeQueue.length > 0 && (
          <div className="px-4 py-3 space-y-2">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
              Waiting List
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {activeQueue.map((entry, idx) => {
                const r = reserver(entry);
                const isNext = !readyEntry && idx === 0;
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl border p-2.5 transition-all shadow-sm",
                      isNext 
                        ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200/50 dark:border-blue-800/30" 
                        : "bg-muted/30 border-border/20"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black",
                        isNext ? "bg-blue-500 text-white shadow-sm" : "bg-muted-foreground/10 text-muted-foreground/70"
                      )}>
                        {entry.queue_position}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className="truncate text-[11px] font-bold text-foreground">
                            {r?.full_name ?? 'Unknown'}
                          </span>
                          {isNext && (
                            <span className="shrink-0 rounded bg-blue-500/10 px-1 py-0.5 text-[8px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-tighter">
                              Next
                            </span>
                          )}
                        </div>
                        {entry.reserved_at && (
                          <p className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-tighter">
                            In queue since {mounted ? new Date(entry.reserved_at).toLocaleDateString() : '...'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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



  const visibleCopies = copies.filter(c => copyFilter === 'ALL' || c.status === copyFilter);
  const totalPages = Math.max(1, Math.ceil(visibleCopies.length / pageSize));
  const pagedCopies = visibleCopies.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [copyFilter, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  return (
    <AdminTableShell
      title="Asset Management"
      description={`Managing inventory for: ${book.title}`}
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
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-sm backdrop-blur-sm animate-in fade-in zoom-in-95 duration-300">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight text-foreground">Edit Metadata</h3>
                <p className="text-xs font-medium text-muted-foreground/70">Update the core information for this inventory asset.</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Edit3 size={20} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FieldGroup label="Asset Title">
                <Input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="h-10 rounded-xl border-border/40 bg-background/50 shadow-none focus:ring-1 focus:ring-primary/20" />
              </FieldGroup>
              <FieldGroup label="Primary Author">
                <Input value={editForm.author} onChange={e => setEditForm({ ...editForm, author: e.target.value })} className="h-10 rounded-xl border-border/40 bg-background/50 shadow-none focus:ring-1 focus:ring-primary/20" />
              </FieldGroup>
              <FieldGroup label="ISBN / Identifier">
                <Input value={editForm.isbn} onChange={e => setEditForm({ ...editForm, isbn: e.target.value })} className="h-10 rounded-xl border-border/40 bg-background/50 shadow-none focus:ring-1 focus:ring-primary/20" />
              </FieldGroup>
              <FieldGroup label="Category Section">
                <Input value={editForm.section} onChange={e => setEditForm({ ...editForm, section: e.target.value })} className="h-10 rounded-xl border-border/40 bg-background/50 shadow-none focus:ring-1 focus:ring-primary/20" />
              </FieldGroup>
              <FieldGroup label="Physical Location">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40" />
                  <Input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className="h-10 pl-10 rounded-xl border-border/40 bg-background/50 shadow-none focus:ring-1 focus:ring-primary/20" />
                </div>
              </FieldGroup>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-primary/10 pt-6">
               <Button onClick={() => setShowDeleteConfirm(true)} variant="ghost" className="h-10 rounded-xl px-5 text-xs font-black uppercase tracking-widest text-rose-600 hover:bg-rose-500/10 hover:text-rose-700">
                 <Trash2 className="mr-2 h-4 w-4" /> Purge Asset
               </Button>
               <div className="flex gap-3">
                 <Button variant="outline" onClick={() => setIsEditing(false)} className="h-10 rounded-xl px-6 text-xs font-black uppercase tracking-widest">
                   Cancel
                 </Button>
                 <Button onClick={handleUpdateBook} disabled={updateLoading} className="h-10 rounded-xl px-8 text-xs font-black uppercase tracking-widest shadow-lg shadow-primary/20">
                   {updateLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                   Sync Changes
                 </Button>
               </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 pb-2">
              <div className="relative h-40 w-28 shrink-0 overflow-hidden rounded-2xl border border-border/40 shadow-xl ring-1 ring-border/50">
                {book.cover_url
                  ? <Image src={book.cover_url} alt={book.title} fill className="object-cover" unoptimized />
                  : <div className="flex h-full w-full items-center justify-center bg-muted/40"><BookOpen className="h-10 w-10 text-muted-foreground/40" /></div>}
              </div>
              <div className="flex flex-1 flex-col justify-center min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={cn(
                     "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] shadow-sm",
                     book.available_copies > 0 
                       ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20" 
                       : "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20"
                  )}>
                     {book.available_copies > 0 ? "● In Stock" : "○ Depleted"}
                  </span>
                  {(Array.isArray(book.categories) ? book.categories[0]?.name : book.categories?.name) && (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-primary ring-1 ring-primary/20">
                      {(Array.isArray(book.categories) ? book.categories[0]?.name : book.categories?.name)}
                    </span>
                  )}
                </div>
                
                <h1 className="text-3xl font-black tracking-tighter text-foreground mb-1 truncate">{book.title}</h1>
                <p className="text-base font-medium text-muted-foreground/70 mb-5">{book.author}</p>

                <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                   <div className="flex flex-col gap-0.5">
                     <span className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Identifier</span>
                     <span className="text-xs font-bold font-mono text-foreground/80">{book.isbn || 'INTERNAL-REF'}</span>
                   </div>
                   <div className="flex flex-col gap-0.5">
                     <span className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-[0.2em]">Location</span>
                     <span className="text-xs font-bold text-foreground/80 flex items-center gap-1.5">
                        <MapPin size={12} className="text-primary/60"/>
                        {book.location || book.section || 'Unassigned'}
                     </span>
                   </div>
                </div>
              </div>

              {/* Minimalist Stats Panel */}
              <div className="flex items-center gap-2 p-1.5 bg-muted/20 rounded-2xl border border-border/40 backdrop-blur-sm self-start md:self-center">
                 <div className="flex flex-col items-center justify-center min-w-[70px] py-2 px-3">
                   <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest mb-1">Total</p>
                   <p className="text-xl font-black text-foreground leading-none">{book.total_copies}</p>
                 </div>
                 <div className="w-px h-8 bg-border/40"></div>
                 <div className="flex flex-col items-center justify-center min-w-[70px] py-2 px-3 rounded-xl bg-emerald-500/5 ring-1 ring-emerald-500/10">
                   <p className="text-[9px] font-black text-emerald-600/50 uppercase tracking-widest mb-1">Avail</p>
                   <p className="text-xl font-black text-emerald-600 leading-none">{book.available_copies}</p>
                 </div>
                 {reservationQueue.length > 0 && (
                   <>
                     <div className="w-px h-8 bg-border/40"></div>
                     <div className="flex flex-col items-center justify-center min-w-[70px] py-2 px-3 rounded-xl bg-indigo-500/5 ring-1 ring-indigo-500/10">
                       <p className="text-[9px] font-black text-indigo-600/50 uppercase tracking-widest mb-1">Queue</p>
                       <p className="text-xl font-black text-indigo-600 leading-none">{reservationQueue.length}</p>
                     </div>
                   </>
                 )}
              </div>
            </div>
          </div>
        )}

        {/* --- Reservation Queue --- */}
        {reservationQueue.length > 0 && (
          <div className="pt-2 max-w-3xl">
             <ReservationQueuePanel queue={reservationQueue} bookId={book.id} mounted={mounted} />
          </div>
        )}

        {/* --- Copies List --- */}
        <div className="space-y-5 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5 text-primary">
                <Filter size={16} />
              </div>
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground/80">Inventory Assets ({visibleCopies.length})</h2>
            </div>
            
            <Select value={copyFilter} onValueChange={(v) => {
              if (v === 'ALL' || isBookCopyStatus(v)) setCopyFilter(v as 'ALL' | BookCopyWithReservation['status']);
            }}>
              <SelectTrigger className="h-9 w-[160px] rounded-xl border-border/40 bg-muted/20 px-3 text-[11px] font-bold uppercase tracking-tight shadow-none focus:ring-0">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-[11px] font-bold uppercase">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key} className="text-[11px] font-bold uppercase">{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {pagedCopies.map((copy) => {
              const statusCfg = STATUS_CONFIG[copy.status as keyof typeof STATUS_CONFIG] ?? {
                label: copy.status, icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border'
              };
              const StatusIcon = statusCfg.icon;
              const isReserved = copy.status === 'RESERVED';
              const res = copy.reservation;
              const r = res?.profiles as { full_name?: string | null; email?: string | null; student_id?: string | null; avatar_url?: string | null } | null;

              return (
                <div key={copy.id} className="group relative flex flex-col items-start gap-4 rounded-2xl border border-border/40 bg-card p-4 transition-all hover:border-primary/20 hover:shadow-md sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-all duration-500",
                      statusCfg.bg,
                      statusCfg.border
                    )}>
                      <StatusIcon className={cn("h-6 w-6", statusCfg.color)} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm font-black text-foreground tracking-tight">{copy.qr_string}</span>
                        <span className={cn(
                          "rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] ring-1 ring-inset",
                          statusCfg.bg,
                          statusCfg.color,
                          statusCfg.border.replace('border-', 'ring-')
                        )}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tight">
                        <span>Added {mounted ? new Date(copy.created_at).toLocaleDateString() : '...'}</span>
                        <div className="h-1 w-1 rounded-full bg-border" />
                        <span>ID: {copy.id.split('-')[0]}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
                    {isReserved && res ? (
                      <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-500/5 px-3 py-2 dark:border-indigo-900/30">
                        <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-background shadow-sm ring-1 ring-indigo-500/20">
                          {r?.avatar_url ? (
                            <Image src={r.avatar_url} alt="" fill className="object-cover" unoptimized />
                          ) : (
                            <UserCircle2 className="h-full w-full p-1 text-indigo-400" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-tight">
                            {r?.full_name ?? 'Unknown'}
                          </span>
                          {res.hold_expires_at && (
                            <span className="text-[9px] font-bold text-amber-600 uppercase tracking-tighter">
                              {formatRelativeTime(res.hold_expires_at, mounted)}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <Select value={copy.status} onValueChange={(v) => {
                        if (isEditableStatus(v)) void handleStatusChange(copy.id, v);
                      }}>
                        <SelectTrigger className="h-9 w-[130px] rounded-xl border-border/40 bg-muted/10 text-[11px] font-bold uppercase tracking-tight shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EDITABLE_STATUSES.map((key) => (
                            <SelectItem key={key} value={key} className="text-[11px] font-bold uppercase">
                              {STATUS_CONFIG[key].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <div className="h-8 w-px bg-border/40" />
                    <QRPrinterModal qrString={copy.qr_string} bookTitle={book.title} />
                  </div>
                  
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0 w-1 bg-primary rounded-r-full opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:h-8" />
                </div>
              );
            })}

            {visibleCopies.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 py-16 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground/40">
                  <AlertCircle size={24} />
                </div>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No copies match filter</p>
              </div>
            )}
          </div>

          {visibleCopies.length > 0 && (
            <div className="pt-2">
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
