'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import Image from 'next/image';
import {
  updateBookCopyStatus,
  updateBook,
  softDeleteBook,
  restoreBook,
  getBookAdminDetails,
  addBookCopies,
  getCategories,
} from '@/lib/actions/catalog';
import { Textarea } from '@/components/ui/textarea';
import { CompactPagination } from '@/components/ui/compact-pagination';
import {
  CheckCircle2,
  AlertCircle,
  Banknote,
  ChevronDown,
  Gift,
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
import { FieldGroup } from '@/components/common/FieldGroup';
import { ReservationQueuePanel, formatRelativeTime, type ReservationQueueEntry } from './admin/ReservationQueuePanel';
import { cn, getCategoryName } from '@/lib/utils';
import type { Book, BookCopyWithReservation } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CopyDetails } from './admin/CopyDetails';
import { EMPTY_ACQUISITION, OptionalCopyAcquisition } from './CopyAcquisitionFields';
import { copyAcquisitionSchema, hasCopyAcquisition } from '@/lib/copy-acquisition';

// ─── Config ────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  AVAILABLE:   { label: 'Available',   icon: CheckCircle2, color: 'text-emerald-500',  bg: 'bg-emerald-500/5', border: 'border-emerald-500/10' },
  BORROWED:    { label: 'Borrowed',    icon: History,      color: 'text-blue-500',       bg: 'bg-blue-500/5',    border: 'border-blue-500/10'    },
  MAINTENANCE: { label: 'Maintenance', icon: Wrench,       color: 'text-amber-500',    bg: 'bg-amber-500/5',  border: 'border-amber-500/10'  },
  LOST:        { label: 'Lost',        icon: SearchX,      color: 'text-rose-500',       bg: 'bg-rose-500/5',    border: 'border-rose-500/10'    },
  RESERVED:    { label: 'Reserved',    icon: Clock,        color: 'text-indigo-500',   bg: 'bg-indigo-500/5', border: 'border-indigo-500/10' },
  SOLD:        { label: 'Sold',        icon: Banknote,     color: 'text-muted-foreground', bg: 'bg-muted/40', border: 'border-border/60' },
  DONATED_OUT: { label: 'Donated out', icon: Gift,         color: 'text-muted-foreground', bg: 'bg-muted/40', border: 'border-border/60' },
} as const;

const EDITABLE_STATUSES = ['AVAILABLE', 'MAINTENANCE', 'LOST'] as const;
type EditableStatus = typeof EDITABLE_STATUSES[number];

