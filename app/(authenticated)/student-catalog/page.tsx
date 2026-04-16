import { Suspense } from 'react';
import { getPublicBooksCached, getCategoriesCached } from '@/lib/actions/public-catalog';
import { getMyReservations } from '@/lib/actions/reservations';
import { StudentCatalogClient } from './StudentCatalogClient';
import { Skeleton } from '@/components/ui/skeleton';

function CatalogSkeletonView() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-4 w-96 rounded-md opacity-40" />
      </div>
      <div className="h-12 w-full rounded-xl border border-border/40 bg-muted/20" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 w-full rounded-xl border border-border/40 bg-muted/10" />
        ))}
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Catalog | Lumina LMS',
  description: 'Browse the library catalog and check real-time availability.',
};

async function StudentCatalogLoader({
  searchParams,
}: {
  searchParams: Promise<{ 
    q?: string;
    category?: string;
    available?: string;
    page?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q || '';
  const categoryId = params.category || '';
  const availableOnly = params.available === 'true';
  const page = parseInt(params.page || '1', 10);
  const sortBy = (params.sort as 'title' | 'author' | 'availability') || 'title';
  const pageSize = 16;

  // Initiate all fetches concurrently so they run in parallel
  const booksPromise = getPublicBooksCached(q, categoryId, '', availableOnly, page, pageSize, sortBy);
  const categoriesPromise = getCategoriesCached();
  const reservationsPromise = getMyReservations();

  return (
    <StudentCatalogClient 
      booksPromise={booksPromise} 
      categoriesPromise={categoriesPromise}
      reservationsPromise={reservationsPromise}
      initialFilters={{
        q,
        categoryId,
        availableOnly,
        page,
        sortBy
      }}
    />
  );
}

export default function StudentCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    q?: string;
    category?: string;
    available?: string;
    page?: string;
    sort?: string;
  }>;
}) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<CatalogSkeletonView />}>
        <StudentCatalogLoader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
