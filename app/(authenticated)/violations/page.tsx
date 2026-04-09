import { Suspense } from 'react'
import { getViolations } from '@/lib/actions/violations'
import ViolationsClient from './ViolationsClient'
import { Skeleton } from '@/components/ui/skeleton'
import { getUserRole } from '@/lib/auth-helpers'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Violations & Enforcement | Lumina LMS',
  description: 'Manage and track student conduct and library violations.',
}

// Enable PPR for this route

async function ViolationsDataWrapper() {
  const { violations, stats, role } = await getViolations()
  
  return (
    <ViolationsClient 
      initialViolations={violations || []} 
      initialStats={stats} 
      role={role}
    />
  )
}

export default async function ViolationsPage() {
  const role = await getUserRole()
  
  if (role === 'student') {
    return redirect('/dashboard')
  }

  return (
    <div className="w-full space-y-4 pb-4">
      <Suspense fallback={<ViolationsSkeleton />}>
        <ViolationsDataWrapper />
      </Suspense>
    </div>
  )
}

function ViolationsSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="border-b border-border pb-6">
        <Skeleton className="h-9 w-64 rounded-lg bg-muted/60" />
        <Skeleton className="mt-2 h-4 w-96 rounded-md bg-muted/40" />
      </div>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl border border-border/40 bg-muted/20" />
        ))}
      </div>
      <div className="rounded-2xl border border-border/40 bg-muted/10 h-96 shadow-inner" />
    </div>
  )
}

