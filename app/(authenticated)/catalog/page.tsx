import { getBooks, getCategories } from '@/lib/actions/catalog';
import { Suspense } from 'react';
import { CatalogContent, CatalogSkeleton } from './CatalogContent';
import { getMe } from '@/lib/auth-helpers';

export const metadata = {
  title: 'Inventory | Lumina LMS',
  description: 'Manage physical book inventory and resources.',
};

// Synchronous page shell — searchParams is a Promise in Next.js 15.
// We pass it to an async server component that only awaits URL params (no DB).
export default function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; stock?: string; categoryId?: string; status?: string }>;
}) {
  return (
    <div className="space-y-4">
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogDataWrapper searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// Awaits only searchParams (URL params, no network) then fires DB queries
// as non-blocking promises. getMe() is cache()-memoized — zero extra round-trip.
async function CatalogDataWrapper({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; stock?: string; categoryId?: string; status?: string }>;
}) {
  const me = await getMe();
  const canManage = me?.role === 'admin' || me?.role === 'librarian' || me?.role === 'student_assistant';
  
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const q = params.q || '';
  const stock = params.stock || 'all';
  const categoryId = params.categoryId || '';
  const status = (params.status?.toUpperCase() as 'ACTIVE' | 'ARCHIVED' | 'ALL') || 'ACTIVE';

  // Both kick off in parallel — neither is awaited here
  const categoriesPromise = getCategories();
  const dataPromise = getBooks(q, categoryId || undefined, page, 12, 'newest', status);

  return (
    <CatalogContent
      dataPromise={dataPromise}
      categories={await categoriesPromise}
      page={page}
      q={q}
      stock={stock}
      categoryId={categoryId}
      canManage={canManage}
    />
  );
}
