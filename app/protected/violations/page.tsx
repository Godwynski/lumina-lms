import { Suspense } from 'react'
import { getViolations } from '@/lib/actions/violations'
import ViolationsClient from './ViolationsClient'
import { Skeleton } from '@/components/ui/skeleton'

export default async function ViolationsPage() {
  const { violations, stats } = await getViolations()

  return (
    <Suspense fallback={<ViolationsSkeleton />}>
      <ViolationsClient initialViolations={violations} initialStats={stats} />
    </Suspense>
  )
}

function ViolationsSkeleton() {
  return (
    <div className="w-full space-y-4 pb-4">
      <div className="border-b border-border pb-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}
