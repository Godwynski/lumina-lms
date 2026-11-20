"use client";

import { useEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { BookArt } from "./book-art";
import styles from "./book-stage.module.css";
import {
  ACTS,
  CINE_QUERY,
  SPIN_REST,
  STEPS_DONE_AT,
  TAP_FLIP,
  WORDS,
  computeFrame,
  computeLayout,
  formatStampDate,
  spinSettled,
  stepSpin,
  type Frame,
  type Layout,
  type Spin,
} from "@/lib/landing/book-motion";

export interface BookStep {
  title: string;
  body: string;
}

const ICONS = [
  <svg key="find" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  <svg key="reserve" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg>,
  <svg key="desk" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 10h4M7 14h7" /></svg>,
];

// Dust in the window light. Fixed values keep server and client markup identical.
const MOTES = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: `${20 + ((i * 53) % 70)}%`,
  "--sz": `${2 + (i % 3)}px`,
  "--dur": `${10 + ((i * 7) % 9)}s`,
  "--delay": `${-((i * 13) % 10)}s`,
  "--dx": `${(i % 2 ? 1 : -1) * (20 + ((i * 11) % 30))}px`,
})) as CSSProperties[];

const pageFace = (side: "pf" | "pb", folio?: number) => (
  <div className={`${styles.face} ${styles[side]} ${styles.paper}`}>
    <div className={styles.lines} />
    {folio ? <div className={styles.folio}>{folio}</div> : null}
    <div className={styles.shade} data-shade />
  </div>
);

/**
 * Landing hero plus "How borrowing works", told by a 3D book that scroll throws, opens and empties.
 * The pinned stage only exists where CINE_QUERY matches (motion allowed, script running, screen tall
 * enough); everywhere else the same markup lays out as the plain page with the flat BookArt.
 * The step copy is a real ordered list in both modes.
 */
