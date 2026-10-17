import { getMe } from '@/lib/auth-helpers';
import { redirect } from 'next/navigation';

async function CatalogGuard({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect('/');
  
  const { role } = me;

  if (['super_admin', 'librarian'].includes(role)) {
    redirect('/inventory');
  }

  // If student or student_assistant, maybe they should go to student-catalog
  redirect('/student-catalog');

  return <>{children}</>;
}

export default function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CatalogGuard>
      {children}
    </CatalogGuard>
  );
}
