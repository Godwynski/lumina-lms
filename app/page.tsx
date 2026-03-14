import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { Hero } from "@/components/hero";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
import { RetroGrid } from "@/components/magicui/retro-grid";
import BlurFade from "@/components/magicui/blur-fade";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Home | Lumina LMS",
};

export const dynamic = "force-dynamic";

async function HeroSection() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = user ? await getUserRole() : null;
  return <Hero user={user} role={role} />;
}

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    return redirect("/protected");
  }

  return (
    <main className="min-h-screen flex flex-col items-center bg-zinc-50 text-zinc-900 font-sans selection:bg-indigo-500/30 relative overflow-hidden">
      <RetroGrid className="z-0" />
      <div className="flex-1 w-full flex flex-col items-center">
        {/* Navigation Bar */}
        <nav className="w-full flex justify-center border-b border-zinc-200/50 h-16 bg-white/60 backdrop-blur-xl sticky top-0 z-50">
          <div className="w-full max-w-6xl flex justify-between items-center p-3 px-5">
            <div className="flex gap-3 items-center font-bold text-lg tracking-tight">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
                <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
              </svg>
              <Link href={"/"} className="text-zinc-900 hover:text-indigo-600 transition-colors">Lumina LMS</Link>
            </div>
            
            <div className="flex items-center gap-4">
              {!hasEnvVars ? (
                <EnvVarWarning />
              ) : (
                <Suspense fallback={<div className="h-9 w-24 bg-zinc-100 rounded-md animate-pulse" />}>
                  <AuthButton />
                </Suspense>
              )}
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <div className="flex-1 flex flex-col gap-12 max-w-5xl p-5 mt-16 w-full relative z-10">
          <Suspense fallback={<Hero user={null} role={null} />}>
            <HeroSection />
          </Suspense>
          
          <main className="flex-1 flex flex-col gap-8 px-4 py-8 relative">
            {/* Soft decorative background element for the features area */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-3xl bg-indigo-50/50 blur-3xl -z-10 rounded-full pointer-events-none" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <BlurFade delay={0.4} inView>
                <div className="flex flex-col gap-3 p-6 rounded-2xl border border-zinc-200/60 bg-white/70 backdrop-blur-sm hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 h-full">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                  </div>
                  <h3 className="font-semibold text-lg text-zinc-900">Smart Catalog</h3>
                  <p className="text-zinc-600 text-sm leading-relaxed">Instantly search through thousands of resources with AI-powered tagging and categorization.</p>
                </div>
              </BlurFade>

              <BlurFade delay={0.5} inView>
                <div className="flex flex-col gap-3 p-6 rounded-2xl border border-zinc-200/60 bg-white/70 backdrop-blur-sm hover:border-purple-200 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 h-full">
                  <div className="h-10 w-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  </div>
                  <h3 className="font-semibold text-lg text-zinc-900">Role-Based Access</h3>
                  <p className="text-zinc-600 text-sm leading-relaxed">Secure workflows tailored specifically for Students, Staff, Librarians, and System Administrators.</p>
                </div>
              </BlurFade>

              <BlurFade delay={0.6} inView>
                <div className="flex flex-col gap-3 p-6 rounded-2xl border border-zinc-200/60 bg-white/70 backdrop-blur-sm hover:border-pink-200 hover:shadow-lg hover:shadow-pink-500/10 transition-all duration-300 h-full">
                  <div className="h-10 w-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
                  </div>
                  <h3 className="font-semibold text-lg text-zinc-900">Automated Fines</h3>
                  <p className="text-zinc-600 text-sm leading-relaxed">Keep track of borrowing histories, due dates, and automated fine calculations effortlessly.</p>
                </div>
              </BlurFade>
            </div>
          </main>
        </div>

        {/* Footer */}
        <footer className="w-full flex items-center justify-center border-t border-zinc-200/50 mx-auto text-center text-sm gap-8 py-12 mt-12 bg-white/60 backdrop-blur-xl text-zinc-500 z-10 relative">
          <p>
            Developed with <span className="text-indigo-600 font-medium">Next.js</span> and <span className="text-emerald-600 font-medium">Supabase</span>
          </p>
        </footer>
      </div>
    </main>
  );
}
