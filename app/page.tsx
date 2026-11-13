import { EnvVarWarning } from "@/components/env-var-warning";
import { Logo } from "@/components/layout/Logo";
import { AuthButton } from "@/components/auth/AuthButton";
import { Hero } from "@/components/hero";
import { BookArt } from "@/components/landing/book-art";
import { ScrollProgress } from "@/components/landing/scroll-progress";
import { hasEnvVars } from "@/lib/utils";
import { isDemoModeEnabled } from "@/lib/demo/config";
import Link from "next/link";
import { Suspense } from "react";
import { getMe } from "@/lib/auth-helpers";
import { isAccessBlocked as checkAccessBlocked, type Profile } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "STI College Alabang Library | Lumina LMS",
};

async function HeroSection() {
  const me = await getMe();
  return <Hero user={me?.user ?? null} role={me?.role ?? null} showDemo={isDemoModeEnabled()} />;
}

async function AuthRedirect() {
  const me = await getMe();

  if (me?.user) {
    const isPrivileged = me.role === "super_admin" || me.role === "librarian";
    const isBlocked = checkAccessBlocked(me.profile as Profile);
    if (isBlocked && !isPrivileged && me.role !== "student_assistant") {
      return null;
    }
    return redirect("/dashboard");
  }
  return null;
}

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
    a: "On your dashboard. Reservations shows Ready for Pickup or your queue position, and Current Borrows shows when each book is due. Past loans are under Borrow History.",
  },
];

const container = "mx-auto w-full max-w-6xl px-5 sm:px-8";

function SignIn() {
  return (
    <Suspense
      fallback={
        <>
          <Skeleton className="h-12 w-full rounded-lg" />
          {isDemoModeEnabled() && <Skeleton className="mt-5 h-[8.25rem] w-full rounded-lg opacity-40" />}
        </>
      }
    >
      <HeroSection />
    </Suspense>
  );
}

export default function Home() {
  return (
    <div className="bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded focus:bg-background focus:p-3 focus:text-foreground">Skip to main content</a>
      <Suspense fallback={null}>
        <AuthRedirect />
      </Suspense>

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
      <section className={`${container} relative py-10 sm:py-16 lg:py-24 [@media(max-height:480px)]:py-5`}>
        {/* The walkthrough book's ribbon, hanging from the header as a bookmark. */}
        <span
          aria-hidden="true"
          className="absolute right-5 top-0 h-10 w-3 bg-[hsl(var(--chart-1))] [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)] sm:right-8 sm:h-16 sm:w-4 lg:h-24"
        />
        <h1 className="max-w-3xl text-balance pr-6 text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          STI College Alabang Library
        </h1>
        <p className="mt-3 max-w-xl text-pretty text-base text-muted-foreground sm:mt-5 sm:text-lg">
          Search the library catalog, reserve a copy for pickup and keep track of what you have borrowed.
        </p>
        <div className="mt-6 max-w-sm sm:mt-8 [@media(max-height:480px)]:mt-4">
          <SignIn />
        </div>
        <a
          href="#how-borrowing-works"
          className="mt-2 inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          How borrowing works
        </a>
      </section>

      <section id="how-borrowing-works" className="border-t border-border">
        <div className={`${container} grid gap-x-12 py-10 sm:py-16 md:grid-cols-2`}>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl md:col-start-1">
            How borrowing works
          </h2>

          {/* Pinned as a short strip on phones and beside the steps from md up; left in normal flow on short screens. */}
          <ScrollProgress className="sticky top-0 z-10 -mx-5 mt-4 border-b border-border bg-background px-5 py-3 sm:-mx-8 sm:px-8 md:top-[calc(50vh-9rem)] md:col-start-2 md:row-span-2 md:row-start-1 md:mx-0 md:mt-0 md:self-start md:border-0 md:bg-transparent md:p-0 [@media(max-height:599px)]:static">
            <div className="mx-auto max-w-[11rem] md:max-w-md">
              <BookArt />
            </div>
          </ScrollProgress>

          <ol className="md:col-start-1">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col justify-center py-6 md:min-h-[40vh] md:py-8">
                <span className="text-sm font-bold tabular-nums text-muted-foreground">Step {i + 1}</span>
                <h3 className="mt-1 text-xl font-bold tracking-tight text-foreground">{step.title}</h3>
                <p className="mt-2 max-w-md text-pretty text-base text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-border">
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
