'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  updateBookCopyStatus,
  updateBook,
  softDeleteBook,
  restoreBook,
  getBookAdminDetails,
  addBookCopies,
} from '@/lib/actions/catalog';
import {
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
  Archive,
  RotateCw,
  Plus,
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
  AVAILABLE:   { label: 'Available',   icon: CheckCircle2, color: 'text-emerald-500',  bg: 'bg-emerald-500/5', border: 'border-emerald-500/10' },
  BORROWED:    { label: 'Borrowed',    icon: History,      color: 'text-blue-500',       bg: 'bg-blue-500/5',    border: 'border-blue-500/10'    },
  MAINTENANCE: { label: 'Maintenance', icon: Wrench,       color: 'text-amber-500',    bg: 'bg-amber-500/5',  border: 'border-amber-500/10'  },
  LOST:        { label: 'Lost',        icon: SearchX,      color: 'text-rose-500',       bg: 'bg-rose-500/5',    border: 'border-rose-500/10'    },
  RESERVED:    { label: 'Reserved',    icon: Clock,        color: 'text-indigo-500',   bg: 'bg-indigo-500/5', border: 'border-indigo-500/10' },
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
    <div className="rounded-xl border border-border/40 bg-muted/5 flex flex-col h-full transition-all">
      <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Queue</span>
          <Badge variant="secondary" className="h-4 px-1.5 text-[9px] bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/10 border-none">
            {queue.length}
          </Badge>
        </div>
      </div>
      <div className="divide-y divide-border/20 overflow-y-auto custom-scrollbar flex-1 max-h-[160px]">
        {queue.map((entry) => {
          const r = reserver(entry);
          return (
            <div key={entry.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-border/40">
                  {r?.avatar_url ? (
                    <Image src={r.avatar_url} alt="" fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted/40">
                      <UserCircle2 size={10} className="text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium truncate leading-tight text-foreground">{r?.full_name ?? 'Unknown'}</p>
                  <p className="text-[9px] text-muted-foreground/60">Position {entry.queue_position}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-wider",
                  entry.status === 'READY' ? "text-emerald-500" : "text-muted-foreground/40"
                )}>
                  {entry.status === 'READY' ? 'Ready' : 'Waiting'}
                </span>
                {entry.hold_expires_at && entry.status === 'READY' && (
                  <p className="text-[8px] font-medium text-amber-500/80 mt-0.5">{formatRelativeTime(entry.hold_expires_at, mounted)}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InventoryItemSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border/40 bg-card/10 p-2.5 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-8 w-8 rounded-lg bg-muted/40 shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="h-2.5 w-24 bg-muted/40 rounded" />
            <div className="h-2 w-16 bg-muted/40 rounded" />
          </div>
        </div>
        <div className="h-7 w-[90px] bg-muted/40 rounded-lg" />
        <div className="h-7 w-7 bg-muted/40 rounded-lg" />
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
  
  // Sync state with props when they change (e.g. from realtime updates in parent)
  useEffect(() => {
    setBook(initialBook);
  }, [initialBook]);

  useEffect(() => {
    if (initialCopies) setCopies(initialCopies);
  }, [initialCopies]);

  useEffect(() => {
    if (initialQueue) setReservationQueue(initialQueue);
  }, [initialQueue]);

  useEffect(() => {
    if (initialCopies) setLoading(false);
  }, [initialCopies]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  
  const [showAddCopies, setShowAddCopies] = useState(false);
  const [copiesToAdd, setCopiesToAdd] = useState(1);
  const [addCopiesLoading, setAddCopiesLoading] = useState(false);

  const [copyFilter, setCopyFilter] = useState<'ALL' | BookCopyWithReservation['status']>('ALL');

  const [editForm, setEditForm] = useState({
    title: initialBook.title,
    author: initialBook.author,
    isbn: initialBook.isbn || '',
    section: initialBook.section || '',
    location: initialBook.location || '',
    dewey_decimal: initialBook.dewey_decimal || '',
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

  const handleRestoreBook = async () => {
    setRestoreLoading(true);
    try {
      const result = await restoreBook(book.id);
      if (!result.success) throw new Error(result.error);
      toast.success('Book restored');
      setBook(prev => ({ ...prev, is_active: true }));
      router.refresh();
    } catch {
      toast.error('Restore failed');
    } finally {
      setRestoreLoading(false);
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

  const handleAddCopies = async () => {
    if (copiesToAdd < 1) return;
    setAddCopiesLoading(true);
    try {
      const result = await addBookCopies({ bookId: book.id, copiesCount: copiesToAdd });
      if (!result.success) throw new Error(result.error);
      await fetchData();
      setBook(prev => ({
        ...prev,
        total_copies: (prev.total_copies || 0) + copiesToAdd,
        available_copies: (prev.available_copies || 0) + copiesToAdd,
      }));
      setShowAddCopies(false);
      setCopiesToAdd(1);
      toast.success(`Successfully added ${copiesToAdd} ${copiesToAdd === 1 ? 'copy' : 'copies'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add copies');
    } finally {
      setAddCopiesLoading(false);
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
        <div className="flex gap-6 pr-8">
          <div className="relative h-36 w-24 shrink-0 overflow-hidden rounded-lg shadow-sm border border-border/40">
            <Image 
              src={book.cover_url || "/images/default-book-cover.png"} 
              alt={book.title} 
              fill 
              className="object-cover" 
              unoptimized 
            />
          </div>
          <div className="flex-1 min-w-0 flex flex-col py-1">
            <div className="flex items-center gap-2 mb-2">
               <span className={cn(
                 "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium tracking-tight",
                 !book.is_active
                   ? "bg-amber-500/10 text-amber-600"
                   : isAvailable
                     ? "bg-emerald-500/10 text-emerald-600"
                     : "bg-rose-500/10 text-rose-600"
               )}>
                 <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
                 {!book.is_active ? "Archived" : isAvailable ? "In Stock" : "Out of Stock"}
               </span>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground leading-none mb-1 line-clamp-1">{book.title}</h2>
            <p className="text-base text-muted-foreground/80 mb-4">{book.author}</p>
            
            <div className="flex flex-wrap gap-1.5">
               <Badge variant="secondary" className="text-[10px] font-medium bg-muted/40 hover:bg-muted/40 text-muted-foreground border-none px-2 py-0">
                 {categoryName || 'General'}
               </Badge>
               <Badge variant="secondary" className="text-[10px] font-medium bg-muted/40 hover:bg-muted/40 text-muted-foreground border-none px-2 py-0">
                 DDC {book.dewey_decimal || 'N/A'}
               </Badge>
               {book.isbn && (
                 <Badge variant="secondary" className="text-[10px] font-medium bg-muted/40 hover:bg-muted/40 text-muted-foreground border-none px-2 py-0">
                   {book.isbn}
                 </Badge>
               )}
            </div>
          </div>
          {canManage && (
            <div className="flex flex-col self-start pt-1">
               <Button 
                 variant="ghost" 
                 size="icon"
                 onClick={() => setIsEditing(true)}
                 className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
               >
                 <Edit3 size={16} />
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
            <FieldGroup label="Dewey Decimal (DDC)">
              <Input value={editForm.dewey_decimal} onChange={e => setEditForm({ ...editForm, dewey_decimal: e.target.value })} className="h-9 rounded-xl text-xs" />
            </FieldGroup>
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-primary/10 pt-4">
             {book.is_active ? (
               showDeleteConfirm ? (
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
               )
             ) : (
               <Button 
                 variant="ghost" 
                 size="sm" 
                 onClick={handleRestoreBook} 
                 disabled={restoreLoading}
                 className="h-8 px-0 text-emerald-600 hover:text-emerald-700 hover:bg-transparent text-[10px] font-black uppercase"
               >
                 {restoreLoading ? <Loader2 size={12} className="mr-1.5 animate-spin" /> : <RotateCw size={12} className="mr-1.5" />}
                 Restore Asset
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
         <div className="rounded-xl border border-border/20 bg-muted/5 p-4 flex items-center justify-between px-6">
            <div className="text-center">
              <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-1">Total</p>
              <p className="text-xl font-semibold text-foreground leading-none">{book.total_copies ?? 0}</p>
            </div>
            <div className="w-px h-8 bg-border/20" />
            <div className="text-center">
              <p className="text-[10px] font-bold text-emerald-500/60 uppercase tracking-widest mb-1">Available</p>
              <p className="text-xl font-semibold text-emerald-500 leading-none">{book.available_copies ?? 0}</p>
            </div>
            {reservationQueue.length > 0 && (
              <>
                <div className="w-px h-8 bg-border/20" />
                <div className="text-center">
                  <p className="text-[10px] font-bold text-indigo-500/60 uppercase tracking-widest mb-1">Queue</p>
                  <p className="text-xl font-semibold text-indigo-500 leading-none">{reservationQueue.length}</p>
                </div>
              </>
            )}
         </div>
         <ReservationQueuePanel queue={reservationQueue} mounted={mounted} />
      </div>

      {/* Inventory List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/20 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Inventory Assets</h3>
          </div>
          
          <div className="flex items-center gap-4">
            {canManage && (
              !showAddCopies ? (
                <Button variant="ghost" size="sm" onClick={() => setShowAddCopies(true)} className="h-8 text-[10px] font-medium text-primary hover:text-primary hover:bg-primary/5 px-2">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Copies
                </Button>
              ) : (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                  <Input 
                    type="number" 
                    min={1} 
                    max={50} 
                    value={copiesToAdd} 
                    onChange={e => setCopiesToAdd(parseInt(e.target.value) || 1)} 
                    className="h-8 w-14 text-center text-xs px-1 rounded-md"
                  />
                  <Button size="sm" onClick={handleAddCopies} disabled={addCopiesLoading} className="h-8 px-3 text-[10px] font-medium">
                    {addCopiesLoading ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : 'Confirm'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddCopies(false)} className="h-8 px-2 text-[10px] font-medium text-muted-foreground">
                    Cancel
                  </Button>
                </div>
              )
            )}
            
            <Select value={copyFilter} onValueChange={(v) => {
              if (v === 'ALL' || isBookCopyStatus(v)) setCopyFilter(v as 'ALL' | BookCopyWithReservation['status']);
            }}>
              <SelectTrigger className="h-8 w-[110px] rounded-md border-none bg-muted/40 hover:bg-muted/60 px-2.5 text-[10px] font-medium text-muted-foreground shadow-none focus:ring-0 transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border/40 shadow-xl">
                <SelectItem value="ALL" className="text-[10px] font-medium">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key} className="text-[10px] font-medium">{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2 min-h-[160px] max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
          {loading ? (
            <div className="space-y-2">
              <InventoryItemSkeleton />
              <InventoryItemSkeleton />
              <InventoryItemSkeleton />
            </div>
          ) : filteredCopies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border/20 bg-muted/5">
              <SearchX size={24} className="text-muted-foreground/20 mb-3" />
              <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">No matching assets found</p>
            </div>
          ) : (
            filteredCopies.map((copy) => {
              const statusCfg = STATUS_CONFIG[copy.status as keyof typeof STATUS_CONFIG] ?? {
                label: copy.status, icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border'
              };
              const StatusIcon = statusCfg.icon;
              const res = copy.reservation;
              const r = res?.profiles as { full_name?: string | null; avatar_url?: string | null } | null;

              return (
                <div key={copy.id} className="group flex flex-col gap-2 rounded-lg border border-border/20 bg-muted/5 p-3 transition-colors hover:bg-muted/10">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("h-9 w-9 shrink-0 rounded-md border flex items-center justify-center transition-colors", statusCfg.bg, statusCfg.border)}>
                        <StatusIcon size={16} className={statusCfg.color} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-mono text-[12px] font-semibold text-foreground/90 truncate">{copy.qr_string}</p>
                          <span className="text-[9px] font-medium text-muted-foreground px-1.5 py-0.5 border border-border/40 rounded bg-muted/40 uppercase tracking-tighter">{copy.accession_number}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                          <span className={cn("font-medium", statusCfg.color)}>{statusCfg.label}</span>
                          <span className="opacity-20">•</span>
                          <span className="font-mono opacity-60">ID: {copy.id.split('-')[0]}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {canManage ? (
                        <Select value={copy.status} onValueChange={(v) => {
                          if (isEditableStatus(v)) handleStatusChange(copy.id, v);
                        }}>
                          <SelectTrigger className="h-8 w-[100px] rounded-md border-none bg-muted/40 hover:bg-muted/60 px-2.5 text-[10px] font-semibold uppercase shadow-none focus:ring-0 transition-colors">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-border/40 shadow-xl">
                            {EDITABLE_STATUSES.map((key) => (
                              <SelectItem key={key} value={key} className="text-[10px] font-semibold uppercase">
                                {STATUS_CONFIG[key].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="h-8 px-2.5 text-[10px] font-semibold uppercase border-border/40">
                          {statusCfg.label}
                        </Badge>
                      )}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <QRPrinterModal qrString={copy.qr_string} bookTitle={book.title} />
                      </div>
                    </div>
                  </div>

                  {/* Reserver Info */}
                  {copy.status === 'RESERVED' && r && (
                    <div className="flex items-center gap-2.5 bg-indigo-500/5 rounded-md border border-indigo-500/10 p-2 mt-1">
                      <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-background">
                         {r.avatar_url ? (
                           <Image src={r.avatar_url} alt="" fill className="object-cover" unoptimized />
                         ) : (
                           <div className="h-full w-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                             <UserCircle2 size={12} className="text-indigo-400" />
                           </div>
                         )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight truncate">
                          Reserved by {r.full_name ?? 'Unknown User'}
                        </p>
                        {res?.hold_expires_at && (
                          <p className="text-[9px] font-medium text-amber-500/80">
                            Expires {formatRelativeTime(res.hold_expires_at, mounted)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-border/20 hidden">
        {/* Analytics link removed per request to put everything in the modal */}
      </div>
    </div>
  );
}
