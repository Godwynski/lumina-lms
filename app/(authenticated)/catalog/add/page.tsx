import { Suspense } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { AddBookClient } from './AddBookClient';
import { Skeleton } from '@/components/ui/skeleton';

export default function AddBookPage() {
  return (
    <div className="w-full space-y-6">
      
      <Suspense fallback={<AddBookSkeleton />}>
        <AddBookClient />
      </Suspense>
    </div>
  );
}

function AddBookSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-[450px] w-full rounded-xl" />
      </div>
    </div>
  );
}
