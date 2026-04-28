import { EnvVarWarning } from "@/components/env-var-warning";
import { Logo } from "@/components/layout/Logo";
import { AuthButton } from "@/components/auth/AuthButton";
import { Hero } from "@/components/hero";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import { getMe } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Lumina LMS | Global Library Platform",
};

async function HeroSection() {
  const me = await getMe();
  return <Hero user={me?.user ?? null} role={me?.role ?? null} />;
}

async function AuthRedirect() {
  const me = await getMe();

  if (me?.user) {
    return redirect("/dashboard");
  }
  return null;
}

export default function Home() {
  return (
    <main className="min-h-screen bg-background selection:bg-muted/40 overflow-x-hidden">
      <Suspense fallback={null}>
        <AuthRedirect />
      </Suspense>
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
          <Suspense fallback={
            <div className="min-h-[70vh] w-full flex flex-col items-center justify-center gap-8 px-6">
              <Skeleton className="h-16 w-[300px] sm:w-[500px] rounded-2xl opacity-20" />
              <Skeleton className="h-6 w-[250px] sm:w-[400px] rounded-xl opacity-10" />
              <div className="flex gap-4">
                <Skeleton className="h-12 w-32 rounded-full opacity-20" />
                <Skeleton className="h-12 w-32 rounded-full opacity-10" />
              </div>
            </div>
          }>
            <HeroSection />
          </Suspense>
        </div>

      </div>
    </main>
  );
}

