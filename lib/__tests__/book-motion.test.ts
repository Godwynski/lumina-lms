import { describe, expect, it } from "vitest";
import {
  BOOK,
  CARD_AT,
  SPIN_REST,
  TAP_FLIP,
  WORDS,
  actIndex,
  computeFrame,
  computeLayout,
  formatStampDate,
  spinSettled,
  stepSpin,
  zFor,
  type LayoutInput,
} from "@/lib/landing/book-motion";

const desktop: LayoutInput = { vw: 1440, vh: 900, cardWidth: 278, cardHeights: [190, 200, 230], eyebrowHeight: 36, heroBottom: 600 };
const phone: LayoutInput = { vw: 390, vh: 844, cardWidth: 350, cardHeights: [120, 140, 160], eyebrowHeight: 32, heroBottom: 360 };
const tinyPhone: LayoutInput = { vw: 375, vh: 667, cardWidth: 335, cardHeights: [150, 170, 190], eyebrowHeight: 32, heroBottom: 420 };

describe("zFor stack order", () => {
  it("keeps the cover on top of the right pile while closed", () => {
    const covers = [0, 1, 2, 3, 4, 5].map((k) => zFor(k, 0));
    for (let k = 1; k < covers.length; k++) expect(covers[k]).toBeLessThan(covers[k - 1]);
    expect(covers[0]).toBe(BOOK.D / 2);
  });

  it("reverses the order on the left pile once sheets pass 90 degrees", () => {
    const turned = [0, 1, 2, 3, 4, 5].map((k) => zFor(k, -178));
    for (let k = 1; k < turned.length; k++) expect(turned[k]).toBeGreaterThan(turned[k - 1]);
  });

  it("does not move a sheet in depth until it stands upright", () => {
    expect(zFor(2, -79)).toBe(zFor(2, 0));
    expect(zFor(2, -100)).toBe(zFor(2, -178));
    const mid = zFor(2, -90);
    expect(mid).toBeGreaterThan(Math.min(zFor(2, 0), zFor(2, -178)));
    expect(mid).toBeLessThan(Math.max(zFor(2, 0), zFor(2, -178)));
  });
});

describe("computeLayout", () => {
  it("puts the hero book beside the copy and the cards in a row on wide screens", () => {
    const L = computeLayout(desktop);
    expect(L.stacked).toBe(false);
    expect(L.row).toBe(true);
    expect(L.heroX).toBeGreaterThan(0);
    expect(L.heroY).toBe(0);
    expect(L.cardSlots.map((c) => c.y)).toEqual([L.cardSlots[0].y, L.cardSlots[0].y, L.cardSlots[0].y]);
    expect(L.cardSlots[0].x).toBeLessThan(0);
    expect(L.cardSlots[1].x).toBe(0);
    expect(L.cardSlots[2].x).toBeGreaterThan(0);
    expect(L.eyebrowY).toBeLessThan(L.cardSlots[0].y - 230 / 2);
    expect(L.showCta).toBe(true);
    expect(L.k).toBeLessThanOrEqual(1.3);
  });

  it("stacks the hero and drops the cards into a non-overlapping column on phones", () => {
    const L = computeLayout(phone);
    expect(L.stacked).toBe(true);
    expect(L.row).toBe(false);
    expect(L.heroX).toBe(0);
    // Book sits below the hero copy's bottom edge.
    expect(L.heroY + phone.vh / 2).toBeGreaterThan(phone.heroBottom);
    L.cardSlots.forEach((slot, j) => {
      expect(slot.x).toBe(0);
      if (j > 0) {
        const prevBottom = L.cardSlots[j - 1].y + phone.cardHeights[j - 1] / 2;
        const top = slot.y - phone.cardHeights[j] / 2;
        expect(top).toBeGreaterThanOrEqual(prevBottom);
      }
    });
    expect(L.eyebrowY).toBeLessThan(L.cardSlots[0].y - phone.cardHeights[0] / 2);
    expect(L.stepsBookY).toBeGreaterThan(L.cardSlots[2].y + phone.cardHeights[2] / 2);
    expect(L.k).toBeGreaterThanOrEqual(0.52);
    expect(L.k * BOOK.W * 2).toBeLessThanOrEqual(phone.vw);
  });

  it("falls back to a column when three cards do not fit across", () => {
    expect(computeLayout({ ...desktop, vw: 800, cardWidth: 278 }).row).toBe(false);
    expect(computeLayout({ ...desktop, vw: 820, cardWidth: 208 }).row).toBe(true);
  });

  it("drops the bottom call to action on phones too short to fit it under the book", () => {
    expect(computeLayout(tinyPhone).showCta).toBe(false);
    const f = computeFrame(1, computeLayout(tinyPhone));
    expect(f.captions[2]).toBe(0);
  });
});

