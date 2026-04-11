'use client';

import { use } from 'react';
import { Book, Category } from '@/lib/types';
import dynamic from 'next/dynamic';

const ModernInventoryClient = dynamic(() => import('@/components/inventory/ModernInventoryClient').then(mod => mod.ModernInventoryClient), {
  ssr: false,
  loading: () => <CatalogSkeleton />,
});

interface CatalogContentProps {
  dataPromise: Promise<{ data: Book[]; count: number }>;
  categories: Category[];
  page: number;
  q: string;
  stock: string;
  categoryId: string;
}

export function CatalogSkeleton() {
  return (
    <div className="w-full space-y-4 pb-5 md:pb-7 animate-pulse">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm h-16 w-full" />
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm h-12 w-1/2" />
      <div className="space-y-2 mt-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 w-full rounded-lg bg-muted border border-border" />
        ))}
      </div>
    </div>
  );
}

export function CatalogContent({ dataPromise, categories }: CatalogContentProps) {
  const data = use(dataPromise);

  const books = data?.data || [];
  const totalCount = data?.count || 0;
  
  return (
    <div className="w-full">
      <ModernInventoryClient 
        books={books || []} 
        totalItems={totalCount} 
        categories={categories}
      />
    </div>
  );
}
