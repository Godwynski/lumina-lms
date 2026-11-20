'use client';

import { CirculationWizard } from '@/components/circulation/CirculationWizard';
import { Skeleton } from '@/components/ui/skeleton';

export default function CirculationPage() {
  return (
    <div className="w-full space-y-6">
      <CirculationWizard />
    </div>
  );
}

export function CirculationPageSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="flex justify-between items-center border-b pb-2.5">
        <Skeleton className="h-10 w-48 rounded-xl ml-auto" />
      </div>
      <div className="grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-3 h-64 bg-muted rounded-2xl" />
        <div className="lg:col-span-9 h-96 bg-muted rounded-2xl" />
      </div>
    </div>
  );
}
