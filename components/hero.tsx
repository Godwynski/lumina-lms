'use client';

import type { User } from '@supabase/supabase-js';
import { m } from "framer-motion";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, ShieldCheck, BookOpen, UserCheck, GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MicrosoftIcon } from '@/components/ui/microsoft-icon';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function Hero({ user, role }: { user: User | null; role: string | null }) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null);
  const router = useRouter();

  const handleMicrosoftLogin = async () => {
    const supabase = createClient();
    setIsLoading(true);
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

  const signInWithCredentials = async (email: string) => {
    const supabase = createClient();
    setIsLoading(true);
    setLoadingEmail(email);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: "Password123!",
      });
      if (error) throw error;
      toast.success('Successfully logged in!');
      router.push("/dashboard");
      router.refresh();
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid credentials';
      toast.error(`Login failed: ${errorMessage}`);
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
      className="flex flex-col items-center justify-center text-center max-w-4xl mx-auto py-12 md:py-24"
    >

      <m.div variants={itemVariants} className="space-y-6 mb-10 w-full">
        <h1 className="text-balance text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl md:text-7xl">
          {user ? (
            <>Welcome back, <br className="hidden sm:block"/><span className="text-muted-foreground">{user.user_metadata?.full_name || user.email?.split('@')[0]}</span>.</>
          ) : (
            <>Intelligent Library Operations for the <span className="text-muted-foreground">Modern Era.</span></>
          )}
        </h1>
        <p className="text-balance text-lg text-muted-foreground sm:text-xl md:max-w-2xl mx-auto">
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

            {/* Hide the demo access buttons on the landing page */}
            {true && (
              <div className="w-full space-y-4 mt-2">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="bg-background px-4 text-muted-foreground/60">Quick Demo Access</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 w-full">
                  {[
                    { label: "super_admin", email: "admin@lumina.test", icon: ShieldCheck, color: "hover:border-emerald-500/50 hover:bg-emerald-500/[0.04] hover:text-emerald-500 dark:hover:text-emerald-400" },
                    { label: "Librarian", email: "librarian@lumina.test", icon: BookOpen, color: "hover:border-indigo-500/50 hover:bg-indigo-500/[0.04] hover:text-indigo-500 dark:hover:text-indigo-400" },
                    { label: "Staff", email: "staff@lumina.test", icon: UserCheck, color: "hover:border-sky-500/50 hover:bg-sky-500/[0.04] hover:text-sky-500 dark:hover:text-sky-400" },
                    { label: "Student", email: "student@lumina.test", icon: GraduationCap, color: "hover:border-amber-500/50 hover:bg-amber-500/[0.04] hover:text-amber-500 dark:hover:text-amber-400" },
                  ].map((roleItem) => {
                    const Icon = roleItem.icon;
                    const isThisLoading = loadingEmail === roleItem.email;
                    return (
                      <Button
                        key={roleItem.email}
                        type="button"
                        variant="outline"
                        className={`h-12 rounded-xl border border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground transition-all duration-300 flex items-center justify-start px-4 gap-2.5 ${roleItem.color}`}
                        onClick={() => signInWithCredentials(roleItem.email)}
                        disabled={isLoading}
                      >
                        {isThisLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                        ) : (
                          <Icon className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:scale-110" />
                        )}
                        <span>{isThisLoading ? "Signing in..." : roleItem.label}</span>
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