describe("computeFrame", () => {
  const L = computeLayout(desktop);

  it("starts closed beside the hero copy with nothing else showing", () => {
    const f = computeFrame(0, L);
    expect(f.scene.x).toBe(L.heroX);
    expect(f.cover.angle).toBeCloseTo(0);
    expect(f.leaves.every((l) => Math.abs(l.angle) < 1e-9)).toBe(true);
    expect(f.hero).toMatchObject({ opacity: 1, hidden: false });
    expect(f.words.every((w) => w.opacity === 0)).toBe(true);
    expect(f.cards.every((c) => c.opacity === 0)).toBe(true);
    expect(f.captions).toEqual([0, 0, 0]);
    expect(f.stamp.opacity).toBe(0);
    expect(f.act).toBe(0);
  });

  it("lands the toss face up and centred, then opens the cover onto the stamped slip", () => {
    const landed = computeFrame(0.38, L);
    expect(landed.book.ry).toBeCloseTo(360);
    expect(landed.book.rx).toBeCloseTo(52);
    expect(landed.scene.x).toBeCloseTo(0);
    expect(landed.hero.hidden).toBe(true);

    const open = computeFrame(0.53, L);
    expect(open.cover.angle).toBeCloseTo(-178);
    expect(open.book.x).toBeCloseTo(BOOK.W / 2);
    expect(open.stamp.opacity).toBe(1);
    expect(open.stamp.scale).toBe(1);
  });

  it("peaks the toss mid-arc above the resting line", () => {
    const mid = computeFrame(0.25, L);
    expect(mid.scene.y).toBeLessThan(computeFrame(0.12, L).scene.y);
    expect(mid.shadow.opacity).toBeLessThan(computeFrame(0, L).shadow.opacity);
  });

  it("releases each step card in order, each turning one more leaf", () => {
    CARD_AT.forEach((at, j) => {
      const before = computeFrame(at - 0.001, L);
      const after = computeFrame(at + 0.05, L);
      expect(before.cards[j].opacity).toBe(0);
      expect(after.cards[j].opacity).toBeGreaterThan(0);
      for (let later = j + 1; later < CARD_AT.length; later++) expect(after.cards[later].opacity).toBe(0);
      expect(after.leaves[j + 2].angle).toBeLessThan(before.leaves[j + 2].angle);
    });
  });

  it("settles every card in its slot and shows the call to action at the end", () => {
    const f = computeFrame(1, L);
    f.cards.forEach((c, j) => {
      expect(c.opacity).toBe(1);
      expect(c.x).toBeCloseTo(L.cardSlots[j].x);
      expect(c.y).toBeCloseTo(L.cardSlots[j].y);
      expect(c.scale).toBe(1);
      expect(c.rx).toBeCloseTo(0);
    });
    expect(f.captions[2]).toBe(1);
    expect(f.eyebrow.opacity).toBe(1);
    expect(f.words.every((w) => w.opacity === 0)).toBe(true);
    expect(f.act).toBe(4);
  });

  it("bursts every word out of the book during the steps act", () => {
    const seen = new Set<number>();
    for (let s = 0.5; s <= 0.95; s += 0.01) {
      computeFrame(s, L).words.forEach((w, i) => {
        if (w.opacity > 0) {
          seen.add(i);
          expect(w.y).toBeLessThan(0);
        }
      });
    }
    expect(seen.size).toBe(WORDS.length);
  });

  it("clamps progress outside 0..1 and treats NaN as the start", () => {
    expect(computeFrame(-3, L)).toEqual(computeFrame(0, L));
    expect(computeFrame(7, L)).toEqual(computeFrame(1, L));
    expect(computeFrame(Number.NaN, L)).toEqual(computeFrame(0, L));
  });

  it("adds hand spin and pointer tilt only while the book is closed", () => {
    expect(computeFrame(0, L, { spin: 90 }).book.ry).toBeCloseTo(-32 + 90);
    expect(computeFrame(0.5, L, { spin: 90 }).book.ry).toBeCloseTo(computeFrame(0.5, L).book.ry);
    expect(computeFrame(0, L, { pointerX: 1, pointerY: -1 }).tilt).toEqual({ rx: 5, ry: 7 });
    expect(computeFrame(0.7, L, { pointerX: 1 }).tilt.ry).toBe(0);
  });

  it("narrows the word burst on phones", () => {
    const P = computeLayout(phone);
    const s = 0.62;
    const wide = computeFrame(s, L).words.find((w) => w.opacity > 0)!;
    const narrow = computeFrame(s, P).words.find((w) => w.opacity > 0)!;
    expect(Math.abs(narrow.x)).toBeLessThan(Math.abs(wide.x));
  });
});

describe("actIndex", () => {
  it("maps progress to chapters", () => {
    expect([0, 0.11, 0.12, 0.4, 0.6, 0.95].map(actIndex)).toEqual([0, 0, 1, 2, 3, 4]);
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

  it("springs a small offset back to face the reader", () => {
    const sp = settle({ angle: 70, vel: 0, dragging: false });
    expect(spinSettled(sp)).toBe(true);
    expect(sp).toEqual(SPIN_REST);
  });

  it("turns a tap into one full flip and comes to rest", () => {
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
