import { getBooks, getCategories } from '@/lib/actions/catalog';
import { Suspense } from 'react';
import { CatalogContent, CatalogSkeleton } from './CatalogContent';
import { getMe } from '@/lib/auth-helpers';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Inventory | Lumina LMS',
  description: 'Manage physical book inventory and resources.',
};

// Synchronous page shell — searchParams is a Promise in Next.js 15.
// We pass it to an async server component that only awaits URL params (no DB).
export default function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; stock?: string; categoryId?: string }>;
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
  searchParams: Promise<{ page?: string; q?: string; stock?: string; categoryId?: string }>;
}) {
  // Auth redirect — uses cache()-memoized getMe() shared with the layout
  const me = await getMe();
  if (me?.role === 'admin' || me?.role === 'librarian') {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const q = params.q || '';
  const stock = params.stock || 'all';
  const categoryId = params.categoryId || '';

  // Both kick off in parallel — neither is awaited here
  const categoriesPromise = getCategories();
  const dataPromise = getBooks(q, categoryId || undefined, page, 9);

  return (
    <CatalogContent
      dataPromise={dataPromise}
      categories={await categoriesPromise}
      page={page}
      q={q}
      stock={stock}
      categoryId={categoryId}
    />
  );
}
