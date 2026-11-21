import { describe, expect, it } from "vitest";
import {
  BOOK,
  OPEN_REST_ANGLE,
  SPIN_REST,
  TAP_FLIP,
  computeBookPose,
  formatStampDate,
  spinSettled,
  stepOpen,
  stepSpin,
  zFor,
} from "@/lib/landing/book-motion";

describe("zFor stack order", () => {
  it("keeps the cover on top of the right pile while closed", () => {
    const covers = [0, 1, 2, 3].map((k) => zFor(k, 0));
    for (let k = 1; k < covers.length; k++) expect(covers[k]).toBeLessThan(covers[k - 1]);
    expect(covers[0]).toBe(BOOK.D / 2);
  });

  it("reverses the order on the left pile once sheets pass 90 degrees", () => {
    const turned = [0, 1, 2, 3].map((k) => zFor(k, OPEN_REST_ANGLE));
    for (let k = 1; k < turned.length; k++) expect(turned[k]).toBeGreaterThan(turned[k - 1]);
  });

  it("does not move a sheet in depth until it stands upright", () => {
    expect(zFor(1, -79)).toBe(zFor(1, 0));
    expect(zFor(1, -100)).toBe(zFor(1, OPEN_REST_ANGLE));
    const mid = zFor(1, -90);
    expect(mid).toBeGreaterThan(Math.min(zFor(1, 0), zFor(1, OPEN_REST_ANGLE)));
    expect(mid).toBeLessThan(Math.max(zFor(1, 0), zFor(1, OPEN_REST_ANGLE)));
  });
});

describe("computeBookPose", () => {
  it("starts closed at a 3/4 hero angle with leaves flat and stamp hidden", () => {
    const pose = computeBookPose(0);
    expect(pose.book).toEqual({ x: 0, rx: 10, ry: -26, rz: -4 });
    expect(pose.cover.angle).toBeCloseTo(0);
    expect(pose.leaves).toHaveLength(3);
    expect(pose.leaves.every((l) => Math.abs(l.angle) < 1e-9 && Math.abs(l.bend) < 1e-9)).toBe(true);
    expect(pose.stamp.opacity).toBe(0);
  });

  it("opens squarely to a centered two-page spread with the date stamp visible", () => {
    const pose = computeBookPose(1);
    expect(pose.book.x).toBeCloseTo(BOOK.W * 0.5);
    expect(pose.book.ry).toBeCloseTo(0);
    expect(pose.book.rx).toBeCloseTo(26);
    expect(pose.cover.angle).toBeCloseTo(OPEN_REST_ANGLE);
    expect(pose.leaves.every((l) => l.angle < -160)).toBe(true);
    expect(pose.stamp.opacity).toBe(1);
    expect(pose.stamp.scale).toBe(1);
  });

  it("riffles the three leaves in staggered sequence with page bend mid-turn", () => {
    const early = computeBookPose(0.25);
    expect(early.leaves[0].angle).toBeLessThan(0);
    expect(early.leaves[1].angle).toBeCloseTo(0);
    expect(early.leaves[2].angle).toBeCloseTo(0);
    expect(early.leaves[0].bend).toBeLessThan(0);

    const mid = computeBookPose(0.5);
    expect(mid.leaves[0].angle).toBeLessThan(mid.leaves[1].angle);
    expect(mid.leaves[1].angle).toBeLessThan(mid.leaves[2].angle);
  });

  it("applies hand spin only while closed and softens pointer tilt when opened", () => {
    const closedSpin = computeBookPose(0, { spin: 90, pointerX: 1, pointerY: -1 });
    expect(closedSpin.book.ry).toBeCloseTo(-26 + 90);
    expect(closedSpin.tilt).toEqual({ rx: 6, ry: 8 });

    const openPose = computeBookPose(1, { spin: 90, pointerX: 1, pointerY: -1 });
    expect(openPose.book.ry).toBeCloseTo(0);
    expect(openPose.tilt).toEqual({ rx: 2.5, ry: 3.5 });
  });

  it("clamps open progress and pointer inputs and treats NaN safely", () => {
    expect(computeBookPose(-2)).toEqual(computeBookPose(0));
    expect(computeBookPose(5)).toEqual(computeBookPose(1));
    expect(computeBookPose(Number.NaN)).toEqual(computeBookPose(0));
    expect(computeBookPose(0, { pointerX: 9, pointerY: -9 }).tilt).toEqual({ rx: 6, ry: 8 });
  });
});

describe("stepOpen", () => {
  it("approaches target smoothly and snaps when close", () => {
    let open = 0;
    for (let i = 0; i < 90; i++) open = stepOpen(open, 1, 1 / 60);
    expect(open).toBe(1);

    for (let i = 0; i < 90; i++) open = stepOpen(open, 0, 1 / 60);
    expect(open).toBe(0);
  });
});

describe("stepSpin", () => {
  const settle = (start: typeof SPIN_REST, maxSteps = 2000) => {
    let sp = start;
    for (let i = 0; i < maxSteps && !spinSettled(sp); i++) sp = stepSpin(sp, 1 / 60);
    return sp;
  };

  it("leaves a dragged spin alone", () => {
    const held = { angle: 45, vel: 300, dragging: true };
    expect(stepSpin(held, 0.016)).toBe(held);
  });

  it("springs a small offset back to face the visitor", () => {
    const sp = settle({ angle: 70, vel: 0, dragging: false });
    expect(spinSettled(sp)).toBe(true);
    expect(sp).toEqual(SPIN_REST);
  });

  it("turns a spin impulse into one full flip and comes to rest", () => {
    let sp = { ...SPIN_REST, vel: TAP_FLIP };
    let maxAngle = 0;
    for (let i = 0; i < 2000 && !spinSettled(sp); i++) {
      sp = stepSpin(sp, 1 / 60);
      maxAngle = Math.max(maxAngle, sp.angle);
    }
    expect(maxAngle).toBeGreaterThan(270);
    expect(spinSettled(sp)).toBe(true);
  });

  it("stays stable on a slow frame", () => {
    const sp = settle({ angle: 170, vel: 0, dragging: false });
    expect(Number.isFinite(sp.angle)).toBe(true);
    let wild = { angle: 170, vel: 0, dragging: false };
    for (let i = 0; i < 400; i++) wild = stepSpin(wild, 0.05);
    expect(Math.abs(wild.angle)).toBeLessThan(400);
  });
});

describe("formatStampDate", () => {
  it("formats the slip stamp as an uppercase month and two-digit day", () => {
    expect(formatStampDate(new Date(2026, 10, 21))).toBe("NOV 21");
    expect(formatStampDate(new Date(2026, 0, 5))).toBe("JAN 05");
  });
});
