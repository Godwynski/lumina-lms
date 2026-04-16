import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

async function CirculationGuard({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "librarian", "staff"].includes(String(profile.role))) {
    redirect("/dashboard");
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

