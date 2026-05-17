import { getMe } from '@/lib/auth-helpers';
import { UserPermissions } from '@/lib/types';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

async function CirculationGuard({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect('/');
  
  const { role, profile } = me;

  if (!['super_admin', 'librarian', 'student_assistant'].includes(role)) {
    redirect('/dashboard');
  }

  // Security check for Student Assistants
  if (role === 'student_assistant') {
    const permissions = profile?.permissions as UserPermissions;
    if (profile.status?.toUpperCase() !== 'ACTIVE' || !permissions?.manage_circulation) {
      console.warn('[CIRCULATION-GUARD] SA Access Denied:', { status: profile.status, hasPerm: !!permissions?.manage_circulation });
      redirect('/dashboard');
    }
  }

  return <>{children}</>;
}

export default function CirculationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div className="p-8 animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 w-full bg-muted rounded" /></div>}>
      <CirculationGuard>
        {children}
      </CirculationGuard>
    </Suspense>
  );
}

