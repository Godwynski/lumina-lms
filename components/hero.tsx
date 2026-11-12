'use client';

import type { User } from '@supabase/supabase-js';
import { m } from "framer-motion";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, GraduationCap, Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MicrosoftIcon } from '@/components/ui/microsoft-icon';
import { toast } from 'sonner';

// Only labels and emails live in the browser. Passwords stay on the server (/api/demo-login).
const DEMO_BUTTONS = [
  { label: 'Super Admin', email: 'admin@lumina.test', icon: ShieldCheck },
  { label: 'Librarian', email: 'librarian@lumina.test', icon: BookOpen },
  { label: 'Staff', email: 'staff@lumina.test', icon: UserCheck },
  { label: 'Student', email: 'student@lumina.test', icon: GraduationCap },
];

export function Hero({ user, role, showDemo = false }: { user: User | null; role: string | null; showDemo?: boolean }) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const router = useRouter();

  const handleMicrosoftLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          scopes: "email profile",
          redirectTo: `${window.location.origin}/callback`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      console.error(error);
      toast.error('Microsoft sign-in failed');
      setIsLoading(false);
    }
  };

  const signInDemo = async (email: string) => {
    if (isLoading) return;
    setIsLoading(true);
    setLoadingEmail(email);
    try {
      const res = await fetch('/api/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Demo sign-in is unavailable');
      }
      toast.success('Successfully logged in!');
      router.push('/dashboard');
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Demo sign-in failed');
      setIsLoading(false);
      setLoadingEmail(null);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8 } }
  };

  return (
    <m.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center justify-center text-center max-w-4xl mx-auto py-8 sm:py-12 md:py-16"
    >

      <m.div variants={itemVariants} className="space-y-4 sm:space-y-6 mb-8 sm:mb-10 w-full">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          {user ? (
            <>Welcome back, <br className="hidden sm:block"/><span className="text-muted-foreground">{user.user_metadata?.full_name || user.email?.split('@')[0]}</span>.</>
          ) : (
            <>Intelligent Library Operations for the <span className="text-muted-foreground">Modern Era.</span></>
          )}
        </h1>
        <p className="text-balance text-base text-muted-foreground sm:text-lg md:max-w-2xl mx-auto">
          {user ? (
            `You are signed in with the ${role} role and have access to your workspace.`
          ) : (
            'Streamline physical and digital resource management with role-based access, smart circulation, and unified identity.'
          )}
        </p>
      </m.div>

      <m.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 items-center w-full max-w-md">
        {user ? (
          <div className="flex justify-center w-full">
            <Button asChild size="lg" className="rounded-full font-semibold shadow-md px-8 h-12">
              <Link href="/dashboard">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 items-center w-full">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 w-full rounded-xl text-sm font-semibold flex items-center justify-center gap-3 border-input bg-background text-foreground hover:bg-muted shadow-sm transition-all"
              onClick={handleMicrosoftLogin}
              disabled={isLoading}
            >
              {isLoading && !loadingEmail ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <MicrosoftIcon className="h-5 w-5" />
              )}
              <span>{isLoading && !loadingEmail ? "Redirecting..." : "Sign in with Microsoft"}</span>
            </Button>

            {showDemo && (
              <div className="w-full space-y-4 mt-2">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-[11px] font-bold uppercase tracking-widest">
                    <span className="bg-background px-4 text-muted-foreground">Quick Demo Access</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full">
                  {DEMO_BUTTONS.map((item) => {
                    const Icon = item.icon;
                    const isThisLoading = loadingEmail === item.email;
                    return (
                      <Button
                        key={item.email}
                        type="button"
                        variant="outline"
                        className="group h-11 sm:h-12 rounded-xl border border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all duration-200 flex items-center justify-start px-3.5 sm:px-4 gap-2.5 active:scale-[0.98]"
                        onClick={() => signInDemo(item.email)}
                        disabled={isLoading}
                      >
                        {isThisLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                        ) : (
                          <Icon className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:scale-110" />
                        )}
                        <span className="truncate">{isThisLoading ? 'Signing in...' : item.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </m.div>
    </m.div>
  );
}
