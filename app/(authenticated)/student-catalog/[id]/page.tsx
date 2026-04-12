import { Suspense } from 'react';
import Link from 'next/link';
import { getPublicBookById } from '@/lib/actions/public-catalog';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminTableShell } from '@/components/admin/AdminTableShell';
import { StudentBookDetailClient } from './StudentBookDetailClient';
import { Skeleton } from '@/components/ui/skeleton';

function BookDetailSkeleton() {
  return (
    <div className="grid gap-4 p-4 md:grid-cols-[200px_1fr] md:p-6 animate-pulse">
      <div className="space-y-3">
        <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-muted"></div>
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="space-y-4">
        <div>
          <Skeleton className="h-8 w-64 rounded" />
          <Skeleton className="mt-2 h-4 w-48 rounded" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-md border border-border p-3 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function StudentBookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  // Initiate fetch concurrently, don't await
  const bookPromise = getPublicBookById(id);

  return (
    <AdminTableShell
      title="Book Details"
      description="View metadata and shelf availability for this catalog entry."
      headerActions={
        <Button asChild variant="outline" className="h-8 px-3 text-xs">
          <Link href="/student-catalog">
            <ChevronLeft className="mr-1 h-3.5 w-3.5" />
            Back
          </Link>
        </Button>
      }
    >
      <Suspense fallback={<BookDetailSkeleton />}>
        <StudentBookDetailClient bookPromise={bookPromise} id={id} />
      </Suspense>
    </AdminTableShell>
  );
}
