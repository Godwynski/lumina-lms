import { Suspense } from 'react';
import Link from 'next/link';
import { getPublicBookById } from '@/lib/actions/public-catalog';
import { getBookAvailabilityStatus } from '@/lib/actions/reservations';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminTableShell } from '@/components/admin/AdminTableShell';
import { StudentBookDetailClient } from './StudentBookDetailClient';
import { Skeleton } from '@/components/ui/skeleton';

function BookDetailSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-pulse">
      {/* Status banner skeleton */}
      <Skeleton className="h-14 w-full rounded-2xl" />
      <div className="flex flex-col md:flex-row gap-6">
        {/* Cover skeleton */}
        <div className="shrink-0 mx-auto md:mx-0">
          <Skeleton className="h-[280px] w-[190px] rounded-2xl" />
        </div>
        {/* Right side skeleton */}
        <div className="flex-1 space-y-4 min-w-0">
          <div className="space-y-2">
            <Skeleton className="h-8 w-3/4 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-11 flex-1 rounded-xl" />
            <Skeleton className="h-11 w-40 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

async function StudentBookDetailLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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
    <AdminTableShell
      headerActions={
        <Button asChild variant="outline" className="h-8 px-3 text-xs">
          <Link href="/student-catalog">
            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
            Back to Catalog
          </Link>
        </Button>
      }
    >
      <Suspense fallback={<BookDetailSkeleton />}>
        <StudentBookDetailLoader params={params} />
      </Suspense>
    </AdminTableShell>
  );
}
