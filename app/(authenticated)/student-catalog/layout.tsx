import { getMe } from '@/lib/auth-helpers';
import { redirect } from 'next/navigation';

export default async function StudentCatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await getMe();
  
  if (me && ['super_admin', 'librarian'].includes(me.role)) {
    redirect('/inventory');
  }

  return <>{children}</>;
}
