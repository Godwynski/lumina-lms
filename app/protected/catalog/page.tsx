import { getBooks, getCategories } from '@/lib/actions/catalog';
import { Suspense } from 'react';
import { CatalogContent, CatalogSkeleton } from './CatalogContent';

export const metadata = {
  title: 'Inventory | Lumina LMS',
  description: 'Manage physical book inventory and resources.',
};

export const dynamic = 'force-dynamic';

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; stock?: string; categoryId?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const q = params.q || '';
  const stock = params.stock || 'all';
  const categoryId = params.categoryId || '';

  // Prefetch data on the server for faster initial paint
  const [{ data, count }, categories] = await Promise.all([
    getBooks(q, categoryId || undefined, page, 9),
    getCategories()
  ]);
  const initialData = { data, count: count || 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Inventory Workspace</h1>
        <p className="text-muted-foreground">Manage and track library resources, copies, and conditions.</p>
      </div>

      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogContent 
          initialData={initialData} 
          categories={categories}
          page={page} 
          q={q} 
          stock={stock} 
          categoryId={categoryId}
        />
      </Suspense>
    </div>
  );
}
