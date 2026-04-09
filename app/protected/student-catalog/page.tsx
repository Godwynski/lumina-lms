import { Suspense } from 'react';
import { getPublicBooksCached, getCategoriesCached } from '@/lib/actions/public-catalog';
import { StudentCatalogClient } from './StudentCatalogClient';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = {
  title: 'Catalog | Lumina LMS',
  description: 'Browse the library catalog and check real-time availability.',
};

async function CatalogDataFetcher({ q }: { q: string }) {
  // Fetch initial data on the server for instant First Paint
  const [booksData, categories] = await Promise.all([
    getPublicBooksCached(q, '', '', false, 1, 16, 'title'),
    getCategoriesCached()
  ]);

  return (
    <StudentCatalogClient 
      initialBooks={booksData.books} 
      initialTotal={booksData.total} 
      categories={categories}
      initialQuery={q}
    />
  );
}

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

export default async function StudentCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = params.q || '';

  return (
    <div className="space-y-6">
      <Suspense fallback={<CatalogSkeletonView />}>
        <CatalogDataFetcher q={q} />
      </Suspense>
    </div>
  );
}
