import { getMe } from '@/lib/auth-helpers';
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
import { ShieldCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

export const metadata = {
  title: "Admin Control Center | Lumina LMS",
};

async function AdminContent() {
  const me = await getMe();

  if (!me) {
    return redirect('/login');
  }

  const { user, role } = me;

  return (
    <Card className="w-full max-w-3xl border-zinc-200/70 shadow-lg bg-white/50 backdrop-blur-sm">
      <CardHeader className="space-y-4 pb-8">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="w-fit rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-widest bg-zinc-100/50">
            System Administration
          </Badge>
          <div className="flex -space-x-2">
            <div className="h-8 w-8 rounded-full border-2 border-white bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold">A</div>
            <div className="h-8 w-8 rounded-full border-2 border-white bg-indigo-500 flex items-center justify-center text-[10px] text-white font-bold">L</div>
          </div>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-3xl font-extrabold tracking-tight text-zinc-900">Control Center Access</CardTitle>
          <CardDescription className="text-base text-zinc-500">
            Secure administrative interface for Lumina LMS infrastructure.
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="p-6 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-green-100 text-green-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="font-semibold text-zinc-900">Security Access Verified</h4>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Your identity has been confirmed. You are signed in as <span className="font-semibold text-zinc-900">{user.email}</span> with active <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-200 text-zinc-800">{role}</span> privileges.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-zinc-100 bg-white hover:border-blue-200 hover:shadow-md transition-all group pointer-events-none opacity-60">
                <h5 className="text-sm font-semibold mb-1">User Management</h5>
                <p className="text-xs text-zinc-500">Manage permissions and accounts.</p>
            </div>
            <div className="p-4 rounded-xl border border-zinc-100 bg-white hover:border-blue-200 hover:shadow-md transition-all group pointer-events-none opacity-60">
                <h5 className="text-sm font-semibold mb-1">System Logs</h5>
                <p className="text-xs text-zinc-500">Audit trails and error monitoring.</p>
            </div>
        </div>
      </CardContent>

      <CardFooter className="pt-6 border-t border-zinc-100 flex items-center justify-between">
        <p className="text-xs text-zinc-400">Environment: production</p>
        <Button asChild className="rounded-xl shadow-blue-500/20 shadow-lg">
          <Link href="/dashboard" className="flex items-center gap-2">
            Main Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function AdminPage() {
  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center min-h-[70vh] p-4 md:p-8">
      <Suspense fallback={
        <Card className="w-full max-w-3xl">
          <CardContent className="p-12 flex flex-col items-center justify-center space-y-4">
            <div className="h-10 w-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm text-zinc-500 animate-pulse font-medium">Authenticating Admin Session...</p>
          </CardContent>
        </Card>
      }>
        <AdminContent />
      </Suspense>
    </div>
  );
}
