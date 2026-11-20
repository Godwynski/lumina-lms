"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Writes scroll progress through the surrounding <section> to the CSS variable --p (0 to 1) on its own element.
 * Progress is a pure function of scroll position, so scrolling back replays the same states in reverse.
 * Without JS, or with reduced motion, --p is never set and children keep their finished state.
 */
export function ScrollProgress({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    const track = el?.closest("section");
    if (!el || !track || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let last = -1;
    let onScreen = false;

    const draw = () => {
      frame = 0;
      const vh = window.innerHeight;
      let p: number;
      if (getComputedStyle(el).position === "sticky") {
        // Pinned beside the text: run from the section entering to its last step being in view.
        const r = track.getBoundingClientRect();
        p = (vh * 0.6 - r.top) / (r.height - vh * 0.25);
      } else {
        // In normal flow (short screens): run while the artwork itself rises through the viewport.
        p = (vh * 0.95 - el.getBoundingClientRect().top) / (vh * 0.6);
      }
      p = Math.round(Math.min(1, Math.max(0, p)) * 250) / 250;
      if (p === last) return;
      last = p;
      el.style.setProperty("--p", String(p));
    };
    const request = () => {
      if (onScreen && !frame) frame = requestAnimationFrame(draw);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        request();
      },
      { rootMargin: "25% 0px" },
    );
    observer.observe(track);
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    draw();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      cancelAnimationFrame(frame);
      el.style.removeProperty("--p");
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
