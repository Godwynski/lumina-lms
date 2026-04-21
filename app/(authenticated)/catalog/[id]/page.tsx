import { getBookById, getBookCopies, getBookReservationQueue } from '@/lib/actions/catalog';
import { StaffBookManagementClient } from './StaffBookManagementClient';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { BookCopyWithReservation } from '@/lib/types';

async function BookManagementContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [book, copies, reservationQueue] = await Promise.all([
    getBookById(id),
    getBookCopies(id),
    getBookReservationQueue(id),
  ]);

  if (!book) {
    return <div className="p-12 text-center text-muted-foreground">Book not found.</div>;
  }

  return (
    <StaffBookManagementClient 
      initialBook={book} 
      initialCopies={copies as BookCopyWithReservation[]}
      initialReservationQueue={reservationQueue}
    />
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-4 w-96 rounded-md" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Skeleton className="h-64 md:col-span-1 rounded-xl" />
        <Skeleton className="h-64 md:col-span-2 rounded-xl" />
      </div>
    </div>
  );
}

export default function StaffBookManagementPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="w-full space-y-6">

      <Suspense fallback={<PageSkeleton />}>
        <BookManagementContent params={params} />
      </Suspense>
    </div>
  );
}
