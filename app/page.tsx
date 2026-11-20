import { EnvVarWarning } from "@/components/env-var-warning";
import { Logo } from "@/components/layout/Logo";
import { AuthButton } from "@/components/auth/AuthButton";
import { Hero } from "@/components/hero";
import { BookStage } from "@/components/landing/book-stage";
import { hasEnvVars } from "@/lib/utils";
import { isDemoModeEnabled } from "@/lib/demo/config";
import Link from "next/link";
import { Suspense } from "react";
import { getMe } from "@/lib/auth-helpers";
import { isAccessBlocked as checkAccessBlocked, type Profile } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";

export const metadata = {
  title: "STI College Alabang Library | Lumina LMS",
};

// Copy below is traced from the student catalog, reservation, dashboard and circulation desk screens.
const STEPS = [
  {
    title: "Find the title in the catalog",
    body: "Search by title, author or ISBN. Each book shows how many copies are available and its shelf location.",
  },
  {
    title: "Reserve a copy for pickup",
    body: "If a copy is in, Reserve for Pickup holds it for you until the pickup date shown. If every copy is out, reserving puts you in the queue and shows your position.",
  },
  {
    title: "Borrow and return at the circulation desk",
    body: "Checkout is not done online. Show the library card from your dashboard at the desk and staff scan it to lend you the book. Bring the book back to the desk to return it.",
  },
];

const QUESTIONS = [
  {
    q: "Which account do I use?",
    a: "Your STI College Alabang Microsoft account, the one ending in @alabang.sti.edu.ph.",
  },
  {
    q: "Can I reserve books right after my first sign-in?",
    a: "Not yet. You complete your profile first, then show your school ID at the library circulation desk so the librarian can activate your account.",
  },
  {
    q: "Where do I check a reservation or a due date?",
    a: "On your dashboard. Reservations shows Ready for Pickup or your queue position, and Current Borrows shows when each book is due. Past loans are under My Borrowing.",
  },
];

const container = "mx-auto w-full max-w-6xl px-5 sm:px-8";

// The signed-in state is resolved before rendering so the hero is part of the initial HTML.
// Streaming it through a Suspense boundary left it hidden and unhydrated until the browser
// ran the boundary swap script, which never fires in a throttled or background tab.
export default async function Home() {
  const me = await getMe();
  if (me?.user) {
    // Blocked patrons stay here (the protected layout shows them the blocked screen); staff always go in.
    const isBlocked = checkAccessBlocked(me.profile as Profile) && me.role === "patron";
    if (!isBlocked) redirect("/dashboard");
  }

  return (
    <div className="bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded focus:bg-background focus:p-3 focus:text-foreground">Skip to main content</a>
      <header className="border-b border-border">
        <div className={`${container} flex h-14 items-center justify-between`}>
          <Link
            href="/"
            className="flex min-h-11 items-center gap-3 rounded-lg text-lg font-black tracking-tighter text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Logo size={16} className="rounded-lg shadow-sm" />
            LUMINA
          </Link>

          {!hasEnvVars ? (
            <EnvVarWarning />
          ) : (
            <Suspense fallback={null}>
              <AuthButton />
            </Suspense>
          )}
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="outline-none">
      <BookStage
        title="STI College Alabang Library"
        intro="Search the library catalog, reserve a copy for pickup and keep track of what you have borrowed."
        actions={<Hero user={me?.user ?? null} role={me?.role ?? null} showDemo={isDemoModeEnabled()} />}
        steps={STEPS}
      />

      <section id="before-you-sign-in" className="border-t border-border">
        <div className={`${container} py-10 sm:py-16`}>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Before you sign in</h2>
          <dl className="mt-6 divide-y divide-border border-y border-border">
            {QUESTIONS.map(({ q, a }) => (
              <div key={q} className="grid gap-1 py-5 md:grid-cols-[1fr_2fr] md:gap-12">
                <dt className="font-semibold text-foreground">{q}</dt>
                <dd className="max-w-xl text-pretty text-muted-foreground">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      </main>
    </div>
  );
}
