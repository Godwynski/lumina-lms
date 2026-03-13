import { getUserRole } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';

export const metadata = {
  title: "Admin Dashboard | Lumina LMS",
};
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

async function AdminContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/auth/login');
  }

  const role = await getUserRole();

  return (
    <>
      <p>Welcome, {user.email}!</p>
      <div className="p-4 bg-muted rounded-md text-sm">
        <p className="font-semibold text-green-600">You successfully accessed the Admin-only route.</p>
        <p>Your detected role: <strong>{role}</strong></p>
      </div>
    </>
  );
}

export default function AdminTestPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-12 items-center p-8">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <Suspense fallback={<p>Loading user data...</p>}>
        <AdminContent />
      </Suspense>
    </div>
  );
}
