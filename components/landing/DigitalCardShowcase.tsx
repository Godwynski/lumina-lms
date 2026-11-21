"use client";

import { useEffect, useState } from "react";
import { BookOpen, Bookmark, Calendar, Clock, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_POLICIES } from "@/lib/actions/policy-constants";
import { REDUCED_MOTION_QUERY } from "@/lib/landing/book-motion";
import { cn } from "@/lib/utils";

const BORROWING_RULES = [
  {
    icon: Calendar,
    label: "Loan period",
    value: `${DEFAULT_POLICIES.loan_period_days.value} days`,
  },
  {
    icon: BookOpen,
    label: "Borrow limit",
    value: `Up to ${DEFAULT_POLICIES.max_borrow_limit.value} books`,
  },
  {
    icon: Clock,
    label: "Pickup hold",
    value: `${DEFAULT_POLICIES.hold_expiry_days.value} days`,
  },
  {
    icon: Bookmark,
    label: "Active holds",
    value: `Up to ${DEFAULT_POLICIES.max_reservations_per_student.value} titles`,
  },
] as const;

/** Crisp geometric QR finder emblem for the sample library card preview. */
function SampleQrMatrix() {
  return (
    <svg viewBox="0 0 29 29" className="h-full w-full" aria-hidden="true">
      <rect width="29" height="29" fill="#ffffff" />
      <path
        fill="#0f172a"
        d="M1 1h7v7H1V1zm1 1v5h5V2H2zm1 1h3v3H3V3zM21 1h7v7h-7V1zm1 1v5h5V2h-5zm1 1h3v3h-3V3zM1 21h7v7H1v-7zm1 1v5h5v-5H2zm1 1h3v3H3v-3zM10 2h2v2h-2V2zm4 0h2v3h-2V2zm3 1h2v2h-2V3zM10 6h3v2h-3V6zm5 1h3v2h-3V7zM2 10h2v3H2v-3zm4 1h3v2H6v-2zm5-1h2v2h-2v-2zm3 1h3v2h-3v-2zm5-1h3v3h-3v-3zm4 1h4v2h-4v-2zM3 15h4v2H3v-2zm6-1h3v3H9v-3zm5 0h2v3h-2v-3zm4 1h3v2h-3v-2zm5-1h4v2h-4v-2zM1 18h3v2H1v-2zm5 0h2v2H6v-2zm4 0h4v2h-4v-2zm6 1h2v3h-2v-3zm4-1h3v2h-3v-2zm5 1h3v2h-3v-2zM10 22h2v2h-2v-2zm3 1h3v2h-3v-2zm4-1h2v3h-2v-3zm4 0h3v2h-3v-2zm5 1h2v3h-2v-3zM11 26h3v2h-3v-2zm5 0h2v2h-2v-2zm4 0h3v2h-3v-2zm5 1h3v1h-3v-1z"
      />
    </svg>
  );
}

/**
 * Showcases the STI College Alabang Digital Library Card with interactive 3D flip
 * alongside the real default borrowing limits from DEFAULT_POLICIES.
 */
