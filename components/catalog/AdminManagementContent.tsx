'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  updateBookCopyStatus,
  updateBook,
  softDeleteBook,
  getBookAdminDetails,
} from '@/lib/actions/catalog';
import {
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Wrench,
  SearchX,
  History,
  Edit3,
  Save,
  Loader2,
  Clock,
  UserCircle2,
  Users,
  Archive,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { QRPrinterModal } from '@/components/qr-printer-modal';
import { FieldGroup } from '@/components/settings/SettingsShared';
import { cn } from '@/lib/utils';
import type { Book, BookCopyWithReservation } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

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

type ReservationQueueEntry = Awaited<ReturnType<typeof getBookAdminDetails>>['queue'][number];

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

// ─── Queue Panel (Simplified for Modal) ────────────────────────────────────

function ReservationQueuePanel({
  queue,
  mounted,
}: {
  queue: ReservationQueueEntry[];
  mounted: boolean;
}) {
  if (!queue || queue.length === 0) return null;

  const reserver = (entry: ReservationQueueEntry) => {
    const p = entry.profiles;
    const profile = Array.isArray(p) ? p[0] : p;
    return profile as {
      full_name: string | null;
      student_id: string | null;
      avatar_url: string | null;
    } | null;
  };

  return (
    <div className="rounded-xl border border-border/40 bg-background/30 overflow-hidden flex flex-col h-full">
      <div className="bg-muted/30 px-3 py-2 border-b border-border/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Users size={12} className="text-indigo-500" />
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/70">Waitlist</span>
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px] bg-indigo-500/10 text-indigo-600 border-none">
            {queue.length}
          </Badge>
        </div>
      </div>
      <div className="divide-y divide-border/40 overflow-y-auto custom-scrollbar flex-1 max-h-[160px]">
        {queue.map((entry) => {
          const r = reserver(entry);
          return (
            <div key={entry.id} className="px-3 py-2.5 flex items-center justify-between gap-3 bg-background/20">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-border/40">
                  {r?.avatar_url ? (
                    <Image src={r.avatar_url} alt="" fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-indigo-50 dark:bg-indigo-900/40">
                      <UserCircle2 size={12} className="text-indigo-400" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold truncate leading-none mb-1">{r?.full_name ?? 'Unknown'}</p>
                  <p className="text-[9px] font-medium text-muted-foreground/60 uppercase tracking-tighter">Pos: {entry.queue_position}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-widest",
                  entry.status === 'READY' ? "text-emerald-600" : "text-indigo-600/60"
                )}>
                  {entry.status === 'READY' ? 'Ready' : 'Wait'}
                </span>
                {entry.hold_expires_at && entry.status === 'READY' && (
                  <p className="text-[8px] font-bold text-amber-600 mt-0.5">{formatRelativeTime(entry.hold_expires_at, mounted)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Admin Management Content ─────────────────────────────────────────

interface AdminManagementContentProps {
  initialBook: Book;
  initialCopies?: BookCopyWithReservation[];
  initialQueue?: ReservationQueueEntry[];
  onClose: () => void;
  onRefresh?: () => void;
  canManage?: boolean;
}

export function AdminManagementContent({
  initialBook,
  initialCopies,
  initialQueue,
  onClose,
  onRefresh: _onRefresh,
  canManage = true,
}: AdminManagementContentProps) {
  const router = useRouter();
  const [book, setBook] = useState<Book>(initialBook);
  const [copies, setCopies] = useState<BookCopyWithReservation[]>(initialCopies || []);
  const [reservationQueue, setReservationQueue] = useState<ReservationQueueEntry[]>(initialQueue || []);
  const [loading, setLoading] = useState(!initialCopies);
  
  const [isEditing, setIsEditing] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [copyFilter, setCopyFilter] = useState<'ALL' | BookCopyWithReservation['status']>('ALL');

  const [editForm, setEditForm] = useState({
    title: initialBook.title,
    author: initialBook.author,
    isbn: initialBook.isbn || '',
    section: initialBook.section || '',
    location: initialBook.location || '',
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const fetchData = useCallback(async () => {
    try {
      const { copies: updatedCopies, queue: updatedQueue } = await getBookAdminDetails(initialBook.id);
      setCopies(updatedCopies);
      setReservationQueue(updatedQueue);
    } catch (err) {
      console.error('Failed to fetch admin book details', err);
    } finally {
      setLoading(false);
    }
  }, [initialBook.id]);

  useEffect(() => {
    if (!initialCopies) {
      fetchData();
    }
  }, [initialBook.id, initialCopies, fetchData]);

  const handleUpdateBook = async () => {
    setUpdateLoading(true);
    try {
      const result = await updateBook({ id: book.id, bookData: editForm });
      if (!result.success) throw new Error(result.error);
      setBook(prev => ({ ...prev, ...editForm }));
      setIsEditing(false);
      toast.success('Metadata updated');
      router.refresh();
    } catch {
      toast.error('Update failed');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDeleteBook = async () => {
    setDeleteLoading(true);
    try {
      const result = await softDeleteBook(book.id);
      if (!result.success) throw new Error(result.error);
      toast.success('Book archived');
      onClose();
      router.refresh();
    } catch {
      toast.error('Archive failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleStatusChange = async (copyId: string, newStatus: EditableStatus) => {
    try {
      const result = await updateBookCopyStatus({ id: copyId, status: newStatus });
      if (!result.success) throw new Error(result.error);
      await fetchData();
      toast.success('Status updated');
    } catch {
      toast.error('Status update failed');
    }
  };

  const categoryName = Array.isArray(book.categories)
    ? book.categories[0]?.name
    : book.categories?.name;

  const filteredCopies = copies.filter(c => copyFilter === 'ALL' || c.status === copyFilter);
  const isAvailable = book.available_copies > 0;

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      {!isEditing && (
        <div className="flex gap-4 pr-8">
          <div className="relative h-32 w-20 shrink-0 overflow-hidden rounded-xl border border-border/40 shadow-sm ring-1 ring-border/50">
            {book.cover_url ? (
              <Image src={book.cover_url} alt={book.title} fill className="object-cover" unoptimized />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted/40">
                <BookOpen className="h-6 w-6 text-muted-foreground/40" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
               <span className={cn(
                 "rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] shadow-sm",
                 isAvailable
                   ? "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20"
                   : "bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20"
               )}>
                 {isAvailable ? "● In Stock" : "○ Depleted"}
               </span>
            </div>
            <h2 className="text-lg font-black tracking-tight text-foreground leading-tight line-clamp-1">{book.title}</h2>
            <p className="text-sm font-medium text-muted-foreground/70 mb-3">{book.author}</p>
            
            <div className="flex flex-wrap gap-2">
               <Badge variant="outline" className="text-[9px] font-bold uppercase py-0 border-primary/20 bg-primary/5 text-primary">
                 {categoryName || 'General'}
               </Badge>
               <Badge variant="outline" className="text-[9px] font-bold uppercase py-0">
                 ISBN: {book.isbn || 'REF'}
               </Badge>
            </div>
          </div>
          {canManage && (
            <div className="flex flex-col gap-1 self-start">
               <Button 
                 variant="outline" 
                 size="sm" 
                 onClick={() => setIsEditing(true)}
                 className="h-8 rounded-lg px-3 text-[10px] font-black uppercase tracking-wider"
               >
                 <Edit3 size={12} className="mr-1.5" /> Edit
               </Button>
            </div>
          )}
        </div>
      )}

      {/* Edit Form */}
      {isEditing && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 animate-in fade-in slide-in-from-top-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-primary">Edit Metadata</h3>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="h-6 px-2 text-[10px] font-bold uppercase">Cancel</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldGroup label="Title">
              <Input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} className="h-9 rounded-xl text-xs" />
            </FieldGroup>
            <FieldGroup label="Author">
              <Input value={editForm.author} onChange={e => setEditForm({ ...editForm, author: e.target.value })} className="h-9 rounded-xl text-xs" />
            </FieldGroup>
            <FieldGroup label="ISBN">
              <Input value={editForm.isbn} onChange={e => setEditForm({ ...editForm, isbn: e.target.value })} className="h-9 rounded-xl text-xs" />
            </FieldGroup>
            <FieldGroup label="Location">
              <Input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} className="h-9 rounded-xl text-xs" />
            </FieldGroup>
            <FieldGroup label="Section">
              <Input value={editForm.section} onChange={e => setEditForm({ ...editForm, section: e.target.value })} className="h-9 rounded-xl text-xs" />
            </FieldGroup>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-primary/10 pt-4">
             {showDeleteConfirm ? (
               <div className="flex items-center gap-2">
                 <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Archive?</span>
                 <Button onClick={handleDeleteBook} disabled={deleteLoading} variant="destructive" size="sm" className="h-8 text-[10px] font-black uppercase">
                   Confirm
                 </Button>
                 <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)} className="h-8 text-[10px] font-bold uppercase">No</Button>
               </div>
             ) : (
               <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(true)} className="h-8 px-0 text-rose-600 hover:text-rose-700 hover:bg-transparent text-[10px] font-black uppercase">
                 <Archive size={12} className="mr-1.5" /> Archive Asset
               </Button>
             )}
             <Button onClick={handleUpdateBook} disabled={updateLoading} size="sm" className="h-8 rounded-lg px-4 text-[10px] font-black uppercase tracking-widest">
               {updateLoading ? <Loader2 className="animate-spin h-3 w-3 mr-1.5" /> : <Save size={12} className="mr-1.5" />}
               Save Changes
             </Button>
          </div>
        </div>
      )}

      {/* Stats & Queue */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
         <div className="rounded-xl border border-border/40 bg-muted/10 p-3 flex items-center justify-around">
            <div className="text-center">
              <p className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest mb-0.5">Total</p>
              <p className="text-lg font-black text-foreground">{book.total_copies ?? 0}</p>
            </div>
            <div className="w-px h-6 bg-border/40" />
            <div className="text-center">
              <p className="text-[9px] font-black text-emerald-600/50 uppercase tracking-widest mb-0.5">Avail</p>
              <p className="text-lg font-black text-emerald-600">{book.available_copies ?? 0}</p>
            </div>
            {reservationQueue.length > 0 && (
              <>
                <div className="w-px h-6 bg-border/40" />
                <div className="text-center">
                  <p className="text-[9px] font-black text-indigo-600/50 uppercase tracking-widest mb-0.5">Queue</p>
                  <p className="text-lg font-black text-indigo-600">{reservationQueue.length}</p>
                </div>
              </>
            )}
         </div>
         <ReservationQueuePanel queue={reservationQueue} mounted={mounted} />
      </div>

      {/* Inventory List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center">
              <Layers size={12} className="text-primary" />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/80">Inventory Assets</h3>
          </div>
          <Select value={copyFilter} onValueChange={(v) => {
            if (v === 'ALL' || isBookCopyStatus(v)) setCopyFilter(v as 'ALL' | BookCopyWithReservation['status']);
          }}>
            <SelectTrigger className="h-7 w-[110px] rounded-lg border-border/40 bg-muted/20 px-2 text-[9px] font-bold uppercase shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-[9px] font-bold uppercase">All</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key} className="text-[9px] font-bold uppercase">{cfg.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary/20" />
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">Loading Inventory...</p>
            </div>
          ) : filteredCopies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-border/40 bg-muted/5">
              <p className="text-[9px] font-bold uppercase text-muted-foreground/40">No assets found</p>
            </div>
          ) : filteredCopies.map((copy) => {
            const statusCfg = STATUS_CONFIG[copy.status as keyof typeof STATUS_CONFIG] ?? {
              label: copy.status, icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border'
            };
            const StatusIcon = statusCfg.icon;
            const res = copy.reservation;
            const r = res?.profiles as { full_name?: string | null; avatar_url?: string | null } | null;

            return (
              <div key={copy.id} className="group relative flex flex-col gap-2 rounded-xl border border-border/40 bg-card/30 p-2.5 transition-all hover:border-primary/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("h-8 w-8 shrink-0 rounded-lg border flex items-center justify-center", statusCfg.bg, statusCfg.border)}>
                      <StatusIcon size={14} className={statusCfg.color} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] font-black text-foreground truncate">{copy.qr_string}</p>
                      <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground/60 uppercase">
                        <span className={statusCfg.color}>{statusCfg.label}</span>
                        <span className="opacity-30">•</span>
                        <span>{copy.id.split('-')[0]}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canManage ? (
                      <Select value={copy.status} onValueChange={(v) => {
                        if (isEditableStatus(v)) handleStatusChange(copy.id, v);
                      }}>
                        <SelectTrigger className="h-7 w-[90px] rounded-lg border-border/40 bg-muted/20 px-2 text-[9px] font-black uppercase shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EDITABLE_STATUSES.map((key) => (
                            <SelectItem key={key} value={key} className="text-[9px] font-black uppercase">
                              {STATUS_CONFIG[key].label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className="h-7 px-2 text-[9px] font-black uppercase">
                        {statusCfg.label}
                      </Badge>
                    )}
                    <QRPrinterModal qrString={copy.qr_string} bookTitle={book.title} />
                  </div>
                </div>

                {/* Reserver Info inside copy card */}
                {copy.status === 'RESERVED' && r && (
                  <div className="flex items-center gap-2 bg-indigo-500/5 rounded-lg border border-indigo-500/10 p-1.5 animate-in fade-in slide-in-from-left-1">
                    <div className="relative h-5 w-5 shrink-0 overflow-hidden rounded-full border border-background ring-1 ring-indigo-500/20">
                       {r.avatar_url ? (
                         <Image src={r.avatar_url} alt="" fill className="object-cover" unoptimized />
                       ) : (
                         <UserCircle2 size={12} className="h-full w-full p-0.5 text-indigo-400" />
                       )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase truncate">
                        Reserved by {r.full_name ?? 'Unknown'}
                      </p>
                      {res?.hold_expires_at && (
                        <p className="text-[8px] font-bold text-amber-600 uppercase tracking-tighter">
                          Exp: {formatRelativeTime(res.hold_expires_at, mounted)}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredCopies.length === 0 && (
            <div className="py-10 text-center rounded-xl border border-dashed border-border/40">
              <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">No assets matching filter</p>
            </div>
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-border/20">
        <Button 
          variant="link" 
          onClick={() => {
            onClose();
            router.push(`/catalog/${book.id}`);
          }}
          className="h-auto p-0 text-[10px] font-bold text-primary/70 hover:text-primary uppercase tracking-[0.2em]"
        >
          Detailed Analytics View →
        </Button>
      </div>
    </div>
  );
}
