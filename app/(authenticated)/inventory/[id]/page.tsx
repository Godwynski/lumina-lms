import { notFound, redirect } from 'next/navigation';
import { getMe } from '@/lib/auth-helpers';
import { hasPermission, isAccessBlocked } from '@/lib/auth/permissions';
import { getBookAdminDetails } from '@/lib/actions/catalog';
import { InventoryBookDetailClient } from './InventoryBookDetailClient';

export const metadata = { title: 'Inventory Book Details' };

const BOOK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InventoryBookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!me) redirect('/');

  if (isAccessBlocked(me.profile) || !hasPermission(me.role, {
    href: '/inventory', label: 'Inventory', minRole: 'library_staff', permissionKey: 'manage_inventory',
  }, me.profile)) {
    redirect('/dashboard');
  }

  const { id } = await params;
  if (!BOOK_ID.test(id)) notFound();

  const { book, copies, queue } = await getBookAdminDetails(id);
  if (!book) notFound();

  return (
    <div className="w-full min-w-0 max-w-5xl">
      <InventoryBookDetailClient
        key={id}
        initialBook={book}
        initialCopies={copies}
        initialQueue={queue}
        canManage={me.role === 'super_admin' || me.role === 'librarian'}
      />
    </div>
  );
}
