'use client';

import { use } from 'react';
import Image from 'next/image';
import { 
  MapPin, 
  BookOpen, 
  CheckCircle2,
  Clock,
  BookMarked,
  ScanLine
} from 'lucide-react';
import { ReportMissingButton } from '@/components/common/ReportMissingButton';

interface BookDetail {
  id: string;
  title: string;
  author: string;
  isbn: string | null;
  cover_url: string | null;
  section: string | null;
  available_copies: number;
  total_copies: number;
  categories: { name?: string } | { name?: string }[] | null;
  tags: string[] | null;
}

export function StudentBookDetailClient({ 
  bookPromise,
  id
}: { 
  bookPromise: Promise<BookDetail | null>;
  id: string;
}) {
  const book = use(bookPromise);

  if (!book) {
    return (
      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
        Book not found.
      </div>
    );
  }

  return (
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
        <div className="hidden md:block">
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
                : (book.categories as { name?: string })?.name || 'Uncategorized'}
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

        <ReportMissingButton 
          bookId={id} 
          disabled={book.available_copies === 0} 
          userType="student" 
        />
      </div>
    </div>
  );
}
