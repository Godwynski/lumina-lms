'use client';

import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen, GraduationCap, Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { MicrosoftIcon } from '@/components/ui/microsoft-icon';
import { toast } from 'sonner';
import { DEMO_ACCOUNTS } from '@/lib/demo/accounts';

// Only labels and emails live in the browser. Passwords stay on the server (/api/demo-login).
const DEMO_ICONS = { super_admin: ShieldCheck, librarian: BookOpen, student_assistant: UserCheck, student: GraduationCap };
const DEMO_BUTTONS = DEMO_ACCOUNTS.map(({ label, email, role }) => ({ label, email, icon: DEMO_ICONS[role] }));

/** Sign-in actions for the landing page. The headline and copy are static in app/page.tsx. */
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

  if (user) {
    return (
      <div className="space-y-3">
        <Button asChild size="lg" className="h-auto min-h-12 w-full whitespace-normal py-3">
          <Link href="/dashboard">
            Go to Dashboard
            <ArrowRight />
          </Link>
        </Button>
        <p className="break-words text-sm text-muted-foreground">
          Signed in as {user.user_metadata?.full_name || user.email?.split('@')[0]} with the {role} role.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Button
        type="button"
        size="lg"
        className="h-auto min-h-12 w-full gap-3 whitespace-normal py-3 focus-visible:transition-none"
        onClick={handleMicrosoftLogin}
        disabled={isLoading}
      >
        {isLoading && !loadingEmail ? (
          <Loader2 className="animate-spin" />
        ) : (
          <MicrosoftIcon />
        )}
        <span>{isLoading && !loadingEmail ? "Redirecting..." : "Sign in with Microsoft"}</span>
      </Button>

      {showDemo && (
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-2xs font-bold uppercase tracking-widest">
              <span className="bg-background px-4 text-muted-foreground">Quick Demo Access</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {DEMO_BUTTONS.map((item) => {
              const Icon = item.icon;
              const isThisLoading = loadingEmail === item.email;
              return (
                <Button
                  key={item.email}
                  type="button"
                  variant="outline"
                  className="h-11 justify-start gap-2.5 px-3.5 text-2xs font-bold uppercase tracking-wider text-muted-foreground"
                  onClick={() => signInDemo(item.email)}
                  disabled={isLoading}
                >
                  {isThisLoading ? <Loader2 className="animate-spin" /> : <Icon />}
                  <span className="truncate">{isThisLoading ? 'Signing in...' : item.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
