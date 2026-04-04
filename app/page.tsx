import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth/AuthButton";
import { Hero } from "@/components/hero";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BookOpen, UserCircle, QrCode } from "lucide-react";

export const metadata = {
  title: "Home | Lumina LMS",
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
    return redirect("/protected");
  }

  return (
    <main className="min-h-screen bg-background selection:bg-muted">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] opacity-30 [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
      
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-50 flex h-16 w-full justify-center border-b border-border/50 bg-background/75 backdrop-blur-lg transition-all duration-300">
          <div className="flex w-full max-w-6xl items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-3 text-lg font-extrabold tracking-tight">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm text-primary-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                </svg>
              </div>
              <Link href="/" className="text-foreground transition-colors hover:text-muted-foreground">Lumina</Link>
            </div>
            <div className="flex items-center gap-4">
              {!hasEnvVars ? (
                <EnvVarWarning />
              ) : (
                <Suspense fallback={<div className="h-9 w-24 animate-pulse rounded-full bg-muted" />}>
                  <AuthButton />
                </Suspense>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center gap-8 md:gap-16 px-4 py-8 md:px-6 md:py-16">
          <Suspense fallback={<Hero user={null} role={null} />}>
            <HeroSection />
          </Suspense>

          <section className="w-full max-w-5xl space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 fill-mode-both pb-12">
            <h2 className="text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Core Capabilities</h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="border-border/60 bg-card/70 backdrop-blur-xl shadow-sm hover:shadow-md hover:border-border transition-all duration-300 rounded-2xl">
                <CardHeader className="pb-4">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground ring-1 ring-border/50">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground">Unified Catalog</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground leading-relaxed font-medium">
                  Manage physical books and digital assets with advanced search and real-time availability tracking.
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/70 backdrop-blur-xl shadow-sm hover:shadow-md hover:border-border transition-all duration-300 rounded-2xl">
                <CardHeader className="pb-4">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground ring-1 ring-border/50">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground">Smart Circulation</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground leading-relaxed font-medium">
                  Automated borrowing, returns, and penalty tracking with transparent operational history.
                </CardContent>
              </Card>

              <Card className="border-border/60 bg-card/70 backdrop-blur-xl shadow-sm hover:shadow-md hover:border-border transition-all duration-300 rounded-2xl sm:col-span-2 lg:col-span-1">
                <CardHeader className="pb-4">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-foreground ring-1 ring-border/50">
                    <UserCircle className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-xl font-bold text-foreground">Digital Identity</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground leading-relaxed font-medium">
                  Fully integrated digital library cards with QR scanning for seamless student interactions.
                </CardContent>
              </Card>
            </div>
          </section>
        </div>

        <footer className="w-full border-t border-border/60 bg-transparent py-8 text-center text-sm font-medium text-muted-foreground">
          <p>Built with Next.js and Supabase</p>
        </footer>
      </div>
    </main>
  );
}
