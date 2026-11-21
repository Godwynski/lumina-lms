"use client";

import { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  BookmarkCheck,
  CheckCircle2,
  MapPin,
  QrCode,
  ScanLine,
  Search,
  Sparkles,
  Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookStep } from "@/lib/landing/book-motion-types";

export type { BookStep };

const STEP_ICONS = [Search, BookmarkCheck, QrCode] as const;

interface BorrowingWalkthroughProps {
  steps: BookStep[];
}

/**
 * Asymmetric interactive walkthrough pairing a semantic ordered stepper with a live
 * animated preview of Lumina's student catalog, reservation status, and desk checkout flow.
 */
export function BorrowingWalkthrough({ steps }: BorrowingWalkthroughProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section
      id="how-borrowing-works"
      aria-labelledby="how-borrowing-works-heading"
      className="border-t border-border/70 py-14 sm:py-24"
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <h2
            id="how-borrowing-works-heading"
            className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl"
          >
            How borrowing works
          </h2>
          <p className="mt-2.5 text-pretty text-base text-muted-foreground">
            Search the catalog, hold a copy online, and check out in seconds at the circulation desk.
          </p>
        </div>

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <ol className="space-y-3">
            {steps.map((step, i) => {
              const Icon = STEP_ICONS[i % STEP_ICONS.length];
              const isActive = activeIndex === i;
              const isPassed = i < activeIndex;
              const isLast = i === steps.length - 1;

              return (
                <li key={step.title} className="relative flex gap-3.5">
                  <div className="flex flex-col items-center pt-3.5">
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/10"
                          : isPassed
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground",
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="size-4" />
                    </span>
                    {!isLast && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-2 w-[1.5px] flex-1 rounded-full transition-colors duration-200",
                          isPassed ? "bg-primary" : "bg-border/70",
                        )}
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveIndex(i)}
                    className={cn(
                      "flex-1 rounded-xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      isActive
                        ? "border-border bg-card shadow-sm"
                        : "border-transparent bg-transparent hover:border-border/50 hover:bg-card/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        Step {i + 1}
                      </span>
                      {isActive && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-semibold text-primary">
                          Viewing
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 text-base font-bold tracking-tight text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3.5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                <span className="text-xs font-semibold text-foreground">
                  {steps[activeIndex]?.title}
                </span>
              </div>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                Step {activeIndex + 1} of {steps.length}
              </span>
            </div>

            <div className="mt-5 min-h-[250px]">
              <AnimatePresence mode="wait">
                <m.div
                  key={activeIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-3.5"
                >
                  {activeIndex === 0 && <CatalogPreviewPane />}
                  {activeIndex === 1 && <ReservationPreviewPane />}
                  {activeIndex === 2 && <DeskCheckoutPreviewPane />}
                </m.div>
              </AnimatePresence>
            </div>

            <p className="mt-5 border-t border-border/60 pt-3 text-xs text-muted-foreground">
              Illustrative preview of the Lumina student workspace
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CatalogPreviewPane() {
  return (
    <div data-preview-step="0" className="space-y-3">
      <div className="app-toolbar flex items-center justify-between gap-2 bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-foreground">
          <Search className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">Clean Code</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-md border border-border bg-background px-2 py-0.5 text-2xs font-semibold text-foreground">
            Computer Science
          </span>
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-2xs font-semibold text-primary">
            Available
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="rounded-xl border border-border/70 bg-background p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Clean Code</p>
              <p className="text-xs font-medium text-muted-foreground">by Robert C. Martin</p>
              <p className="mt-1.5 inline-flex items-center gap-1 text-2xs font-semibold text-muted-foreground">
                <MapPin className="size-3" aria-hidden="true" />
                CS Section · Shelf 4
              </p>
            </div>
            <span className="status-success shrink-0 rounded-full border px-2.5 py-0.5 text-2xs font-bold tabular-nums">
              2 / 3 in
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <m.div
              initial={{ width: 0 }}
              animate={{ width: "66.6%" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="status-fill-success h-full rounded-full"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-background/70 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Design Patterns</p>
              <p className="text-xs font-medium text-muted-foreground">by Erich Gamma</p>
              <p className="mt-1.5 inline-flex items-center gap-1 text-2xs font-semibold text-muted-foreground">
                <MapPin className="size-3" aria-hidden="true" />
                CS Section · Shelf 2
              </p>
            </div>
            <span className="status-danger shrink-0 rounded-full border px-2.5 py-0.5 text-2xs font-bold tabular-nums">
              0 / 2 in
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReservationPreviewPane() {
  return (
    <div data-preview-step="1" className="space-y-3">
      <div className="status-success flex items-center gap-3 rounded-xl border p-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/80">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide">Copy Ready for Pickup</p>
          <p className="mt-0.5 text-xs opacity-90">
            Clean Code · Held at desk until pickup deadline
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Ticket className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">
            Queue Position #2
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Design Patterns · Notification sent automatically when returned
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-3.5 py-2.5 text-xs">
        <span className="font-semibold text-foreground">Dashboard · Reservations</span>
        <span className="font-semibold text-primary">Live status updates</span>
      </div>
    </div>
  );
}

function DeskCheckoutPreviewPane() {
  const miniSteps = [
    { label: "Scan Card", state: "done" },
    { label: "Scan Book", state: "active" },
    { label: "Confirmed", state: "next" },
  ] as const;

  return (
    <div data-preview-step="2" className="space-y-4">
      <div className="flex items-center justify-between gap-2 px-1">
        {miniSteps.map((s, idx) => (
          <div key={s.label} className="flex flex-1 items-center gap-2 last:flex-initial">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-2xs font-bold",
                  s.state === "done"
                    ? "border-primary bg-primary/10 text-primary"
                    : s.state === "active"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                {s.state === "done" ? (
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                ) : s.state === "active" ? (
                  <ScanLine className="size-3.5" aria-hidden="true" />
                ) : (
                  idx + 1
                )}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold whitespace-nowrap",
                  s.state === "next" ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {idx < miniSteps.length - 1 && (
              <div
                className={cn(
                  "h-[1.5px] flex-1 rounded-full",
                  s.state === "done" ? "bg-primary" : "bg-border/70",
                )}
              />
            )}
          </div>
        ))}
      </div>

      <div className="relative flex items-center gap-4 overflow-hidden rounded-xl border border-border/70 bg-background p-4">
        <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
          <QrCode className="size-9 text-foreground" aria-hidden="true" />
          <span
            aria-hidden="true"
            className="animate-scan motion-reduce:animate-none absolute inset-x-1 h-0.5 rounded-full bg-primary/70"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted-foreground">Circulation Desk</p>
          <p className="mt-0.5 text-sm font-bold text-foreground">
            Show your dashboard QR card
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-2xs font-semibold text-foreground">
            <CheckCircle2 className="size-3 text-emerald-700" aria-hidden="true" />
            <span>Loan recorded · Due in 14 days</span>
          </div>
        </div>
      </div>
    </div>
  );
}
