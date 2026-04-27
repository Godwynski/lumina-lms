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
import { SystemAnnouncement } from '@/components/admin/system-announcement';
import { LibraryMaintenance } from '@/components/admin/library-maintenance';
import { CategoryManagement } from '@/components/admin/CategoryManagement';
import { getCategories } from '@/lib/actions/catalog';

export const metadata = {
  title: "Admin Control Center | Lumina LMS",
};

async function AdminContent() {
  const me = await getMe();

  if (!me) {
    return redirect('/login');
  }

  const { user, role } = me;
  const categories = await getCategories();

  return (
    <Card className="w-full max-w-3xl border-border/40 bg-card/20 shadow-none backdrop-blur-sm rounded-[2rem]">
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
        <div className="space-y-2">
          <CardTitle className="text-3xl font-black tracking-tighter text-foreground">Control Center</CardTitle>
          <CardDescription className="text-sm font-bold text-muted-foreground/60 uppercase tracking-widest">
            Secure Infrastructure Gateway
          </CardDescription>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="p-6 rounded-2xl bg-muted/20 border border-border/40 flex items-start gap-4 backdrop-blur-sm">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 shadow-inner">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-foreground">Identity Verified</h4>
            <p className="text-xs font-medium text-muted-foreground leading-relaxed">
              Active session for <span className="font-black text-foreground">{user.email}</span> with <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">{role}</span> privileges.
            </p>
          </div>
        </div>

        <div className="space-y-12">
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <SystemAnnouncement />
          </section>
          
          <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />

          <section className="animate-in fade-in slide-in-from-bottom-2 duration-700">
            <LibraryMaintenance />
          </section>

          <div className="h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
          
          <section className="animate-in fade-in slide-in-from-bottom-2 duration-1000">
            <CategoryManagement initialCategories={categories as { id: string; name: string; slug: string; description?: string; is_active: boolean }[]} />
          </section>

          <div className="pt-8 border-t border-border/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 rounded-2xl border border-dashed border-border/40 bg-muted/5 opacity-50 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <h5 className="text-sm font-black uppercase tracking-widest text-muted-foreground/80 mb-2">User Management</h5>
                    <p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-tighter">Module Offline • v2.0 Pending</p>
                </div>
                <div className="p-6 rounded-2xl border border-dashed border-border/40 bg-muted/5 opacity-50 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <h5 className="text-sm font-black uppercase tracking-widest text-muted-foreground/80 mb-2">System Logs</h5>
                    <p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-tighter">Module Offline • v2.0 Pending</p>
                </div>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-6 border-t border-border/20 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">ENV: production</p>
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
    <div className="flex-1 w-full flex flex-col items-center justify-center min-h-[70vh] p-4 md:p-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-black tracking-tighter text-foreground">Infrastructure Gateway</h1>
        <p className="text-sm font-bold text-muted-foreground/60 uppercase tracking-widest">Administrative Control & Oversight</p>
      </div>

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
