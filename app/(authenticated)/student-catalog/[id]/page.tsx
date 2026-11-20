import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getPublicBookById } from '@/lib/actions/public-catalog';
import { getBookAvailabilityStatus } from '@/lib/actions/reservations';
import { StudentBookDetailClient } from './StudentBookDetailClient';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: "Book Details" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function BookDetailSkeleton() {
  return (
    <div role="status" className="w-full max-w-4xl space-y-5">
      <span className="sr-only">Loading Book Details</span>
      <div className="flex gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
        <Skeleton className="aspect-[2/3] w-16 shrink-0 rounded-lg sm:w-28 lg:w-32" />
        <div className="min-w-0 flex-1 space-y-3">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

async function StudentBookDetailLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // A malformed id can never match a book; show the not-found page instead of a database error.
  if (!UUID_PATTERN.test(id)) notFound();

  // Kick off both data fetches concurrently
  const bookPromise = getPublicBookById(id);
  const availabilityPromise = getBookAvailabilityStatus(id);

  return (
    <StudentBookDetailClient
      bookPromise={bookPromise}
      availabilityPromise={availabilityPromise}
      id={id}
    />
  );
}

export default function StudentBookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="w-full min-w-0 max-w-4xl">
      <Suspense fallback={<BookDetailSkeleton />}>
        <StudentBookDetailLoader params={params} />
      </Suspense>
    </div>
  );
}
