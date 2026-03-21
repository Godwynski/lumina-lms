import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { Hero } from "@/components/hero";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth-helpers";
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen w-full flex-col items-center">
        <nav className="sticky top-0 z-50 flex h-16 w-full justify-center border-b border-slate-200 bg-slate-50/95 backdrop-blur">
          <div className="flex w-full max-w-6xl items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-3 text-lg font-bold tracking-tight">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-700">
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                </svg>
              </div>
              <Link href="/" className="text-slate-900 transition-colors hover:text-slate-700">Lumina LMS</Link>
            </div>
            <div className="flex items-center gap-4">
              {!hasEnvVars ? (
                <EnvVarWarning />
              ) : (
                <Suspense fallback={<div className="h-9 w-24 animate-pulse rounded-md bg-slate-200" />}>
                  <AuthButton />
                </Suspense>
              )}
            </div>
          </div>
        </nav>

        <div className="flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8 md:px-6 md:py-12">
          <Suspense fallback={<Hero user={null} role={null} />}>
            <HeroSection />
          </Suspense>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Core Capabilities</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Catalog Intelligence</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Search and manage physical and digital resources from a structured inventory workspace.</p>
              </div>

              <div className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Role Governance</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Permission-aware navigation and workflows for students, staff, librarians, and administrators.</p>
              </div>

              <div className="h-full rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-slate-100 text-slate-700">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Circulation Controls</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Track borrowing, returns, due dates, and penalties with transparent operational records.</p>
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-6 w-full border-t border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-500">
          <p>Built with Next.js and Supabase</p>
        </footer>
      </div>
    </main>
  );
}
