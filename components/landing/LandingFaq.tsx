"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FaqItem {
  q: string;
  a: string;
}

interface LandingFaqProps {
  items: FaqItem[];
}

/**
 * Accessible accordion for pre-sign-in questions.
 * Keeps all answers mounted in the DOM (with inert when collapsed) so assistive tools and
 * in-page text remain predictable while animating height cleanly via CSS grid rows.
 */
export function LandingFaq({ items }: LandingFaqProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section
      id="before-you-sign-in"
      aria-labelledby="before-you-sign-in-heading"
      className="border-t border-border/70 py-14 sm:py-24"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 sm:px-8 lg:grid-cols-[1fr_1.75fr] lg:gap-14">
        <div>
          <h2
            id="before-you-sign-in-heading"
            className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl"
          >
            Before you sign in
          </h2>
          <p className="mt-2.5 max-w-sm text-pretty text-base text-muted-foreground">
            New accounts complete profile setup first and activate at the library circulation desk
            with your school ID.
          </p>
        </div>

        <div className="divide-y divide-border/70 rounded-2xl border border-border/70 bg-card shadow-sm">
          {items.map((item, idx) => {
            const isOpen = openIndex === idx;
            const triggerId = `${baseId}-faq-btn-${idx}`;
            const panelId = `${baseId}-faq-panel-${idx}`;

            return (
              <div key={item.q}>
                <h3>
                  <button
                    id={triggerId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="flex min-h-12 w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-bold text-foreground transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40 sm:px-6 sm:text-base"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                        isOpen && "rotate-180 text-primary",
                      )}
                      aria-hidden="true"
                    />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  inert={!isOpen}
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                    isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-pretty text-sm leading-relaxed text-muted-foreground sm:px-6">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
