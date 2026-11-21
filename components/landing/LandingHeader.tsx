"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#how-borrowing-works", label: "How it works" },
  { href: "#digital-card", label: "Library card" },
  { href: "#before-you-sign-in", label: "Before you sign in" },
] as const;

interface LandingHeaderProps {
  authSlot: ReactNode;
  isSignedIn: boolean;
  showSignInButton: boolean;
}

/**
 * Sticky frosted header aligned with Lumina's internal MainHeader.
 * Tracks vertical scroll progress with a hairline bar and reveals a quick Sign-in anchor
 * once the hero sign-in controls scroll out of view.
 */
export function LandingHeader({
  authSlot,
  isSignedIn,
  showSignInButton,
}: LandingHeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [heroSignInPast, setHeroSignInPast] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const syncScroll = () => {
      const y = window.scrollY || 0;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(y > 12);
      setProgress(docHeight > 0 ? Math.min(1, Math.max(0, y / docHeight)) : 0);
      const signInEl = document.getElementById("sign-in");
      if (signInEl && signInEl.getBoundingClientRect().height > 0) {
        setHeroSignInPast(signInEl.getBoundingClientRect().bottom < 64);
      } else if (typeof IntersectionObserver !== "function") {
        setHeroSignInPast(y > 320);
      }
    };

    syncScroll();
    window.addEventListener("scroll", syncScroll, { passive: true });
    window.addEventListener("resize", syncScroll, { passive: true });

    let io: IntersectionObserver | null = null;
    const target = document.getElementById("sign-in");
    if (target && typeof IntersectionObserver === "function") {
      io = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;
          const past = !entry.isIntersecting && entry.boundingClientRect.top < 80;
          setHeroSignInPast(past);
        },
        { rootMargin: "-64px 0px 0px 0px", threshold: 0 },
      );
      io.observe(target);
    }

    return () => {
      window.removeEventListener("scroll", syncScroll);
      window.removeEventListener("resize", syncScroll);
      io?.disconnect();
    };
  }, []);

  const showQuickSignIn = !isSignedIn && showSignInButton;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-16 border-b border-border/60 bg-background/85 backdrop-blur-xl transition-shadow duration-200",
        scrolled && "shadow-sm",
      )}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          href="/"
          className="group flex min-h-11 shrink-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <Logo
            size={20}
            className="shrink-0 rounded-lg shadow-sm transition-transform duration-300 group-hover:scale-105"
          />
          <span className="flex flex-col">
            <span className="text-base font-bold leading-none tracking-tight text-foreground">
              Lumina
            </span>
            <span className="mt-0.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              STI Alabang Library
            </span>
          </span>
        </Link>

        <nav
          aria-label="Landing sections"
          className="hidden items-center gap-1 md:flex"
        >
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          {authSlot}
          {showQuickSignIn && (
            <div
              data-part="header-signin"
              data-visible={heroSignInPast ? "true" : "false"}
              aria-hidden={!heroSignInPast}
              className={cn(
                "transition-all duration-200",
                heroSignInPast
                  ? "pointer-events-auto translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0",
              )}
            >
              <Button
                asChild
                size="sm"
                className="h-9 rounded-lg px-4 text-xs font-semibold"
              >
                <a href="#sign-in" tabIndex={heroSignInPast ? 0 : -1}>
                  Sign in
                </a>
              </Button>
            </div>
          )}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-transparent"
      >
        <div
          data-part="scroll-progress"
          className="h-full w-full origin-left bg-primary transition-transform duration-75 ease-out"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </header>
  );
}
