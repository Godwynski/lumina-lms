import { getBooks, getCategories } from '@/lib/actions/catalog';
import { Suspense } from 'react';
import { CatalogContent, CatalogSkeleton } from './CatalogContent';

export const metadata = {
  title: 'Inventory | Lumina LMS',
  description: 'Manage physical book inventory and resources.',
};

// Enable PPR for this route

import { getMe } from '@/lib/auth-helpers';
import { redirect } from 'next/navigation';

async function CatalogDataWrapper({ 
  searchParams 
}: { 
  searchParams: Promise<{ page?: string; q?: string; stock?: string; categoryId?: string }> 
}) {
  const me = await getMe();
  if (me?.role === 'admin' || me?.role === 'librarian') {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const q = params.q || '';
  const stock = params.stock || 'all';
  const categoryId = params.categoryId || '';

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
