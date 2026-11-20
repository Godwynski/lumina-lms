/**
 * Motion math for the landing page book (components/landing/book-stage.tsx).
 * Everything here is pure: given the scroll progress s (0..1) and a measured layout, it returns
 * where every part of the book, the flying words and the step cards should be. The component only
 * writes these numbers into transform and opacity, so the browser never has to lay out a frame.
 */

/** Book size in scene pixels: width, height, depth. N moving sheets (cover + 5 leaves), G px apart. */
export const BOOK = { W: 240, H: 330, D: 34, N: 6, G: 1.4 } as const;

/** Must match the media query in book-stage.module.css that switches on the pinned stage. */
export const CINE_QUERY = "(prefers-reduced-motion: no-preference) and (scripting: enabled) and (min-height: 560px)";

/** Scroll progress at which each step card starts to leave the book. */
export const CARD_AT = [0.58, 0.67, 0.76] as const;

export const ACTS = [
  { name: "Intro", at: 0, to: 0.12 },
  { name: "Toss", at: 0.12, to: 0.38 },
  { name: "Open", at: 0.38, to: 0.56 },
  { name: "Steps", at: 0.56, to: 0.9 },
  { name: "Ready", at: 0.9, to: 1 },
] as const;

/** Scroll progress of the finished "How borrowing works" row, used by the in-page link. */
export const STEPS_DONE_AT = 0.9;

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
/** 0..1 progress of s through the window [a, b]. */
export const seg = (s: number, a: number, b: number) => clamp((s - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const RAD = Math.PI / 180;

/**
 * Depth of sheet k (0 = cover, 1..5 = leaves) at hinge angle a (0 closed, about -180 turned).
 * On the right pile the cover is on top; once a sheet passes 90 degrees it joins the left pile,
 * where the order is reversed, so the depth swaps while the sheet stands upright and the swap is invisible.
 */
export function zFor(k: number, angle: number) {
  const { D, N, G } = BOOK;
  const right = D / 2 - k * G;
  const left = D / 2 - (N - k) * G;
  return lerp(right, left, clamp((-angle - 80) / 20));
}

export function actIndex(s: number) {
  let act = 0;
  ACTS.forEach((a, i) => {
    if (s >= a.at) act = i;
  });
  return act;
}

export interface LayoutInput {
  vw: number;
  vh: number;
  cardWidth: number;
  cardHeights: number[];
  eyebrowHeight: number;
  /** Bottom edge of the hero copy, in px from the top of the stage. */
  heroBottom: number;
}

export interface Layout {
  vw: number;
  vh: number;
  /** Scene scale. */
  k: number;
  /** Phones: hero copy on top and the book below it, instead of side by side. */
  stacked: boolean;
  heroX: number;
  heroY: number;
  /** Extra scale for the hero book so it fits under the hero copy on short phones. */
  heroScale: number;
  /** Cards finish in a row when three fit across, otherwise in a column. */
  row: boolean;
  cardSlots: { x: number; y: number }[];
  eyebrowY: number;
  openBookY: number;
  stepsBookY: number;
  showCta: boolean;
  wordSpread: number;
  /** Cards shrink (never below 0.72) when the finished column would run off a short screen. */
  cardScale: number;
}

/** All positions are px offsets from the centre of the stage. */
export function computeLayout(i: LayoutInput): Layout {
  const { vw, vh, cardWidth, cardHeights, eyebrowHeight, heroBottom } = i;
  const stacked = vw < 768;
  const k = stacked ? clamp((vw - 40) / 470, 0.52, 0.72) : clamp(Math.min(vw / 1200, vh / 760), 0.7, 1.3);
  const gap = vw < 900 ? 12 : 20;
  const row = 3 * cardWidth + 2 * gap <= vw - 48;
  const bookHalf = 110 * k; // half the height of the open book seen at its resting tilt
  const ctaTop = vh / 2 - vh * 0.045 - 44;
  // On phones the closed book sits under the hero copy; its tilted height with shadow is about 1.15 x H.
  const heroBook = 330 * k * 1.15;
  const heroScale = stacked ? clamp((vh - heroBottom - 36) / heroBook, 0.38, 1) : 1;

  let cardSlots: { x: number; y: number }[];
  let eyebrowY: number;
  let stepsBookY: number;
  let cardScale = 1;
  if (row) {
    const rowY = -vh * 0.17;
    const tallest = Math.max(0, ...cardHeights);
    cardSlots = cardHeights.map((_, j) => ({ x: (j - 1) * (cardWidth + gap), y: rowY }));
    eyebrowY = rowY - tallest / 2 - 24 - eyebrowHeight / 2;
    stepsBookY = vh * 0.15;
  } else {
    const top = -vh / 2 + Math.max(40, vh * 0.07) + eyebrowHeight + 12;
    const natural = cardHeights.reduce((a, h) => a + h, 0) + 10 * Math.max(0, cardHeights.length - 1);
    cardScale = natural > 0 ? clamp((vh / 2 - 16 - top) / natural, 0.72, 1) : 1;
    const colGap = 10 * cardScale;
    let y = top;
    cardSlots = cardHeights.map((h) => {
      const slot = { x: 0, y: y + (h * cardScale) / 2 };
      y += h * cardScale + colGap;
      return slot;
    });
    eyebrowY = top - 12 - eyebrowHeight / 2;
    // Keep at least the top of the book on screen so the cards visibly come out of it.
    stepsBookY = Math.min(y - colGap + 24 + bookHalf, vh / 2 - 40);
  }

  return {
    vw,
    vh,
    k,
    stacked,
    heroX: stacked ? 0 : vw * (vw >= 1100 ? 0.23 : 0.22),
    heroY: stacked ? heroBottom + 20 + (heroBook * heroScale) / 2 - vh / 2 : 0,
    heroScale,
    row,
    cardSlots,
    eyebrowY,
    openBookY: stacked ? vh * 0.04 : vh * 0.15,
    stepsBookY,
    showCta: stepsBookY + bookHalf + 8 < ctaTop,
    wordSpread: stacked ? 0.6 : 1,
    cardScale,
  };
}

export const WORDS: { text: string; kind: "chip" | "glyph" | "glyph accent" | "tiny" }[] = [
  { text: "Title", kind: "chip" },
  { text: "A", kind: "glyph" },
  { text: "Author", kind: "chip" },
  { text: "ISBN", kind: "chip" },
  { text: "Shelf location", kind: "chip" },
  { text: "¶", kind: "glyph accent" },
  { text: "Available", kind: "chip" },
  { text: "call number", kind: "tiny" },
  { text: "Reserve for pickup", kind: "chip" },
  { text: "Z", kind: "glyph" },
  { text: "Queue position", kind: "chip" },
  { text: "Ready for pickup", kind: "chip" },
  { text: "&", kind: "glyph accent" },
  { text: "Due date", kind: "chip" },
  { text: "library card", kind: "tiny" },
  { text: "Circulation desk", kind: "chip" },
  { text: "Return", kind: "chip" },
  { text: "My Borrowing", kind: "chip" },
  { text: "Q", kind: "glyph" },
  { text: "fiction · reference · filipiniana", kind: "tiny" },
];

/** Fixed flight paths (no randomness) so the burst plays the same on every visit and in tests. */
export const WORD_PATHS = WORDS.map((_, i) => {
  const side = i % 2 ? 1 : -1;
  const r1 = ((i * 37) % 17) / 16;
  const r2 = ((i * 53) % 13) / 12;
  const r3 = ((i * 29) % 11) / 10;
  return {
    dx: side * (60 + r1 * 340),
    dy: -(150 + r2 * 260),
    dz: -60 + r3 * 260,
    rot: side * (6 + r1 * 22) * (i % 3 ? 1 : -1),
    delay: 0.5 + (i / WORDS.length) * 0.24,
  };
});

export interface Pose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number;
  opacity: number;
}

export interface Frame {
  scene: { x: number; y: number; scale: number };
  book: { x: number; rx: number; ry: number; rz: number };
  tilt: { rx: number; ry: number };
  gloss: number;
  cover: { z: number; angle: number; shade: number };
  leaves: { z: number; angle: number; bend: number; shade: number }[];
  shadow: { y: number; sx: number; sy: number; opacity: number };
  hero: { opacity: number; x: number; hidden: boolean };
  words: Pose[];
  cards: Pose[];
  eyebrow: { y: number; opacity: number };
  captions: [number, number, number];
  stamp: { opacity: number; scale: number };
  act: number;
}

export interface FrameExtras {
  /** Extra spin in degrees from dragging or tapping the book. */
  spin?: number;
  /** Pointer position, -1..1 on each axis. */
  pointerX?: number;
  pointerY?: number;
}

const fade = (s: number, a: number, b: number) => Math.min(seg(s, a, a + 0.04), 1 - seg(s, b - 0.04, b));

export function computeFrame(sIn: number, L: Layout, x: FrameExtras = {}): Frame {
  const { W, H } = BOOK;
  const s = clamp(Number.isFinite(sIn) ? sIn : 0);
  const toss = seg(s, 0.12, 0.38);
  const tossE = ease(toss);
  const arc = Math.sin(Math.PI * toss);
  const open = ease(seg(s, 0.38, 0.52));
  const toSteps = ease(seg(s, 0.54, 0.6));
  const settle = ease(seg(s, 0.9, 0.99));
  const travel = ease(seg(s, 0.02, 0.3));

  // Pointer tilt and hand spin belong to the closed book; both hand over to the scroll story.
  const pointerFade = 1 - seg(s, 0.5, 0.6);
  const spinFade = 1 - seg(s, 0.1, 0.16);
  const pointerX = (x.pointerX ?? 0) * pointerFade;
  const pointerY = (x.pointerY ?? 0) * pointerFade;
  const ry = lerp(-32, 360, tossE) + (x.spin ?? 0) * spinFade;

  const coverAngle = -178 * open;
  const leaves = [1, 2, 3, 4, 5].map((i) => {
    const t =
      i <= 2
        ? ease(seg(s, 0.41 + i * 0.03, 0.53 + i * 0.03))
        : ease(seg(s, CARD_AT[i - 3] - 0.02, CARD_AT[i - 3] + 0.07));
    const angle = -(178 - 1.2 * i) * t;
    return { z: zFor(i, angle), angle, bend: -Math.sin(Math.PI * t) * 26, shade: Math.sin(-angle * RAD) * 0.4 };
  });

  const words = WORD_PATHS.map((p) => {
    const t = seg(s, p.delay, p.delay + 0.2);
    if (t <= 0 || t >= 1) return { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 0.35, opacity: 0 };
    const e = easeOut(t);
    return {
      x: p.dx * L.wordSpread * e,
      y: p.dy * e,
      z: 30 + p.dz * e,
      rx: 0,
      ry: 0,
      rz: p.rot * e,
      scale: 0.35 + 0.65 * e,
      opacity: Math.min(t / 0.12, 1, (1 - t) / 0.35),
    };
  });

  const cards = L.cardSlots.map((slot, j) => {
    const t = seg(s, CARD_AT[j] ?? 1, (CARD_AT[j] ?? 1) + 0.13);
    const e = easeOut(t);
    const lift = Math.sin(Math.PI * e);
    const toward = L.row ? 1 - j : 0;
    return {
      x: lerp(W * 0.5 * L.k, slot.x, e),
      y: lerp(L.stepsBookY, slot.y, e) - lift * 30,
      z: lift * 170,
      rx: lerp(58, 0, e),
      ry: lerp(0, toward * 9, e),
      rz: lift * (L.row ? j - 1 : j % 2 ? 1 : -1) * 6,
      scale: lerp(0.35, 1, e) * L.cardScale,
      opacity: clamp(t * 5),
    };
  });

  const eyebrowIn = seg(s, 0.6, 0.68);
  const stampT = seg(s, 0.47, 0.5);

  return {
    scene: {
      x: lerp(L.heroX, 0, travel),
      y: lerp(L.heroY, 0, travel) - arc * L.vh * 0.1 + open * L.openBookY + toSteps * (L.stepsBookY - L.openBookY),
      scale: L.k * lerp(L.heroScale, 1, travel) * (1 + arc * 0.1) * (1 - 0.06 * open) * (1 - 0.04 * settle),
    },
    book: { x: open * (W / 2), rx: lerp(12, 52, tossE) + settle * 4, ry, rz: lerp(-5, 0, tossE) - arc * 12 },
    tilt: { rx: -pointerY * 5, ry: pointerX * 7 },
    gloss: ((((ry % 360) + 360) % 360) / 360) * 110 - 55 + pointerX * 10,
    cover: { z: zFor(0, coverAngle), angle: coverAngle, shade: Math.sin(-coverAngle * RAD) * 0.35 },
    leaves,
    shadow: { y: lerp(H / 2 + 26, H * 0.3, tossE), sx: lerp(1, 2, open), sy: lerp(1, 1.7, open), opacity: 0.9 * (1 - 0.65 * arc) },
    hero: { opacity: 1 - seg(s, 0.015, 0.1), x: -ease(seg(s, 0, 0.12)) * 70, hidden: s > 0.12 },
    words,
    cards,
    eyebrow: { y: L.eyebrowY + (1 - eyebrowIn) * 16, opacity: eyebrowIn },
    captions: [fade(s, 0.15, 0.37), fade(s, 0.39, 0.57), L.showCta ? fade(s, 0.9, 1.5) : 0],
    stamp: { opacity: easeOut(stampT), scale: lerp(1.9, 1, easeOut(stampT)) },
    act: actIndex(s),
  };
}

export interface Spin {
  angle: number;
  vel: number;
  dragging: boolean;
}

export const SPIN_REST: Spin = { angle: 0, vel: 0, dragging: false };
/** Velocity a tap or click adds: enough for one full flip before the spring takes over. */
export const TAP_FLIP = 720;

/**
 * Advances the hand spin by dt seconds. A fast spin coasts on friction; a slow one springs to the
 * nearest whole turn so the cover always ends up facing the reader.
 */
export function stepSpin(sp: Spin, dt: number): Spin {
  if (sp.dragging) return sp;
  let { angle, vel } = sp;
  if (Math.abs(vel) > 240) {
    vel *= Math.exp(-2.4 * dt);
    angle += vel * dt;
  } else {
    const target = Math.round(angle / 360) * 360;
    vel += (70 * (target - angle) - 16 * vel) * dt;
    angle += vel * dt;
    if (Math.abs(target - angle) < 0.05 && Math.abs(vel) < 0.5) return { ...SPIN_REST };
  }
  return { angle, vel, dragging: false };
}

export const spinSettled = (sp: Spin) => !sp.dragging && sp.vel === 0 && sp.angle === 0;

/** "NOV 21": the date stamped on the slip inside the cover. */
export function formatStampDate(d: Date) {
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `${month} ${String(d.getDate()).padStart(2, "0")}`;
}
