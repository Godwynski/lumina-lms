"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Book, BookOpen, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BookArt } from "./book-art";
import styles from "./interactive-book.module.css";
import {
  BOOK,
  REDUCED_MOTION_QUERY,
  SPIN_REST,
  TAP_FLIP,
  computeBookPose,
  formatStampDate,
  spinSettled,
  stepOpen,
  stepSpin,
  type BookPose,
  type Spin,
} from "@/lib/landing/book-motion";

const leafFace = (side: "pf" | "pb", folio?: number) => (
  <div className={`${styles.face} ${styles[side]} ${styles.paper}`}>
    <div className={styles.leafLines} />
    {folio ? <div className={styles.folio}>{folio}</div> : null}
    <div className={styles.shade} data-shade />
  </div>
);

/**
 * Interactive 3D physical catalog book for the hero section.
 * Visitors can drag to spin it, hover for subtle parallax tilt, or click/toggle it open to inspect
 * a live date-stamped STI Alabang library slip and miniature catalog record.
 * Falls back cleanly to the static BookArt illustration under prefers-reduced-motion: reduce.
 */
export function InteractiveBook() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [stampDate, setStampDate] = useState("TODAY");

  const apiRef = useRef<{
    setOpenTarget: (open: boolean) => void;
    triggerSpin: () => void;
  } | null>(null);

  useEffect(() => {
    setStampDate(formatStampDate(new Date()));
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(REDUCED_MOTION_QUERY);
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || reducedMotion) {
      apiRef.current = null;
      return;
    }

    const q = <T extends HTMLElement = HTMLElement>(part: string) =>
      stage.querySelector<T>(`[data-part='${part}']`);
    const book = q("book");
    const tilt = q("tilt");
    const cover = q("cover");
    const gloss = q("gloss");
    const shadow = q("shadow");
    const stamp = q("stamp");
    if (!book || !tilt || !cover || !gloss || !shadow || !stamp) return;

    const coverShades = Array.from(
      cover.querySelectorAll<HTMLElement>(":scope > div > [data-shade]"),
    );
    const leaves = Array.from(stage.querySelectorAll<HTMLElement>("[data-part='leaf']")).map(
      (el) => ({
        el,
        outer: el.querySelector<HTMLElement>("[data-part='leaf-out']")!,
        shades: Array.from(el.querySelectorAll<HTMLElement>("[data-shade]")),
      }),
    );

    const written = new Map<HTMLElement, Partial<Record<"transform" | "opacity", string>>>();
    const put = (el: HTMLElement, key: "transform" | "opacity", value: string) => {
      let seen = written.get(el);
      if (!seen) written.set(el, (seen = {}));
      if (seen[key] === value) return;
      seen[key] = value;
      el.style[key] = value;
    };
    const r = (n: number) => Math.round(n * 100) / 100;
    const shadeVal = (v: number) => String(Math.round(v * 25) / 25);

    const apply = (pose: BookPose) => {
      put(
        book,
        "transform",
        `translate3d(${r(pose.book.x)}px,0,0) rotateX(${r(pose.book.rx)}deg) rotateY(${r(pose.book.ry)}deg) rotateZ(${r(pose.book.rz)}deg)`,
      );
      put(tilt, "transform", `rotateX(${r(pose.tilt.rx)}deg) rotateY(${r(pose.tilt.ry)}deg)`);
      put(gloss, "transform", `translate3d(${r(pose.gloss)}%,0,0)`);
      put(cover, "transform", `translateZ(${r(pose.cover.z)}px) rotateY(${r(pose.cover.angle)}deg)`);
      coverShades.forEach((el) => put(el, "opacity", shadeVal(pose.cover.shade)));
      leaves.forEach((lf, i) => {
        const p = pose.leaves[i];
        if (!p) return;
        put(lf.el, "transform", `translateZ(${r(p.z)}px) rotateY(${r(p.angle)}deg)`);
        put(lf.outer, "transform", `rotateY(${r(p.bend)}deg)`);
        lf.shades.forEach((el) => put(el, "opacity", shadeVal(p.shade)));
      });
      put(
        shadow,
        "transform",
        `translate3d(0,0,-32px) scale(${r(pose.shadow.sx)},${r(pose.shadow.sy)})`,
      );
      put(shadow, "opacity", String(r(pose.shadow.opacity)));
      put(stamp, "opacity", String(r(pose.stamp.opacity)));
      put(stamp, "transform", `rotate(-6deg) scale(${r(pose.stamp.scale)})`);
    };

    let openVal = 0;
    let targetOpen = 0;
    let px = 0;
    let py = 0;
    let tx = 0;
    let ty = 0;
    let spin: Spin = { ...SPIN_REST };
    let raf = 0;
    let last = 0;

    const draw = () =>
      apply(computeBookPose(openVal, { spin: spin.angle, pointerX: tx, pointerY: ty }));

    const loop = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      const pointerAlpha = 1 - Math.exp(-dt / 0.085);
      openVal = stepOpen(openVal, targetOpen, dt);
      tx += (px - tx) * pointerAlpha;
      ty += (py - ty) * pointerAlpha;
      spin = stepSpin(spin, dt);
      draw();

      const settled =
        openVal === targetOpen &&
        Math.abs(px - tx) < 0.002 &&
        Math.abs(py - ty) < 0.002 &&
        spinSettled(spin);
      if (settled) last = 0;
      else raf = requestAnimationFrame(loop);
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };

    apiRef.current = {
      setOpenTarget: (nextOpen: boolean) => {
        targetOpen = nextOpen ? 1 : 0;
        kick();
      },
      triggerSpin: () => {
        targetOpen = 0;
        spin = { ...spin, vel: spin.vel + TAP_FLIP, dragging: false };
        kick();
      },
    };

    const hover =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(hover: hover)").matches
        : false;

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const rect = stage.getBoundingClientRect();
      const w = rect.width || window.innerWidth || 1;
      const h = rect.height || window.innerHeight || 1;
      px = ((e.clientX - rect.left) / w - 0.5) * 2;
      py = ((e.clientY - rect.top) / h - 0.5) * 2;
      kick();
    };

    const onPointerLeave = () => {
      px = 0;
      py = 0;
      kick();
    };

    let downX = 0;
    let downY = 0;
    let lastX = 0;
    let lastT = 0;
    let downT = 0;
    let moved = 0;
    let pointerActive = false;

    const onDown = (e: PointerEvent) => {
      pointerActive = true;
      downX = lastX = e.clientX;
      downY = e.clientY;
      downT = lastT = performance.now();
      moved = 0;
      if (targetOpen === 0 && openVal < 0.08) {
        spin = { ...spin, dragging: true, vel: 0 };
        setIsDragging(true);
      }
      book.setPointerCapture?.(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!pointerActive) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      const dt = Math.max(0.008, (now - lastT) / 1000);
      moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
      if (spin.dragging) {
        spin = { angle: spin.angle + dx * 0.65, vel: (dx * 0.65) / dt, dragging: true };
        setInteracted(true);
        kick();
      }
      lastX = e.clientX;
      lastT = now;
    };

    const onUp = (e: PointerEvent) => {
      if (!pointerActive) return;
      pointerActive = false;
      book.releasePointerCapture?.(e.pointerId);
      const isTap = moved < 6 && performance.now() - downT < 350;
      if (spin.dragging) {
        spin = { angle: spin.angle, vel: spin.vel, dragging: false };
        setIsDragging(false);
      }
      if (isTap) {
        setInteracted(true);
        setIsOpen((prev) => {
          const next = !prev;
          targetOpen = next ? 1 : 0;
          return next;
        });
      }
      kick();
    };

    const io =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(([entry]) => {
            stage.dataset.paused = entry?.isIntersecting ? "false" : "true";
          })
        : null;
    io?.observe(stage);

    draw();

    if (hover) {
      stage.addEventListener("pointermove", onPointer, { passive: true });
      stage.addEventListener("pointerleave", onPointerLeave);
    }
    book.addEventListener("pointerdown", onDown);
    book.addEventListener("pointermove", onMove);
    book.addEventListener("pointerup", onUp);
    book.addEventListener("pointercancel", onUp);

    return () => {
      apiRef.current = null;
      cancelAnimationFrame(raf);
      io?.disconnect();
      if (hover) {
        stage.removeEventListener("pointermove", onPointer);
        stage.removeEventListener("pointerleave", onPointerLeave);
      }
      book.removeEventListener("pointerdown", onDown);
      book.removeEventListener("pointermove", onMove);
      book.removeEventListener("pointerup", onUp);
      book.removeEventListener("pointercancel", onUp);
      [
        book,
        tilt,
        gloss,
        cover,
        shadow,
        stamp,
        ...coverShades,
        ...leaves.flatMap((l) => [l.el, l.outer, ...l.shades]),
      ].forEach((el) => {
        el.style.transform = "";
        el.style.opacity = "";
      });
      delete stage.dataset.paused;
    };
  }, [reducedMotion]);

  const handleToggleOpen = useCallback(() => {
    setInteracted(true);
    setIsOpen((prev) => {
      const next = !prev;
      apiRef.current?.setOpenTarget(next);
      return next;
    });
  }, []);

  const handleSpin = useCallback(() => {
    setInteracted(true);
    setIsOpen(false);
    apiRef.current?.triggerSpin();
  }, []);

  if (reducedMotion) {
    return (
      <div
        ref={stageRef}
        className="flex flex-col items-center justify-center rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
        data-reduced-motion="true"
      >
        <div className="w-full max-w-[300px]">
          <BookArt />
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-semibold text-muted-foreground tabular-nums">
          <span>STI College Alabang</span>
          <span aria-hidden="true">·</span>
          <span data-part="stamp">{stampDate}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={stageRef}
      className={styles.stage}
      data-open={isOpen ? "true" : "false"}
      data-dragging={isDragging ? "true" : "false"}
      data-reduced-motion="false"
    >
      <div className={styles.viewport} aria-hidden="true">
        <div className={styles.sceneScale}>
          <div className={styles.scene} data-part="scene">
            <div className={styles.shadow} data-part="shadow" />
            <div className={styles.float}>
              <div className={styles.tilt} data-part="tilt">
                <div
                  className={styles.book}
                  data-part="book"
                  style={{ width: BOOK.W, height: BOOK.H }}
                >
                  <div className={`${styles.face} ${styles.back}`} />
                  <div className={`${styles.face} ${styles.spine}`}>
                    <b>LUMINA · STI ALABANG</b>
                  </div>
                  <div className={`${styles.face} ${styles.edgeFore}`} />
                  <div className={`${styles.face} ${styles.edgeTop}`} />
                  <div className={`${styles.face} ${styles.edgeBot}`} />

                  <div className={`${styles.face} ${styles.pagetop} ${styles.paper}`}>
                    <div className={styles.ribbon} />
                    <div className={styles.catalogPage}>
                      <div className={styles.pageMeta}>
                        <span>Catalog Record</span>
                        <span className={styles.pageCallNo}>QA 76.76</span>
                      </div>

                      <div className={styles.recordCard}>
                        <p className={styles.recordTitle}>Clean Code</p>
                        <p className={styles.recordAuthor}>Robert C. Martin</p>
                        <div className={styles.recordMeterLabel}>
                          <span>Copy Availability</span>
                          <span>2 / 3</span>
                        </div>
                        <div className={styles.recordMeterTrack}>
                          <div className={styles.recordMeterFill} />
                        </div>
                        <div className={styles.recordShelf}>
                          <span>CS Section · Shelf 4</span>
                          <span className={styles.recordPill}>Reserve</span>
                        </div>
                      </div>

                      <div className={styles.lines} />

                      <div className={styles.pageFoot}>
                        <div className={styles.chipOk}>2 OF 3 ON SHELF</div>
                        <div className={styles.folio}>14</div>
                      </div>
                    </div>
                  </div>

                  {[1, 2, 3].map((i) => (
                    <div key={i} className={styles.leaf} data-part="leaf">
                      {leafFace("pf")}
                      {leafFace("pb")}
                      <div className={styles.leafOut} data-part="leaf-out">
                        {leafFace("pf", 2 * i + 1)}
                        {leafFace("pb", 2 * i)}
                      </div>
                    </div>
                  ))}

                  <div className={styles.cover} data-part="cover">
                    <div className={`${styles.face} ${styles.cf}`}>
                      <div className={styles.frame} />
                      <div className={styles.crest}>
                        <div className={styles.crestMark}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path
                              d="M12 6.5C9.7 4.9 6.6 4.4 4 4.8v13.4c2.6-.4 5.7.1 8 1.7m0-13.4c2.3-1.6 5.4-2.1 8-1.7v13.4c-2.6-.4-5.7.1-8 1.7m0-13.4v13.4"
                              stroke="#ffffff"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <span className={styles.crestPill}>STI ALABANG</span>
                      </div>
                      <div className={styles.coverTitle}>
                        <b>Lumina</b>
                        <span>Library Catalog</span>
                      </div>
                      <div className={styles.coverFoot}>STI COLLEGE ALABANG</div>
                      <div className={styles.gloss} data-part="gloss" />
                      <div className={styles.shade} data-shade />
                    </div>

                    <div className={`${styles.face} ${styles.ci}`}>
                      <div className={styles.slip}>
                        <div className={styles.slipHead}>
                          <h4>DATE ISSUED</h4>
                          <span className={styles.slipTag}>STI</span>
                        </div>
                        <ol>
                          <li className={styles.st}>AUG 14</li>
                          <li className={styles.st}>SEP 02</li>
                          <li className={styles.st}>OCT 21</li>
                          <li className={styles.today}>
                            <span data-part="stamp">{stampDate}</span>
                          </li>
                          <li />
                          <li />
                          <li />
                        </ol>
                        <div className={styles.lib}>PROPERTY OF THE LIBRARY</div>
                      </div>
                      <div className={styles.shade} data-shade />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-2.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={isOpen}
          onClick={handleToggleOpen}
          className="h-10 gap-2 rounded-full border-border/80 bg-card/90 px-4 text-xs font-semibold shadow-sm hover:border-primary/40 hover:bg-card"
        >
          {isOpen ? (
            <Book className="size-3.5" aria-hidden="true" />
          ) : (
            <BookOpen className="size-3.5" aria-hidden="true" />
          )}
          <span>{isOpen ? "Close book" : "Open book"}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSpin}
          className="h-10 gap-2 rounded-full border-border/80 bg-card/90 px-4 text-xs font-semibold shadow-sm hover:border-primary/40 hover:bg-card"
        >
          <RotateCw className="size-3.5" aria-hidden="true" />
          <span>Spin book</span>
        </Button>
      </div>

      <p
        className={`mt-2.5 text-center text-xs font-medium text-muted-foreground transition-opacity duration-300 ${
          interacted ? "opacity-0" : "opacity-100"
        }`}
      >
        Drag to spin · Click book to open
      </p>
    </div>
  );
}
