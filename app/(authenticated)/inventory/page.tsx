import { getBooks, getCategories } from '@/lib/actions/catalog';
import { Suspense } from 'react';
import { getMe } from '@/lib/auth-helpers';
import { redirect } from 'next/navigation';
import { LiveActivityTicker } from '@/components/dashboard/LiveActivityTicker';
import { CatalogContent, CatalogSkeleton } from '../catalog/CatalogContent';

export const metadata = {
  title: 'Inventory | Lumina LMS',
  description: 'Manage physical book inventory and resources.',
};

export default function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; stock?: string; categoryId?: string; status?: string }>;
}) {
  return (
    <div className="space-y-4 pb-14 overflow-x-hidden relative">
      <LiveActivityTicker />
      <Suspense fallback={<CatalogSkeleton />}>
        <InventoryDataWrapper searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function InventoryDataWrapper({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; stock?: string; categoryId?: string; status?: string }>;
}) {
  const me = await getMe();
  if (!me) {
    redirect('/');
  }

  const role = me.role;
  const isDeactivatedSA = role === 'student_assistant' && me.profile?.status?.toUpperCase() !== 'ACTIVE';
  const hasAnyPermission = role === 'student_assistant'
    ? !!(me.profile?.permissions?.manage_circulation || me.profile?.permissions?.manage_attendance || me.profile?.permissions?.view_admin_dashboard)
    : true;

  const isStaff = role === 'admin' || role === 'librarian' || (role === 'student_assistant' && !isDeactivatedSA && hasAnyPermission);

  if (!isStaff) {
    redirect('/dashboard');
  }

  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const q = params.q || '';
  const stock = params.stock || 'all';
  const categoryId = params.categoryId || '';
  const status = (params.status?.toUpperCase() as 'ACTIVE' | 'ARCHIVED' | 'ALL') || 'ACTIVE';

  const categoriesPromise = getCategories();
  const dataPromise = getBooks(q, categoryId || undefined, page, 12, 'newest', status);

  return (
    <CatalogContent
      dataPromise={dataPromise}
      categories={await categoriesPromise}
      page={page}
      q={q}
      stock={stock}
      categoryId={categoryId}
      canManage={role === 'admin' || role === 'librarian'}
    />
  );
}
