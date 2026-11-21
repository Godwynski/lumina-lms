import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth/AuthButton";
import { Hero } from "@/components/hero";
import { BorrowingWalkthrough } from "@/components/landing/BorrowingWalkthrough";
import { DigitalCardShowcase } from "@/components/landing/DigitalCardShowcase";
import { InteractiveBook } from "@/components/landing/InteractiveBook";
import { LandingFaq } from "@/components/landing/LandingFaq";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import type { BookStep } from "@/lib/landing/book-motion-types";
import { hasEnvVars } from "@/lib/utils";
import { isDemoModeEnabled } from "@/lib/demo/config";
import { Suspense } from "react";
import { getMe } from "@/lib/auth-helpers";
import { isAccessBlocked as checkAccessBlocked, type Profile } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { ArrowDown } from "lucide-react";

export const metadata = {
  title: "STI College Alabang Library | Lumina LMS",
};

// Copy below is traced from the student catalog, reservation, dashboard and circulation desk screens.
const STEPS: BookStep[] = [
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
  {
    q: "Can I use my digital library card on my phone?",
    a: "Yes. Open your dashboard on your phone at the circulation desk so staff can scan your QR code directly from the screen, or export a copy from My Card.",
  },
  {
    q: "What happens if a book is returned past its due date?",
    a: "Borrowed books accrue a daily overdue fine (5 PHP per day by default) once past their due date. You can view any balance under My Borrowing and settle it at the desk.",
  },
];

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

  const authSlot = !hasEnvVars ? (
    <EnvVarWarning />
  ) : (
    <Suspense fallback={null}>
      <AuthButton />
    </Suspense>
  );

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded focus:bg-background focus:p-3 focus:text-foreground"
      >
        Skip to main content
      </a>

      <LandingHeader
        authSlot={authSlot}
        isSignedIn={Boolean(me?.user)}
        showSignInButton={Boolean(hasEnvVars)}
      />

      <main id="main-content" tabIndex={-1} className="outline-none">
        <section className="relative overflow-x-clip bg-[radial-gradient(ellipse_at_top_right,hsl(221_39%_20%/0.07),transparent_60%)]">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-10 sm:px-8 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:py-20">
            <div>
              <h1 className="max-w-xl text-balance text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                STI College Alabang Library
              </h1>
              <p className="mt-4 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground sm:mt-5 sm:text-lg">
                Search the library catalog, reserve a copy for pickup and keep track of what you
                have borrowed.
              </p>

              <div id="sign-in" className="mt-7 max-w-md sm:mt-8">
                <Hero user={me?.user ?? null} role={me?.role ?? null} showDemo={isDemoModeEnabled()} />
              </div>

              <div className="mt-5">
                <a
                  href="#how-borrowing-works"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <span>How borrowing works</span>
                  <ArrowDown className="size-3.5" aria-hidden="true" />
                </a>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <InteractiveBook />
            </div>
          </div>
        </section>

        <BorrowingWalkthrough steps={STEPS} />
        <DigitalCardShowcase />
        <LandingFaq items={QUESTIONS} />
      </main>

      <LandingFooter />
    </div>
  );
}