export function BookStage({
  title,
  intro,
  actions,
  steps,
}: {
  title: ReactNode;
  intro: ReactNode;
  actions: ReactNode;
  steps: BookStep[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const jumpRef = useRef<((p: number) => boolean) | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stamp = root.querySelector<HTMLElement>("[data-part='stamp']");
    if (stamp) stamp.textContent = formatStampDate(new Date());
    if (typeof window.matchMedia !== "function") return;

    const mq = window.matchMedia(CINE_QUERY);
    let stop: (() => void) | null = null;
    const sync = () => {
      stop?.();
      stop = mq.matches ? run(root, jumpRef) : null;
      root.dataset.live = mq.matches ? "true" : "false";
      if (!mq.matches) jumpRef.current = null;
    };
    sync();
    mq.addEventListener?.("change", sync);
    return () => {
      mq.removeEventListener?.("change", sync);
      stop?.();
      jumpRef.current = null;
    };
  }, []);

  const toSteps = (e: MouseEvent<HTMLAnchorElement>) => {
    if (jumpRef.current?.(STEPS_DONE_AT)) e.preventDefault();
  };

  return (
    <div ref={rootRef} className={styles.root} data-live="false">
      <div className={styles.track} data-part="track">
        <div className={styles.stage} data-part="stage">
          <div className={styles.ambience} data-part="ambience" aria-hidden="true">
            {MOTES.map((style, i) => (
              <span key={i} className={`${styles.mote} ${i % 5 === 0 ? styles.moteAccent : ""}`} style={style} />
            ))}
          </div>

          <div className={styles.heroCopy} data-part="hero">
            <div className={styles.container}>
              <div className={styles.heroInner} data-part="hero-inner">
                <span aria-hidden="true" className={styles.ribbonTag} />
                <h1 className="max-w-3xl text-balance pr-6 text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  {title}
                </h1>
                <p className="mt-3 max-w-xl text-pretty text-base text-muted-foreground sm:mt-5 sm:text-lg">{intro}</p>
                <div id="sign-in" className="mt-6 max-w-sm sm:mt-8">
                  {actions}
                </div>
                <div className={styles.heroFoot}>
                  <a
                    href="#how-borrowing-works"
                    onClick={toSteps}
                    className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    How borrowing works
                  </a>
                  <span className={styles.scrollHint} aria-hidden="true">
                    <i />
                    Scroll to open the book
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.sceneLayer} aria-hidden="true">
            <div className={styles.scene} data-part="scene">
              <div className={styles.anchor}>
                <div className={styles.shadow} data-part="shadow" />
                <div className={styles.float}>
                  <div className={styles.tilt} data-part="tilt">
                    <div className={styles.book} data-part="book">
                      <div className={`${styles.face} ${styles.back}`} />
                      <div className={`${styles.face} ${styles.spine}`}>
                        <b>LUMINA · STI ALABANG</b>
                      </div>
                      <div className={`${styles.face} ${styles.edgeFore}`} />
                      <div className={`${styles.face} ${styles.edgeTop}`} />
                      <div className={`${styles.face} ${styles.edgeBot}`} />
                      <div className={`${styles.face} ${styles.pagetop} ${styles.paper}`}>
                        <div className={styles.ribbon} />
                        <div className={styles.pageHead}>
                          <i />
                          <i />
                        </div>
                        <div className={styles.lines} />
                        <div className={styles.chipOk}>2 OF 3 COPIES IN</div>
                        <div className={styles.folio}>13</div>
                      </div>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className={styles.leaf} data-part="leaf" data-riffle={i <= 2 ? "" : undefined}>
                          {pageFace("pf")}
                          {pageFace("pb")}
                          <div className={styles.leafOut} data-part="leaf-out">
                            {pageFace("pf", 2 * i + 1)}
                            {pageFace("pb", 2 * i)}
                          </div>
                        </div>
                      ))}
                      <div className={styles.cover} data-part="cover">
                        <div className={`${styles.face} ${styles.cf}`}>
                          <div className={styles.frame} />
                          <div className={styles.mark} />
                          <div className={styles.coverTitle}>
                            <b>Lumina</b>
                            <span>Library catalog</span>
                          </div>
                          <div className={styles.coverFoot}>STI COLLEGE ALABANG</div>
                          <div className={styles.gloss} data-part="gloss" />
                          <div className={styles.shade} data-shade />
                        </div>
                        <div className={`${styles.face} ${styles.ci}`}>
                          <div className={styles.slip}>
                            <h4>DATE ISSUED</h4>
                            <ol>
                              <li className={styles.st}>AUG 14</li>
                              <li className={styles.st}>SEP 02</li>
                              <li className={styles.st}>OCT 21</li>
                              <li className={styles.today}>
                                <span data-part="stamp" />
                              </li>
                              <li />
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
                <div className={styles.words}>
                  {WORDS.map((w) => (
                    <span key={w.text} className={`${styles.word} ${w.kind.split(" ").map((c) => styles[c]).join(" ")}`} data-part="word">
                      {w.text}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <section className={styles.steps} aria-labelledby="how-borrowing-works">
            <div className={styles.stepsInner}>
              <div className={styles.eyebrow} data-part="eyebrow">
                <h2 id="how-borrowing-works" className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                  How borrowing works
                </h2>
              </div>
              <div className={styles.staticArt}>
                <BookArt />
              </div>
              <ol className={styles.cards}>
                {steps.map((step, i) => (
                  <li key={step.title} className={styles.card} data-part="card">
                    <span className={styles.ico} aria-hidden="true">
                      {ICONS[i % ICONS.length]}
                    </span>
                    <span className={styles.n}>Step {i + 1}</span>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <div className={styles.caption} data-part="caption" aria-hidden="true">
            <p className={styles.capTitle}>Every shelf, one search away.</p>
            <p>Look up any title by name, author or ISBN.</p>
          </div>
          <div className={styles.caption} data-part="caption" aria-hidden="true">
            <p className={styles.capTitle}>Open a book before you walk over.</p>
            <p>Each record shows how many copies are in and where the book sits on the shelf.</p>
          </div>
          <div className={`${styles.caption} ${styles.cta}`} data-part="caption">
            <a className={styles.ctaPrimary} href="#sign-in">Sign in to reserve</a>
            <a className={styles.ctaGhost} href="#before-you-sign-in">Before you sign in</a>
          </div>

          {/* Mouse shortcut between chapters; keyboard and screen readers get the same content in order. */}
          <div className={styles.hud} data-part="hud" aria-hidden="true">
            {ACTS.map((a) => (
              <button key={a.name} type="button" data-at={a.at} tabIndex={-1}>
                <span>{a.name}</span>
                <i />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Starts the pinned animation. Returns a function that removes every listener it added. */
function run(root: HTMLElement, jumpRef: { current: ((p: number) => boolean) | null }) {
  const q = <T extends HTMLElement = HTMLElement>(part: string) => root.querySelector<T>(`[data-part='${part}']`)!;
  const qa = (part: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-part='${part}']`));
  const track = q("track"), stage = q("stage"), scene = q("scene"), book = q("book"), tilt = q("tilt");
  const cover = q("cover"), gloss = q("gloss"), shadow = q("shadow"), heroInner = q("hero-inner");
  const eyebrow = q("eyebrow"), stamp = q("stamp"), hud = q("hud");
  const coverShades = Array.from(cover.querySelectorAll<HTMLElement>(":scope > div > [data-shade]"));
  const leaves = qa("leaf").map((el) => ({
    el,
    outer: el.querySelector<HTMLElement>("[data-part='leaf-out']")!,
    shades: Array.from(el.querySelectorAll<HTMLElement>("[data-shade]")),
  }));
  const words = qa("word"), cards = qa("card"), captions = qa("caption");
  const hudButtons = Array.from(hud.querySelectorAll<HTMLButtonElement>("button"));

  let L: Layout;
  let cardHalf: number[] = [];
  let trackTop = 0;
  let span = 1;
  const measure = () => {
    const vh = stage.clientHeight || window.innerHeight;
    const stageTop = stage.getBoundingClientRect().top;
    L = computeLayout({
      vw: stage.clientWidth || window.innerWidth,
      vh,
      cardWidth: cards[0]?.offsetWidth || 240,
      cardHeights: cards.map((c) => c.offsetHeight || 172),
      eyebrowHeight: eyebrow.offsetHeight || 36,
      heroBottom: heroInner.getBoundingClientRect().bottom - stageTop,
    });
    cardHalf = cards.map((c) => (c.offsetHeight || 172) / 2);
    trackTop = track.getBoundingClientRect().top + window.scrollY;
    span = Math.max(1, track.offsetHeight - vh);
  };

  // Each style is written only when its value changes, so parts that are not moving cost nothing.
  const written = new Map<HTMLElement, Partial<Record<"transform" | "opacity" | "visibility", string>>>();
  const put = (el: HTMLElement, key: "transform" | "opacity" | "visibility", value: string) => {
    let seen = written.get(el);
    if (!seen) written.set(el, (seen = {}));
    if (seen[key] === value) return;
    seen[key] = value;
    el.style[key] = value;
  };
  const r = (n: number) => Math.round(n * 100) / 100;
  // Shades repaint their page, so they move in coarse steps.
  const shade = (v: number) => String(Math.round(v * 25) / 25);

  let lastAct = -1;
  const apply = (f: Frame) => {
    put(scene, "transform", `translate3d(${r(f.scene.x)}px,${r(f.scene.y)}px,0) scale(${Math.round(f.scene.scale * 1000) / 1000})`);
    put(book, "transform", `translate3d(${r(f.book.x)}px,0,0) rotateX(${r(f.book.rx)}deg) rotateY(${r(f.book.ry)}deg) rotateZ(${r(f.book.rz)}deg)`);
    put(tilt, "transform", `rotateX(${r(f.tilt.rx)}deg) rotateY(${r(f.tilt.ry)}deg)`);
    put(gloss, "transform", `translate3d(${r(f.gloss)}%,0,0)`);
    put(cover, "transform", `translateZ(${r(f.cover.z)}px) rotateY(${r(f.cover.angle)}deg)`);
    coverShades.forEach((el) => put(el, "opacity", shade(f.cover.shade)));
    leaves.forEach((lf, i) => {
      const p = f.leaves[i];
      put(lf.el, "transform", `translateZ(${r(p.z)}px) rotateY(${r(p.angle)}deg)`);
      put(lf.outer, "transform", `rotateY(${r(p.bend)}deg)`);
      lf.shades.forEach((el) => put(el, "opacity", shade(p.shade)));
    });
    put(shadow, "transform", `translate3d(0,${r(f.shadow.y)}px,-30px) scale(${r(f.shadow.sx)},${r(f.shadow.sy)})`);
    put(shadow, "opacity", String(r(f.shadow.opacity)));
    put(heroInner, "opacity", String(r(f.hero.opacity)));
    put(heroInner, "transform", `translate3d(${r(f.hero.x)}px,0,0)`);
    put(heroInner, "visibility", f.hero.hidden ? "hidden" : "");
    words.forEach((el, i) => {
      const w = f.words[i];
      put(el, "opacity", String(r(w.opacity)));
      put(el, "visibility", w.opacity > 0 ? "visible" : "hidden");
      if (w.opacity > 0) put(el, "transform", `translate(-50%,-50%) translate3d(${r(w.x)}px,${r(w.y)}px,${r(w.z)}px) rotate(${r(w.rz)}deg) scale(${r(w.scale)})`);
    });
    cards.forEach((el, i) => {
      const c = f.cards[i];
      if (!c) return;
      put(el, "transform", `translate3d(${r(c.x)}px,${r(c.y - (cardHalf[i] ?? 86))}px,${r(c.z)}px) rotateX(${r(c.rx)}deg) rotateY(${r(c.ry)}deg) rotateZ(${r(c.rz)}deg) scale(${r(c.scale)})`);
      put(el, "opacity", String(r(c.opacity)));
      put(el, "visibility", c.opacity > 0 ? "visible" : "hidden");
    });
    put(eyebrow, "transform", `translate(-50%,-50%) translate3d(0,${r(f.eyebrow.y)}px,0)`);
    put(eyebrow, "opacity", String(r(f.eyebrow.opacity)));
    captions.forEach((el, i) => {
      const v = r(f.captions[i] ?? 0);
      put(el, "opacity", String(v));
      put(el, "transform", `translate3d(-50%,${r((1 - v) * 18)}px,0)`);
      put(el, "visibility", v > 0 ? "visible" : "hidden");
    });
    put(stamp, "opacity", String(r(f.stamp.opacity)));
    put(stamp, "transform", `rotate(-7deg) scale(${r(f.stamp.scale)})`);
    if (f.act !== lastAct) {
      hudButtons.forEach((b, i) => b.toggleAttribute("data-on", i === f.act));
      root.dataset.act = String(f.act);
      lastAct = f.act;
    }
  };

  let s = 0;
  let target = 0;
  let px = 0, py = 0, tx = 0, ty = 0;
  let spin: Spin = { ...SPIN_REST };
  let raf = 0;
  let last = 0;
  let touched = false;

  const readTarget = () => {
    target = Math.min(1, Math.max(0, (window.scrollY - trackTop) / span));
  };
  const draw = () => apply(computeFrame(s, L, { spin: spin.angle, pointerX: tx, pointerY: ty }));
  const loop = (now: number) => {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    const a = 1 - Math.exp(-dt / 0.085);
    s += (target - s) * a;
    if (Math.abs(target - s) < 0.0003) s = target;
    tx += (px - tx) * a;
    ty += (py - ty) * a;
    spin = stepSpin(spin, dt);
    draw();
    const settled = s === target && Math.abs(px - tx) < 0.002 && Math.abs(py - ty) < 0.002 && spinSettled(spin);
    if (settled) last = 0;
    else raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };

  const onScroll = () => {
    readTarget();
    kick();
  };
  const hover = window.matchMedia("(hover: hover)").matches;
  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    px = (e.clientX / L.vw - 0.5) * 2;
    py = (e.clientY / L.vh - 0.5) * 2;
    kick();
  };

  // Grab the book: drag or swipe sideways to spin it, tap to flip it. Vertical swipes still scroll.
  let downX = 0, lastX = 0, lastT = 0, downT = 0, moved = 0;
  const onDown = (e: PointerEvent) => {
    if (s > 0.12) return;
    touched = true;
    spin = { ...spin, dragging: true, vel: 0 };
    downX = lastX = e.clientX;
    downT = lastT = performance.now();
    moved = 0;
    book.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!spin.dragging) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    const dt = Math.max(0.008, (now - lastT) / 1000);
    moved = Math.max(moved, Math.abs(e.clientX - downX));
    spin = { angle: spin.angle + dx * 0.6, vel: (dx * 0.6) / dt, dragging: true };
    lastX = e.clientX;
    lastT = now;
    kick();
  };
  const onUp = (e: PointerEvent) => {
    if (!spin.dragging) return;
    book.releasePointerCapture?.(e.pointerId);
    const tap = moved < 6 && performance.now() - downT < 350;
    spin = { angle: spin.angle, vel: tap ? spin.vel + TAP_FLIP : spin.vel, dragging: false };
    if (tap) navigator.vibrate?.(8);
    kick();
  };

  const jump = (p: number) => {
    window.scrollTo({ top: trackTop + p * span, behavior: "smooth" });
    return true;
  };
  jumpRef.current = jump;
  const onHud = (e: Event) => {
    const at = (e.target as HTMLElement).closest("button")?.dataset.at;
    if (at !== undefined) jump(Number(at) + (Number(at) > 0 ? 0.02 : 0));
  };

  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  let lastWidth = window.innerWidth;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Mobile toolbars change the height while scrolling; the stage uses svh, so only width matters there.
      if (!hover && window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      measure();
      readTarget();
      s = target;
      draw();
    }, 100);
  };

  // A small wiggle hints that the book can be handled, once, if nobody has scrolled or touched yet.
  const nudge = setTimeout(() => {
    if (!touched && target < 0.01) {
      spin = { ...spin, vel: 200 };
      kick();
    }
  }, 2600);

  const io =
    typeof IntersectionObserver === "function"
      ? new IntersectionObserver(([entry]) => {
          root.dataset.paused = entry?.isIntersecting ? "false" : "true";
        })
      : null;
  io?.observe(stage);

  measure();
  readTarget();
  s = target;
  draw();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  if (hover) window.addEventListener("pointermove", onPointer, { passive: true });
  book.addEventListener("pointerdown", onDown);
  book.addEventListener("pointermove", onMove);
  book.addEventListener("pointerup", onUp);
  book.addEventListener("pointercancel", onUp);
  hud.addEventListener("click", onHud);

  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(resizeTimer);
    clearTimeout(nudge);
    io?.disconnect();
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("pointermove", onPointer);
    book.removeEventListener("pointerdown", onDown);
    book.removeEventListener("pointermove", onMove);
    book.removeEventListener("pointerup", onUp);
    book.removeEventListener("pointercancel", onUp);
    hud.removeEventListener("click", onHud);
    [scene, book, tilt, gloss, cover, shadow, heroInner, eyebrow, stamp, ...coverShades, ...leaves.flatMap((l) => [l.el, l.outer, ...l.shades]), ...words, ...cards, ...captions].forEach((el) => {
      el.style.transform = "";
      el.style.opacity = "";
      el.style.visibility = "";
    });
    delete root.dataset.paused;
    delete root.dataset.act;
  };
}
