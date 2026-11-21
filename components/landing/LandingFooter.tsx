import { ArrowUp } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";

/** Closing sign-in callout and minimal institutional footer for the landing page. */
export function LandingFooter() {
  return (
    <footer className="border-t border-border/70 bg-muted/20">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-border/70 bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:p-8">
          <div className="max-w-xl">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
              Ready to browse the shelves?
            </h2>
            <p className="mt-1.5 text-pretty text-sm text-muted-foreground">
              Sign in with your STI College Alabang Microsoft account to search titles, place
              holds, and view your digital library card.
            </p>
          </div>

          <Button asChild size="lg" className="h-11 shrink-0 rounded-xl px-6">
            <a href="#sign-in">
              Sign in to Lumina
              <ArrowUp className="size-4" aria-hidden="true" />
            </a>
          </Button>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <Logo size={14} className="rounded-md shadow-sm" />
            <span className="font-semibold text-foreground">
              Lumina LMS · STI College Alabang Library
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <a href="#how-borrowing-works" className="hover:text-foreground">
              How it works
            </a>
            <a href="#digital-card" className="hover:text-foreground">
              Library card
            </a>
            <a href="#before-you-sign-in" className="hover:text-foreground">
              Before you sign in
            </a>
            <span>© 2026 Lumina LMS</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
