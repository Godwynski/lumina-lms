'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getPublicBookById, reportMissingBook } from '@/lib/actions/public-catalog';
import { 
  ChevronLeft, 
  MapPin, 
  AlertCircle, 
  BookOpen, 
  CheckCircle2,
  Clock,
  BookMarked,
  ScanLine
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminTableShell } from '@/components/admin/AdminTableShell';
import type { Book } from '@/lib/types';

type StudentBook = Book & {
  section?: string | null;
  tags?: string[];
};

export default function StudentBookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  
  const [book, setBook] = useState<StudentBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    async function loadBook() {
      try {
        const data = await getPublicBookById(id);
        setBook(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    if (id) loadBook();
  }, [id]);

  const handleReportMissing = async () => {
    setReportSubmitting(true);
    try {
      await reportMissingBook(id, 'Student reported book missing from shelf.');
      setReported(true);
    } catch (err) {
      console.error(err);
    } finally {
      setReportSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted-foreground">Loading book details...</p>
      </div>
    );
  }

  if (!book) {
    return (
      <AdminTableShell
        title="Book Catalog"
        description="Browse available books, sections, and current shelf availability."
        headerActions={
          <Button onClick={() => router.push('/protected/student-catalog')} variant="outline" className="h-8 px-3 text-xs">
            Back
          </Button>
        }
      >
        <div className="px-4 py-10 text-center text-sm text-muted-foreground">Book not found.</div>
      </AdminTableShell>
    );
  }

  return (
    <AdminTableShell
      title="Book Details"
      description="View metadata and shelf availability for this catalog entry."
      headerActions={
        <Button onClick={() => router.push('/protected/student-catalog')} variant="outline" className="h-8 px-3 text-xs">
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />
          Back
        </Button>
      }
      feedback={
        reported ? (
          <div className="status-success rounded-md px-3 py-2 text-sm">
            Librarian notified. Thank you for reporting this shelf issue.
          </div>
        ) : null
      }
    >
      <div className="grid gap-4 p-4 md:grid-cols-[200px_1fr] md:p-6">
        <div className="space-y-3">
          <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-muted">
            {book.cover_url ? (
              <Image
                src={book.cover_url}
                alt={book.title}
                fill
                sizes="(min-width: 768px) 200px, 100vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <BookOpen className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
          </div>

          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
              book.available_copies > 0 ? 'status-success' : 'status-warning'
            }`}
          >
            {book.available_copies > 0 ? (
              <>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Available
              </>
            ) : (
              <>
                <Clock className="mr-1 h-3.5 w-3.5" />
                Borrowed
              </>
            )}
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{book.title}</h2>
            <p className="text-sm text-muted-foreground">{book.author}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">ISBN</p>
              <p className="mt-1 font-mono text-sm text-foreground">{book.isbn || 'Unknown'}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="mt-1 text-sm text-foreground">
                {Array.isArray(book.categories)
                  ? book.categories[0]?.name || 'Uncategorized'
                  : book.categories?.name || 'Uncategorized'}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Section</p>
              <p className="mt-1 inline-flex items-center gap-1 text-sm text-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {book.section || 'General'}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground">Availability</p>
              <p className="mt-1 text-sm text-foreground">
                {book.available_copies} of {book.total_copies}
              </p>
            </div>
          </div>

          {book.tags && book.tags.length > 0 && (
            <div className="rounded-md border border-border p-3">
              <p className="mb-2 text-xs text-muted-foreground">Subject Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {book.tags.map((tag: string, i: number) => (
                  <span key={i} className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <BookMarked className="h-3.5 w-3.5" />
                Smart Tip
              </p>
              <p className="text-xs text-foreground">Use the section label first, then scan nearby shelves for adjacent call numbers.</p>
            </div>
            <div className="rounded-md border border-border bg-muted/40 p-3">
              <p className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <ScanLine className="h-3.5 w-3.5" />
                Desk Assist
              </p>
              <p className="text-xs text-foreground">If unavailable, request staff to verify return queue and shelf placement.</p>
            </div>
          </div>

          {!reported && (
            <div className="pt-1">
              <Button
                onClick={handleReportMissing}
                disabled={reportSubmitting || book.available_copies === 0}
                variant="outline"
                className="h-9 w-full justify-center gap-2 text-xs"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {reportSubmitting ? 'Sending alert...' : "I can't find this book"}
              </Button>
              {book.available_copies === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">This book is currently checked out. Reporting is disabled for now.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminTableShell>
  );
}
