import { getUserRole } from '@/lib/auth-helpers';
import { createClient } from '@/lib/supabase/server';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

export const metadata = {
  title: "Admin Dashboard | Lumina LMS",
};

async function AdminContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return redirect('/login');
  }

  const role = await getUserRole();

  return (
    <Card className="w-full max-w-2xl border-zinc-200/70 shadow-sm">
      <CardHeader className="space-y-3">
        <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-[10px] uppercase tracking-widest">
          Admin Route
        </Badge>
        <CardTitle className="text-2xl tracking-tight">Control Center Access</CardTitle>
        <CardDescription className="text-sm">
          This page is restricted to users with administrative privileges.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Access verified</AlertTitle>
          <AlertDescription>
            Signed in as <span className="font-medium">{user.email}</span> with role <span className="font-medium">{role}</span>.
          </AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter>
        <Button asChild>
          <Link href="/dashboard">Go to Main Dashboard</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function AdminTestPage() {
  return (
    <div className="flex-1 w-full flex flex-col gap-8 items-center p-4 sm:p-6 md:p-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-zinc-500">Permissions and environment access validation.</p>
      </div>
      <Suspense fallback={<Card className="w-full max-w-2xl"><CardContent className="p-6 text-sm text-zinc-500">Loading user data...</CardContent></Card>}>
        <AdminContent />
      </Suspense>
    </div>
  );
}

