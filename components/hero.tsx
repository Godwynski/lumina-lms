'use client';

import type { User } from '@supabase/supabase-js';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MicrosoftIcon } from '@/components/ui/microsoft-icon';
import { toast } from 'sonner';

/** Sign-in actions for the landing page. The headline and copy are static in app/page.tsx. */
export function Hero({ user, role }: { user: User | null; role: string | null }) {
  const [isLoading, setIsLoading] = useState(false);

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
        {isLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <MicrosoftIcon />
        )}
        <span>{isLoading ? "Redirecting..." : "Sign in with Microsoft"}</span>
      </Button>


    </div>
  );
}