export function DigitalCardShowcase() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [academicYear, setAcademicYear] = useState("2026 - 2027");

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const startYear = now.getUTCMonth() >= 4 ? currentYear : currentYear - 1;
    setAcademicYear(`${startYear} - ${startYear + 1}`);

    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(REDUCED_MOTION_QUERY);
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  const toggleFlip = () => setIsFlipped((prev) => !prev);

  return (
    <section
      id="digital-card"
      aria-labelledby="digital-card-heading"
      className="border-t border-border/70 py-14 sm:py-24"
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <div className="flex flex-col items-center">
          <div
            data-part="card-flip-surface"
            onClick={toggleFlip}
            aria-hidden="true"
            className="w-full max-w-[460px] cursor-pointer select-none"
            style={reducedMotion ? undefined : { perspective: "1400px" }}
          >
            <div
              className={cn(
                "relative w-full transition-transform duration-500",
                reducedMotion && "transition-none",
              )}
              style={
                reducedMotion
                  ? undefined
                  : {
                      transformStyle: "preserve-3d",
                      transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                      transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    }
              }
            >
              {/* Front of STI Alabang Library Card */}
              <div
                className={cn(
                  "overflow-hidden rounded-xl border border-foreground/80 bg-[#e6e6e6] shadow-md",
                  reducedMotion && isFlipped ? "hidden" : "block",
                )}
                style={reducedMotion ? undefined : { backfaceVisibility: "hidden" }}
              >
                <div className="grid grid-cols-[72px_1fr_auto] items-stretch border-b border-foreground/80 bg-[#0068b3] sm:grid-cols-[86px_1fr_auto]">
                  <div className="flex items-center justify-center border-r border-foreground/80 bg-[#ffdb00] px-2 py-2">
                    <div className="text-center leading-none text-[#004b8c]">
                      <p className="text-xl font-black sm:text-2xl">STI</p>
                      <p className="mt-0.5 text-[7.5px] font-bold tracking-[0.12em] sm:text-[8.5px]">
                        ALABANG
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center px-2 py-2.5">
                    <p className="text-base font-bold tracking-tight text-white sm:text-xl">
                      LIBRARY CARD
                    </p>
                  </div>
                  <div className="flex items-start justify-end p-2">
                    <span className="status-success rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase">
                      Active
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[74px_1fr_74px] items-center gap-3 p-3.5 sm:grid-cols-[92px_1fr_88px] sm:gap-4 sm:p-4">
                  <div className="flex h-[96px] flex-col items-center justify-center border border-foreground/70 bg-card text-primary sm:h-[118px]">
                    <span className="text-lg font-extrabold tracking-tight sm:text-xl">
                      JD
                    </span>
                    <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Patron
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-col gap-2 sm:gap-3">
                    <CardField label="Name" value="Juan Dela Cruz" />
                    <CardField label="Program" value="BS Information Technology" />
                    <CardField label="Academic Year" value={academicYear} />
                  </div>

                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-full border border-foreground/80 bg-card p-1">
                      <SampleQrMatrix />
                    </div>
                    <p className="font-mono text-[10px] font-bold tracking-tight text-foreground sm:text-xs">
                      LIB-2026-0412
                    </p>
                  </div>
                </div>
              </div>

              {/* Back of STI Alabang Library Card */}
              <div
                className={cn(
                  "overflow-hidden rounded-xl border border-foreground/80 bg-[#e6e6e6] shadow-md",
                  reducedMotion
                    ? isFlipped
                      ? "block"
                      : "hidden"
                    : "absolute inset-0",
                )}
                style={
                  reducedMotion
                    ? undefined
                    : {
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                      }
                }
              >
                <div className="grid grid-cols-[72px_1fr] items-stretch border-b border-foreground/80 bg-[#0068b3] sm:grid-cols-[86px_1fr]">
                  <div className="flex items-center justify-center border-r border-foreground/80 bg-[#ffdb00] px-2 py-2">
                    <div className="text-center leading-none text-[#004b8c]">
                      <p className="text-xl font-black sm:text-2xl">STI</p>
                      <p className="mt-0.5 text-[7.5px] font-bold tracking-[0.12em] sm:text-[8.5px]">
                        ALABANG
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center px-2 py-2.5">
                    <p className="text-base font-bold tracking-tight text-white sm:text-xl">
                      LIBRARY CARD
                    </p>
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-2.5 p-3.5 text-foreground sm:p-4">
                  <div className="grid gap-1.5 text-[11px]">
                    <div>
                      <span className="font-semibold">Address:</span>{" "}
                      <span className="text-foreground/85">Alabang, Muntinlupa City</span>
                    </div>
                    <div>
                      <span className="font-semibold">Contact No:</span>{" "}
                      <span className="font-mono text-foreground/85">+63 917 000 0412</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-center text-xs font-bold sm:text-sm">
                      Important Reminders
                    </p>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[10px] leading-snug sm:text-[11px]">
                      <li>This card is non-transferable.</li>
                      <li>
                        Present this card every time you borrow books and other library materials.
                      </li>
                      <li>
                        Surrender this card at the end of the semester for clearance.
                      </li>
                    </ol>
                  </div>

                  <div className="flex justify-end pt-1">
                    <div className="text-right">
                      <p className="border-b border-foreground/70 px-4 text-xs font-bold">
                        Librarian
                      </p>
                      <p className="mt-0.5 text-[8px] uppercase tracking-widest text-foreground/75">
                        Signature
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={isFlipped}
              onClick={toggleFlip}
              className="h-10 gap-2 rounded-full border-border/80 bg-card px-4 text-xs font-semibold shadow-sm hover:border-primary/40"
            >
              <RotateCw className="size-3.5" aria-hidden="true" />
              <span>{isFlipped ? "View front of card" : "View back of card"}</span>
            </Button>
            <span className="text-xs font-medium text-muted-foreground">
              Sample card preview
            </span>
          </div>
        </div>

        <div>
          <h2
            id="digital-card-heading"
            className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl"
          >
            Your digital library card, ready at the desk
          </h2>
          <p className="mt-3 max-w-xl text-pretty text-base text-muted-foreground">
            Once your account is activated, your dashboard issues a scannable STI Alabang library
            card. Staff scan its QR code when you borrow, return, or check in at the library.
          </p>

          <dl className="mt-7 grid grid-cols-2 gap-3.5">
            {BORROWING_RULES.map((rule) => {
              const Icon = rule.icon;
              return (
                <div
                  key={rule.label}
                  className="rounded-xl border border-border/60 bg-card p-3.5 shadow-sm"
                >
                  <dt className="flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Icon className="size-3.5 text-primary" aria-hidden="true" />
                    <span>{rule.label}</span>
                  </dt>
                  <dd className="mt-1.5 text-base font-bold tracking-tight tabular-nums text-foreground">
                    {rule.value}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </section>
  );
}

function CardField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 text-center">
      <div className="border-b border-foreground/40 pb-0.5">
        <p className="truncate text-xs font-bold text-foreground sm:text-sm">{value}</p>
      </div>
      <p className="pt-0.5 text-[8.5px] font-bold uppercase tracking-wider text-foreground sm:text-[9.5px]">
        {label}
      </p>
    </div>
  );
}
