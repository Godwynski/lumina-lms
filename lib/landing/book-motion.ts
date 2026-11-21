/**
 * Pure motion math for the interactive 3D hero book (components/landing/InteractiveBook.tsx).
 * Every function is deterministic and side-effect-free so physics and pose interpolation can be
 * unit-tested directly without a browser.
 */

/** Book dimensions in scene pixels: width, height, depth, total moving sheets (cover + 3 leaves), sheet spacing. */
export const BOOK = { W: 236, H: 318, D: 32, N: 4, G: 1.6 } as const;

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Resting hinge angle (degrees) of the front cover when opened. */
export const OPEN_REST_ANGLE = -172;

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const RAD = Math.PI / 180;

/**
 * Depth (translateZ) of sheet k (0 = front cover, 1..3 = leaves) at hinge angle a
 * (0 closed, -172 open). Swaps stack order smoothly while the sheet passes upright (-90deg).
 */
export function zFor(k: number, angle: number) {
  const { D, N, G } = BOOK;
  const right = D / 2 - k * G;
  const left = D / 2 - (N - k) * G;
  return lerp(right, left, clamp((-angle - 80) / 20));
}

export interface BookPose {
  book: { x: number; rx: number; ry: number; rz: number };
  tilt: { rx: number; ry: number };
  gloss: number;
  cover: { z: number; angle: number; shade: number };
  leaves: { z: number; angle: number; bend: number; shade: number }[];
  shadow: { sx: number; sy: number; opacity: number };
  stamp: { opacity: number; scale: number };
}

export interface BookPoseExtras {
  /** Extra spin in degrees from dragging or clicking "Spin book". */
  spin?: number;
  /** Normalized pointer offset, -1..1 on each axis. */
  pointerX?: number;
  pointerY?: number;
}

/** Computes the full 3D pose of the book given open progress (0 = closed, 1 = open) and pointer/spin extras. */
export function computeBookPose(openIn: number, extras: BookPoseExtras = {}): BookPose {
  const open = clamp(Number.isFinite(openIn) ? openIn : 0);
  const openE = easeInOutCubic(open);

  const px = clamp(Number.isFinite(extras.pointerX ?? 0) ? (extras.pointerX ?? 0) : 0, -1, 1);
  const py = clamp(Number.isFinite(extras.pointerY ?? 0) ? (extras.pointerY ?? 0) : 0, -1, 1);
  const spin = Number.isFinite(extras.spin ?? 0) ? (extras.spin ?? 0) : 0;

  // Hand spin fades smoothly as the cover opens so the two-page spread faces the reader squarely.
  const ry = lerp(-26, 0, openE) + spin * (1 - openE);
  const coverAngle = OPEN_REST_ANGLE * openE;

  const leaves = [1, 2, 3].map((k) => {
    const start = 0.08 + k * 0.1;
    const end = start + 0.54;
    const t = easeInOutCubic(clamp((open - start) / (end - start)));
    const angle = -(172 - 1.5 * k) * t;
    return {
      z: zFor(k, angle),
      angle,
      bend: -Math.sin(Math.PI * t) * 24,
      shade: Math.sin(-angle * RAD) * 0.36,
    };
  });

  const stampT = clamp((open - 0.55) / (0.88 - 0.55));
  const stampE = easeOutCubic(stampT);

  return {
    book: {
      x: openE * (BOOK.W * 0.5),
      rx: lerp(10, 26, openE),
      ry,
      rz: lerp(-4, 0, openE),
    },
    tilt: {
      rx: -py * lerp(6, 2.5, openE),
      ry: px * lerp(8, 3.5, openE),
    },
    gloss: ((((ry % 360) + 360) % 360) / 360) * 110 - 55 + px * 10,
    cover: {
      z: zFor(0, coverAngle),
      angle: coverAngle,
      shade: Math.sin(-coverAngle * RAD) * 0.32,
    },
    leaves,
    shadow: {
      sx: lerp(1, 1.85, openE),
      sy: lerp(1, 1.35, openE),
      opacity: lerp(0.85, 0.55, openE),
    },
    stamp: {
      opacity: stampE,
      scale: lerp(1.65, 1, stampE),
    },
  };
}

/** Advances open progress (0..1) toward target with exponential damping. */
export function stepOpen(current: number, target: number, dt: number): number {
  const next = current + (target - current) * (1 - Math.exp(-8.5 * dt));
  return Math.abs(target - next) < 0.001 ? target : next;
}

export interface Spin {
  angle: number;
  vel: number;
  dragging: boolean;
}

export const SPIN_REST: Spin = { angle: 0, vel: 0, dragging: false };

/** Angular velocity added by clicking "Spin book": produces one crisp full rotation before settling. */
export const TAP_FLIP = 720;

/**
 * Advances hand spin by dt seconds. Fast spins coast with friction; slower offsets spring smoothly
 * back to the nearest whole turn so the cover always comes to rest facing the visitor.
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

/** Formats a date as an uppercase library slip stamp, e.g. "NOV 21". */
export function formatStampDate(d: Date) {
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `${month} ${String(d.getDate()).padStart(2, "0")}`;
}
