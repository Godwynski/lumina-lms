import { getMe } from '@/lib/auth-helpers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

async function CatalogGuard({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect('/');
  
  const { role, profile } = me;

  if (!['admin', 'librarian', 'student_assistant'].includes(role)) {
    redirect('/student-catalog');
  }

  // Security check for Student Assistants
  if (role === 'student_assistant') {
    if (profile.status?.toUpperCase() !== 'ACTIVE' || !profile.permissions?.manage_inventory) {
      redirect('/student-catalog');
    }
  }

  return <>{children}</>;
}

export default function CatalogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 w-full bg-muted rounded" /></div>}>
      <CatalogGuard>
        {children}
      </CatalogGuard>
    </Suspense>
  );
}
