import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/auth-helpers';
import { isStaff } from '@/lib/auth/permissions';
import { AddBookClient } from './AddBookClient';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata = { title: "Add book" };

async function AddBookGate() {
  const me = await getMe();
  if (!me) {
    redirect('/');
  }

  const hasInventoryAccess = me.role === 'library_staff'
    ? me.profile?.permissions?.manage_inventory === true
    : true;

  if (!isStaff(me.role, me.profile) || !hasInventoryAccess) {
    redirect('/dashboard');
  }

  return <AddBookClient />;
}

export default function AddBookPage() {
  return (
    <div className="w-full space-y-6">
      
      <Suspense fallback={<AddBookSkeleton />}>
        <AddBookGate />
      </Suspense>
    </div>
  );
}

export function AddBookSkeleton() {
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
