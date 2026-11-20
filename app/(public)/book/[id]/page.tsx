import Link from 'next/link';
import { getPublicBookById } from '@/lib/actions/public-catalog';
import { ArrowRight, ChevronLeft, MapPin, Hash, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Suspense } from 'react';
import { getCategoryName } from '@/lib/utils';
import { PublicBookCover } from '@/components/public/PublicBookCover';

export const metadata = { title: "Book Details" };

async function PublicBookDetailLoader({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  let book = null;
  try {
    book = await getPublicBookById(id);
  } catch (err) {
    console.error(err);
  }

  if (!book) {
    return <h1 className="p-8 text-center text-muted-foreground">Book not found.</h1>;
  }

  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border p-6 md:p-8 flex flex-col md:flex-row gap-8">
      <div className="w-full md:w-1/3 flex-shrink-0">
        <div className="relative aspect-[2/3] bg-muted rounded-xl overflow-hidden flex items-center justify-center border border-border/60 shadow-inner">
          <PublicBookCover src={book.cover_url} title={book.title} />
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1.5 tracking-tight">{book.title}</h1>
          <p className="text-lg text-muted-foreground">{book.author}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {book.available_copies > 0 ? (
            <span className="status-success border px-3 py-1 rounded-lg text-xs font-semibold">
              {book.available_copies} Available
            </span>
          ) : (
            <span className="status-danger border px-3 py-1 rounded-lg text-xs font-semibold">
              Currently Borrowed
            </span>
          )}
          
          {(book.section || book.location) && (
            <span className="bg-accent text-accent-foreground px-3 py-1 rounded-lg text-xs font-medium flex items-center">
              <MapPin className="w-3.5 h-3.5 mr-1.5 shrink-0" />
              {book.section}{book.section && book.location && ' - '}{book.location}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 border-y border-border">
          <div className="flex items-center text-sm text-muted-foreground">
            <Hash className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
            <span className="font-medium text-foreground mr-2">ISBN:</span>
            <span>{book.isbn || 'Unknown'}</span>
          </div>
          
          <div className="flex items-center text-sm text-muted-foreground">
            <Tag className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
            <span className="font-medium text-foreground mr-2">Category:</span>
            <span>{getCategoryName(book.categories)}</span>
          </div>
        </div>

        {book.tags && book.tags.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-2">Subject Tags</h2>
            <div className="flex flex-wrap gap-2">
              {book.tags.map((tag: string, i: number) => (
                <span key={i} className="bg-muted text-muted-foreground px-2.5 py-1 rounded-lg text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2">
          <Button asChild className="min-h-11 sm:min-h-0 sm:h-10 w-full sm:w-auto rounded-lg font-semibold">
            <Link href="/">
              Sign in to Reserve
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PublicBookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8">
      <Button
        asChild
        variant="ghost"
        className="inline-flex min-h-11 sm:min-h-10 items-center text-muted-foreground hover:text-foreground mb-6 px-2 -ml-2"
      >
        <Link href="/">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Library
        </Link>
      </Button>

      <Suspense fallback={
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6 md:p-8 flex flex-col md:flex-row gap-8 animate-pulse">
          <div className="w-full md:w-1/3 aspect-[2/3] bg-muted rounded-xl" />
          <div className="flex-1 space-y-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4 rounded-lg" />
              <Skeleton className="h-6 w-1/4 rounded-md" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-32 rounded-lg" />
            </div>
            <div className="space-y-2 py-4 border-y border-border/50">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-2/3 rounded" />
            </div>
            <Skeleton className="h-10 w-48 rounded-lg" />
          </div>
        </div>
      }>
        <PublicBookDetailLoader params={params} />
      </Suspense>
    </main>
  );
}
