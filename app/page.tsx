import { EnvVarWarning } from "@/components/env-var-warning";
import { Logo } from "@/components/layout/Logo";
import { AuthButton } from "@/components/auth/AuthButton";
import { Hero } from "@/components/hero";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Lumina LMS | Global Library Platform",
};

async function HeroSection() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = user ? await getUserRole() : null;
  return <Hero user={user} role={role} />;
}

export default async function Home() {
  noStore();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-background selection:bg-muted/40 overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] opacity-30 [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]"></div>
      
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-50 flex h-20 w-full justify-center border-b border-border/40 bg-background/60 backdrop-blur-xl transition-all duration-300">
          <div className="flex w-full max-w-7xl items-center justify-between px-6 md:px-10">
            <div className="flex items-center gap-4 text-xl font-black tracking-tighter">
              <Logo size={22} className="rotate-3" />
              <Link href="/" className="text-foreground hover:opacity-80 transition-opacity">LUMINA</Link>
            </div>
            
            <div className="flex items-center gap-6">
              {!hasEnvVars ? (
                <EnvVarWarning />
              ) : (
                <Suspense fallback={<Skeleton className="h-10 w-28 rounded-full" />}>
                  <AuthButton />
                </Suspense>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center">
          <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><Skeleton className="h-96 w-full max-w-4xl rounded-3xl" /></div>}>
            <HeroSection />
          </Suspense>
        </div>

      </div>
    </main>
  );
}