function isEditableStatus(v: string): v is EditableStatus {
  return (EDITABLE_STATUSES as readonly string[]).includes(v);
}
function isBookCopyStatus(v: string): v is BookCopyWithReservation['status'] {
  return Object.hasOwn(STATUS_CONFIG, v);
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

const BOOK_FIELD_CLASS = 'h-11 border-border bg-background text-base shadow-none sm:text-sm';

function bookEditFields(book: Book) {
  return {
    title: book.title,
    author: book.author,
    isbn: book.isbn || '',
    category_id: book.category_id || '',
    description: book.description || '',
    published_year: book.published_year ? String(book.published_year) : '',
    cover_url: book.cover_url || '',
    section: book.section || '',
    location: book.location || '',
    dewey_decimal: book.dewey_decimal || '',
  };
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
  
  const [activeTab, setActiveTab] = useState('copies');
  const [isEditing, setIsEditing] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  
  const [showAddCopies, setShowAddCopies] = useState(false);
  const [copiesToAdd, setCopiesToAdd] = useState('1');
  const [batchAcquisition, setBatchAcquisition] = useState(EMPTY_ACQUISITION);
  const [addCopiesError, setAddCopiesError] = useState<string | null>(null);
  const [addCopiesLoading, setAddCopiesLoading] = useState(false);
  const [expandedCopy, setExpandedCopy] = useState<{ id: string; view: 'details' | 'acquisition' | 'lost'; request: number } | null>(null);
  const [copyNotice, setCopyNotice] = useState<{ id: string; message: string } | null>(null);

  const [copyFilter, setCopyFilter] = useState<'ALL' | BookCopyWithReservation['status']>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const COPIES_PER_PAGE = 3;

  // Reset page when filter or copy list changes
  useEffect(() => {
    setCurrentPage(1);
  }, [copyFilter, copies.length]);

  const [editForm, setEditForm] = useState(() => bookEditFields(initialBook));
  const [editError, setEditError] = useState<string | null>(null);

  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const coverImgSrc = book.cover_url && failedCover !== book.cover_url ? book.cover_url : "/images/default-book-cover.png";
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => { 
    setMounted(true); 
  }, []);

  // Fetch categories on mount
  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await getCategories();
        setCategories(data);
      } catch (err) {
        console.error('Failed to load categories', err);
      }
    }
    loadCategories();
  }, []);

  function beginBookEdit() {
    setEditForm(bookEditFields(book));
    setEditError(null);
    setShowDeleteConfirm(false);
    setIsEditing(true);
  }

  const fetchData = useCallback(async () => {
    try {
      const { book: updatedBook, copies: updatedCopies, queue: updatedQueue } = await getBookAdminDetails(initialBook.id);
      if (updatedBook) setBook(updatedBook);
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

  const handleUpdateBook = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || updateLoading) return;
    setUpdateLoading(true);
    setEditError(null);
    try {
      const year = editForm.published_year.trim() ? Number(editForm.published_year) : null;
      if (year !== null && (!Number.isInteger(year) || year < 1000 || year > new Date().getFullYear() + 1)) {
        throw new Error(`Published year must be between 1000 and ${new Date().getFullYear() + 1}`);
      }

      const submissionData = {
        title: editForm.title,
        author: editForm.author,
        isbn: editForm.isbn || null,
        category_id: editForm.category_id || null,
        description: editForm.description || null,
        published_year: year,
        cover_url: editForm.cover_url || null,
        section: editForm.section || null,
        location: editForm.location || null,
        dewey_decimal: editForm.dewey_decimal || null,
      };

      const result = await updateBook({ id: book.id, bookData: submissionData });
      if (!result.success) throw new Error(result.error);
      
      setIsEditing(false);
      toast.success('Book metadata updated');
      
      setLoading(true);
      await fetchData();
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      setEditError(message);
      toast.error(message);
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

  const openCopy = (id: string, view: 'details' | 'acquisition' | 'lost') => {
    setCopyNotice(null);
    setExpandedCopy((previous) => ({ id, view, request: (previous?.request ?? 0) + 1 }));
  };

  const handleStatusChange = async (copyId: string, newStatus: EditableStatus) => {
    if (!canManage) return;
    if (newStatus === 'LOST') {
      openCopy(copyId, 'lost');
      return;
    }
    try {
      const result = await updateBookCopyStatus({ id: copyId, status: newStatus });
      if (!result.success) throw new Error(result.error);
      await fetchData();
      toast.success('Status updated');
    } catch (err) {
      // The server explains refusals (e.g. "This copy is on loan. Use Return first.").
      toast.error(err instanceof Error && err.message ? err.message : 'Status update failed');
    }
  };

  const closeAddCopies = () => {
    setShowAddCopies(false);
    setCopiesToAdd('1');
    setBatchAcquisition(EMPTY_ACQUISITION);
    setAddCopiesError(null);
  };

  const handleAddCopies = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || addCopiesLoading) return;
    const copiesCount = Number(copiesToAdd);
    if (!Number.isInteger(copiesCount) || copiesCount < 1 || copiesCount > 50) {
      setAddCopiesError('Enter a whole number from 1 to 50.');
      return;
    }
    const validation = copyAcquisitionSchema.safeParse(batchAcquisition);
    if (!validation.success) {
      setAddCopiesError(validation.error.issues[0].message);
      return;
    }
    setAddCopiesLoading(true);
    setAddCopiesError(null);
    try {
      const result = await addBookCopies({
        bookId: book.id,
        copiesCount,
        ...(hasCopyAcquisition(batchAcquisition) ? { acquisition: batchAcquisition } : {}),
      });
      if (!result.success) throw new Error(result.error);
      await fetchData();
      closeAddCopies();
      router.refresh();
      toast.success(`Successfully added ${copiesCount} ${copiesCount === 1 ? 'copy' : 'copies'}`);
    } catch (err) {
      setAddCopiesError(err instanceof Error ? err.message : 'Failed to add copies');
    } finally {
      setAddCopiesLoading(false);
    }
  };

  const handleCopyDetailsSaved = async (id: string, message: string) => {
    setCopyNotice({ id, message });
    await fetchData();
    router.refresh();
  };

  const categoryName = getCategoryName(book.categories);

  const filteredCopies = copies.filter(c => copyFilter === 'ALL' || c.status === copyFilter);
  const printableCopies = copies.filter((copy) => copy.status !== 'SOLD' && copy.status !== 'DONATED_OUT');
  const totalPages = Math.ceil(filteredCopies.length / COPIES_PER_PAGE);
  const activePage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedCopies = filteredCopies.slice(
    (activePage - 1) * COPIES_PER_PAGE,
    activePage * COPIES_PER_PAGE
  );
  const showNoticeInRow = !loading && expandedCopy?.id === copyNotice?.id &&
    paginatedCopies.some((copy) => copy.id === copyNotice?.id && (canManage || copy.lifecycle !== undefined));
  const bookFields = [
    { label: 'ISBN', value: book.isbn },
    { label: 'DDC', value: book.dewey_decimal },
    { label: 'Category', value: categoryName },
    { label: 'Published year', value: book.published_year },
    { label: 'Section', value: book.section },
    { label: 'Shelf location', value: book.location },
  ];

  return (
    <div className="space-y-5">
      <div className="flex min-w-0 items-start gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:w-20">
          <Image src={coverImgSrc} alt={book.title} fill className="object-cover" unoptimized onError={() => setFailedCover(book.cover_url || null)} />
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="break-words text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{book.title}</h2>
          <p className="break-words text-sm text-muted-foreground">{book.author}</p>
          <p className="pt-1 text-sm tabular-nums">
            <span className="font-semibold text-emerald-800">{book.available_copies ?? 0}</span>{' '}
            <span className="text-emerald-800">available</span>
            <span className="text-muted-foreground"> of {book.total_copies ?? 0} copies</span>
            {book.is_active === false && <span className="ml-2 rounded-full px-2 py-0.5 text-xs status-warning">Archived</span>}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
        <TabsList aria-label="Inventory book sections" className="h-auto min-h-11 w-full sm:w-fit">
          <TabsTrigger value="copies" className="min-h-11 whitespace-normal text-xs sm:flex-none sm:whitespace-nowrap sm:px-4 sm:text-sm">Copies &amp; acquisition</TabsTrigger>
          <TabsTrigger value="book" className="min-h-11 whitespace-normal text-xs sm:flex-none sm:whitespace-nowrap sm:px-4 sm:text-sm">Book information</TabsTrigger>
        </TabsList>

        <TabsContent value="book" forceMount hidden={activeTab !== 'book'}>
          {!isEditing && (
            <section aria-label="Book information" className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">Book information</h3>
                {canManage && (
                  <Button type="button" variant="outline" className="min-h-11" onClick={beginBookEdit}>
                    <Edit3 aria-hidden="true" /> Edit book information
                  </Button>
                )}
              </div>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {bookFields.map(({ label, value }) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5 break-words text-sm">{value ?? 'Not recorded'}</dd>
                  </div>
                ))}
              </dl>
              <div className="border-t border-border pt-4">
                <h4 className="text-sm font-semibold">Description</h4>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                  {book.description || 'No description available.'}
                </p>
              </div>
            </section>
          )}

          {canManage && isEditing && (
            <form aria-label="Edit book information" onSubmit={handleUpdateBook} noValidate className="rounded-xl border border-border bg-card">
              <div className="space-y-5 p-4 sm:p-5">
                <h3 className="text-base font-semibold">Edit book information</h3>

                <fieldset disabled={updateLoading} className="min-w-0">
                  <legend className="mb-3 text-sm font-semibold">Catalog details</legend>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 [&_label]:text-sm">
                    <FieldGroup label="Title" className="min-w-0 sm:col-span-2 lg:col-span-6">
                      <Input value={editForm.title} onChange={(e) => setEditForm((draft) => ({ ...draft, title: e.target.value }))}
                        className={BOOK_FIELD_CLASS} />
                    </FieldGroup>
                    <FieldGroup label="Author" className="min-w-0 lg:col-span-2">
                      <Input value={editForm.author} onChange={(e) => setEditForm((draft) => ({ ...draft, author: e.target.value }))}
                        className={BOOK_FIELD_CLASS} />
                    </FieldGroup>
                    <FieldGroup label="Category" className="min-w-0 lg:col-span-2">
                      <Select value={editForm.category_id || 'none'} disabled={updateLoading}
                        onValueChange={(value) => setEditForm((draft) => ({ ...draft, category_id: value === 'none' ? '' : value }))}>
                        <SelectTrigger className={cn('min-h-11 w-full', BOOK_FIELD_CLASS)}>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">General / Uncategorized</SelectItem>
                          {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FieldGroup>
                    <FieldGroup label="Published year" className="min-w-0 sm:col-span-2 lg:col-span-2">
                      <Input type="number" inputMode="numeric" min={1000} max={new Date().getFullYear() + 1}
                        value={editForm.published_year} onChange={(e) => setEditForm((draft) => ({ ...draft, published_year: e.target.value }))}
                        className={BOOK_FIELD_CLASS} />
                    </FieldGroup>
                    <FieldGroup label="ISBN" className="min-w-0 lg:col-span-3">
                      <Input value={editForm.isbn} readOnly placeholder="Not recorded" className={cn(BOOK_FIELD_CLASS, 'bg-muted/40 text-muted-foreground')} />
                    </FieldGroup>
                    <FieldGroup label="Dewey Decimal (DDC)" className="min-w-0 lg:col-span-3">
                      <Input value={editForm.dewey_decimal} onChange={(e) => setEditForm((draft) => ({ ...draft, dewey_decimal: e.target.value }))}
                        className={BOOK_FIELD_CLASS} />
                    </FieldGroup>
                  </div>
                </fieldset>

                <fieldset disabled={updateLoading} className="min-w-0">
                  <legend className="mb-3 text-sm font-semibold">Shelf placement and description</legend>
                  <div className="grid gap-3 sm:grid-cols-2 [&_label]:text-sm">
                    <FieldGroup label="Shelf location">
                      <Input value={editForm.location} onChange={(e) => setEditForm((draft) => ({ ...draft, location: e.target.value }))}
                        className={BOOK_FIELD_CLASS} placeholder="e.g. Second Floor" />
                    </FieldGroup>
                    <FieldGroup label="Section">
                      <Input value={editForm.section} onChange={(e) => setEditForm((draft) => ({ ...draft, section: e.target.value }))}
                        className={BOOK_FIELD_CLASS} placeholder="e.g. Fiction" />
                    </FieldGroup>
                    <FieldGroup label="Description" className="sm:col-span-2">
                      <Textarea value={editForm.description} onChange={(e) => setEditForm((draft) => ({ ...draft, description: e.target.value }))}
                        className="min-h-24 rounded-lg border-border bg-background text-base shadow-none sm:text-sm" />
                    </FieldGroup>
                  </div>
                </fieldset>

                <div className="border-t border-border pt-3">
                  {book.is_active ? (
                    showDeleteConfirm ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">Archive this book?</p>
                        <Button type="button" onClick={handleDeleteBook} disabled={deleteLoading || updateLoading} variant="destructive" className="min-h-11">Confirm</Button>
                        <Button type="button" variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="min-h-11">Keep book</Button>
                      </div>
                    ) : (
                      <Button type="button" variant="ghost" onClick={() => setShowDeleteConfirm(true)} disabled={updateLoading} className="min-h-11 text-destructive">
                        <Archive aria-hidden="true" /> Archive book
                      </Button>
                    )
                  ) : (
                    <Button type="button" variant="outline" onClick={handleRestoreBook} disabled={restoreLoading || updateLoading} className="min-h-11">
                      {restoreLoading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RotateCw aria-hidden="true" />}
                      Restore book
                    </Button>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 z-10 space-y-2 rounded-b-xl border-t border-border bg-card px-4 py-3 sm:px-5">
                {editError && <p role="alert" className="text-sm text-destructive">{editError}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={updateLoading} className="min-h-11">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateLoading || deleteLoading || restoreLoading} className="min-h-11">
                    {updateLoading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                    {updateLoading ? 'Saving…' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </TabsContent>

        <TabsContent value="copies" forceMount hidden={activeTab !== 'copies'} className="space-y-5">
          {/* Inventory List */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border/20 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold">Physical copies <span className="ml-1 text-sm font-normal tabular-nums text-muted-foreground">({copies.length})</span></h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {printableCopies.length > 1 && (
                  <QRPrinterModal
                    bookTitle={book.title}
                    triggerLabel="Print all QR"
                    labels={printableCopies.map((c) => ({ qrString: c.qr_string, accessionNumber: c.accession_number }))}
                  />
                )}
                {canManage && !showAddCopies && (
                  <Button size="sm" onClick={() => setShowAddCopies(true)} className="min-h-11 px-3 text-sm">
                    <Plus className="h-3.5 w-3.5" /> Add Copies
                  </Button>
                )}

                <Select value={copyFilter} onValueChange={(v) => {
                  if (v === 'ALL' || isBookCopyStatus(v)) setCopyFilter(v as 'ALL' | BookCopyWithReservation['status']);
                }}>
                  <SelectTrigger aria-label="Filter copies by status" className="h-11 w-auto min-w-32 rounded-lg border-border bg-card text-sm shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border/40 shadow-xl">
                    <SelectItem value="ALL" className="text-[11px] font-medium">All Statuses</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key} className="text-[11px] font-medium">{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {canManage && showAddCopies && (
              <form aria-label="Add copies" noValidate onSubmit={handleAddCopies} className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <FieldGroup label="Number of copies to add">
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={copiesToAdd}
                      aria-label="Number of copies to add"
                      disabled={addCopiesLoading}
                      onChange={(event) => { setCopiesToAdd(event.target.value); setAddCopiesError(null); }}
                      className="h-9 w-24"
                    />
                  </FieldGroup>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={closeAddCopies} disabled={addCopiesLoading}>Cancel</Button>
                    <Button type="submit" size="sm" disabled={addCopiesLoading}>{addCopiesLoading ? 'Adding…' : 'Confirm'}</Button>
                  </div>
                </div>
                <OptionalCopyAcquisition value={batchAcquisition} onChange={(value) => { setBatchAcquisition(value); setAddCopiesError(null); }} disabled={addCopiesLoading} />
                {addCopiesError && <p role="alert" className="text-sm text-destructive">{addCopiesError}</p>}
              </form>
            )}

            {copyNotice && !showNoticeInRow && <p role="status" className="text-sm text-foreground">{copyNotice.message}</p>}

            <div className="min-h-[160px] space-y-2">
              {loading ? (
                <div className="space-y-2">
                  <InventoryItemSkeleton />
                  <InventoryItemSkeleton />
                  <InventoryItemSkeleton />
                </div>
              ) : filteredCopies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-dashed border-border/20 bg-muted/5">
                  <SearchX size={24} className="text-muted-foreground/20 mb-3" />
                  <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">No matching copies</p>
                </div>
              ) : (
                paginatedCopies.map((copy) => {
                  const statusCfg = STATUS_CONFIG[copy.status as keyof typeof STATUS_CONFIG] ?? {
                    label: copy.status, icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border'
                  };
                  const StatusIcon = statusCfg.icon;
                  const res = copy.reservation;
                  const r = res?.profiles as { full_name?: string | null; avatar_url?: string | null } | null;
                  const copyIdentifier = copy.accession_number || copy.qr_string;
                  const detailId = `copy-details-${copy.id}`;
                  const canReadDetails = canManage || copy.lifecycle !== undefined;
                  const isExpanded = canReadDetails && expandedCopy?.id === copy.id;
                  const isEditingAcquisition = isExpanded && expandedCopy.view === 'acquisition';
                  const method = copy.lifecycle?.acquisition_method;
                  const acquisitionLabel = method === 'DONATED' ? 'Donated' : method === 'PURCHASED' ? 'Bought' : 'Acquisition not recorded';

                  return (
                    <div key={copy.id} className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", statusCfg.bg, statusCfg.border)}>
                            <StatusIcon size={16} aria-hidden="true" className={statusCfg.color} />
                          </div>
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold">{copyIdentifier}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              {copy.accession_number && <span className="break-all font-mono">{copy.qr_string}</span>}
                              <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground">{statusCfg.label}</span>
                              {(canManage || copy.lifecycle !== undefined) && <span>{acquisitionLabel}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex max-w-full flex-wrap gap-2">
                          {canManage && (
                            <Button type="button" variant="outline" className="min-h-11" aria-label={'Edit acquisition for ' + copyIdentifier}
                              aria-expanded={isEditingAcquisition} aria-controls={detailId}
                              onClick={() => { if (!isEditingAcquisition) openCopy(copy.id, 'acquisition'); }}>
                              Edit acquisition
                            </Button>
                          )}
                          {canReadDetails ? (
                            <Button type="button" variant="ghost" className="min-h-11" aria-label={'Copy actions for ' + copyIdentifier}
                              aria-expanded={isExpanded} aria-controls={detailId}
                              onClick={() => isExpanded ? setExpandedCopy(null) : openCopy(copy.id, 'details')}>
                              Copy actions
                              <ChevronDown aria-hidden="true" className={cn('size-4', isExpanded && 'rotate-180')} />
                            </Button>
                          ) : (
                            <QRPrinterModal qrString={copy.qr_string} accessionNumber={copy.accession_number} bookTitle={book.title} />
                          )}
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
                            <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight truncate">
                              Reserved by {r.full_name ?? 'Unknown User'}
                            </p>
                            {res?.hold_expires_at && (
                              <p className="text-[11px] font-medium text-amber-500/80">
                                Expires {formatRelativeTime(res.hold_expires_at, mounted)}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                      <div id={detailId} hidden={!isExpanded} className="mt-1 space-y-3 border-t border-border px-1 pt-3 sm:px-2">
                        {isExpanded && (
                          <>
                            <CopyDetails
                              key={expandedCopy.request}
                              copy={copy}
                              canManage={canManage}
                              reportLost={expandedCopy.view === 'lost'}
                              editAcquisition={expandedCopy.view === 'acquisition'}
                              onAcquisitionClose={() => setExpandedCopy((current) =>
                                current?.id === copy.id && current.view === 'acquisition' ? { ...current, view: 'details' } : current
                              )}
                              copyActions={(
                                <>
                                  {canManage && isEditableStatus(copy.status) && (
                                    <Select value={copy.status} onValueChange={(v) => {
                                      if (isEditableStatus(v)) handleStatusChange(copy.id, v);
                                    }}>
                                    <FieldGroup label="Copy status" className="flex flex-wrap items-center gap-2 space-y-0">
                                      <SelectTrigger aria-label={`Copy status for ${copyIdentifier}`} className="min-h-11 rounded-lg border-border bg-card px-3 text-sm shadow-none">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FieldGroup>
                                      <SelectContent className="border-border/40 shadow-xl">
                                        {EDITABLE_STATUSES.map((key) => (
                                          <SelectItem key={key} value={key} className="text-[11px] font-semibold uppercase">
                                            {STATUS_CONFIG[key].label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                  <QRPrinterModal qrString={copy.qr_string} accessionNumber={copy.accession_number} bookTitle={book.title} />
                                </>
                              )}
                              onSaved={(message) => handleCopyDetailsSaved(copy.id, message)}
                            />
                            {copyNotice?.id === copy.id && <p role="status" className="mt-3 text-sm text-foreground">{copyNotice.message}</p>}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {!loading && filteredCopies.length > COPIES_PER_PAGE && (
              <div className="pt-2 border-t border-border/10">
                <CompactPagination
                  page={activePage}
                  totalItems={filteredCopies.length}
                  pageSize={COPIES_PER_PAGE}
                  onPageChange={setCurrentPage}
                  variant="ghost"
                />
              </div>
            )}
          </div>

          <ReservationQueuePanel queue={reservationQueue} mounted={mounted} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
