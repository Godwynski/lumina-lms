'use client';

import { Suspense } from 'react';
import { CirculationWizard } from '@/components/circulation/CirculationWizard';
import { Skeleton } from '@/components/ui/skeleton';

export default function CirculationPage() {
  return (
    <div className="w-full">
      <Suspense fallback={<CirculationPageSkeleton />}>
        <CirculationWizard />
      </Suspense>
    </div>
  );
}

function CirculationPageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
      <div className="flex justify-between items-end border-b pb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-48 rounded-xl" />
      </div>
      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3 h-64 bg-muted rounded-3xl" />
        <div className="lg:col-span-9 h-[500px] bg-muted rounded-3xl" />
      </div>
    </div>
  );
}
