import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { BookStage } from '@/components/landing/book-stage';
import { CINE_QUERY, STEPS_DONE_AT } from '@/lib/landing/book-motion';
import { cleanupClients, clickElement, renderClient } from './helpers/render';

const STEPS = [
  { title: 'Find the title in the catalog', body: 'Search by title, author or ISBN.' },
  { title: 'Reserve a copy for pickup', body: 'A copy is held until the pickup date.' },
  { title: 'Borrow and return at the circulation desk', body: 'Staff scan your library card.' },
];

// --- environment stubs (browser APIs jsdom lacks; the component itself is real) ---
let cineMatches = true;
const mqListeners = new Set<() => void>();
let frames: FrameRequestCallback[] = [];
let clock = 0;
const TRACK_HEIGHT = 5000;

function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      get matches() {
        return query === CINE_QUERY ? cineMatches : query === '(hover: hover)';
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => mqListeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => mqListeners.delete(fn),
    }),
  });
}

function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
}

/** Runs queued animation frames until the loop goes to sleep. */
async function flushFrames(limit = 3000) {
  await act(async () => {
    for (let i = 0; i < limit && frames.length; i++) {
      const queue = frames;
      frames = [];
      clock += 16;
      queue.forEach((cb) => cb(clock));
    }
  });
}

async function scrollToProgress(p: number) {
  setScrollY(p * (TRACK_HEIGHT - window.innerHeight));
  await act(async () => {
    window.dispatchEvent(new Event('scroll'));
  });
  await flushFrames();
}

function pointer(type: string, target: EventTarget, clientX: number, extra: Record<string, unknown> = {}) {
  const ev = new MouseEvent(type, { bubbles: true, clientX, clientY: 300 });
  for (const [k, v] of Object.entries(extra)) Object.defineProperty(ev, k, { value: v });
  target.dispatchEvent(ev);
}

const render = () =>
  renderClient(
    <BookStage title="STI College Alabang Library" intro="Search the library catalog." actions={<button type="button">Sign in with Microsoft</button>} steps={STEPS} />,
  );
const part = (root: ParentNode, name: string) => root.querySelector<HTMLElement>(`[data-part='${name}']`)!;
const parts = (root: ParentNode, name: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-part='${name}']`));

beforeEach(() => {
  cineMatches = true;
  mqListeners.clear();
  frames = [];
  clock = 0;
  installMatchMedia();
  setScrollY(0);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
  // jsdom has no layout: give the scroll track a real height so progress maps onto it.
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.dataset.part === 'track' ? TRACK_HEIGHT : 0;
  });
});

afterEach(() => {
  cleanupClients();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('BookStage content', () => {
  it('renders the hero copy, the sign-in actions and the steps as an ordered list', async () => {
    const { container } = await render();
    expect(container.querySelector('h1')?.textContent).toBe('STI College Alabang Library');
    expect(container.querySelector('#sign-in button')?.textContent).toBe('Sign in with Microsoft');
    const items = Array.from(container.querySelectorAll('ol > li[data-part="card"]'));
    expect(items.map((li) => li.querySelector('h3')?.textContent)).toEqual(STEPS.map((s) => s.title));
    expect(items[1].textContent).toContain('Step 2');
    expect(container.querySelector('#how-borrowing-works')?.tagName).toBe('H2');
    // The 3D scene and the chapter rail are decorative.
    expect(part(container, 'scene').closest('[aria-hidden="true"]')).not.toBeNull();
    expect(part(container, 'hud').getAttribute('aria-hidden')).toBe('true');
  });

  it("stamps today's date on the slip inside the cover", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 21, 9, 0));
    const { container } = await render();
    expect(part(container, 'stamp').textContent).toBe('NOV 21');
  });
});

describe('BookStage still mode', () => {
  it('stays on the plain layout with the flat BookArt when motion is not allowed', async () => {
    cineMatches = false;
    const { container } = await render();
    const root = container.firstElementChild as HTMLElement;
    expect(root.dataset.live).toBe('false');
    expect(container.querySelector('svg[aria-hidden="true"] path')).not.toBeNull();
    await scrollToProgress(1);
    expect(frames).toHaveLength(0);
    expect(parts(container, 'card')[0].style.transform).toBe('');
  });

  it('leaves the in-page link to the browser instead of scrolling the stage', async () => {
    cineMatches = false;
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const { container } = await render();
    const link = container.querySelector<HTMLAnchorElement>('a[href="#how-borrowing-works"]')!;
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      link.dispatchEvent(ev);
    });
    expect(scrollTo).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it('does not crash where matchMedia does not exist', async () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: undefined });
    const { container } = await render();
    expect((container.firstElementChild as HTMLElement).dataset.live).toBe('false');
  });
});

describe('BookStage scroll animation', () => {
  it('starts with the closed book beside the visible hero', async () => {
    const { container } = await render();
    expect((container.firstElementChild as HTMLElement).dataset.live).toBe('true');
    expect(part(container, 'book').style.transform).toContain('rotateY(-32deg)');
    expect(part(container, 'hero').style.opacity).toBe('1');
    expect(parts(container, 'card').every((c) => c.style.visibility === 'hidden')).toBe(true);
  });

  it('opens the book and lands every step card by the end of the track', async () => {
    const { container } = await render();
    await scrollToProgress(1);
    expect(part(container, 'cover').style.transform).toContain('rotateY(-178deg)');
    expect(part(container, 'hero').style.visibility).toBe('hidden');
    for (const card of parts(container, 'card')) {
      expect(card.style.opacity).toBe('1');
      expect(card.style.visibility).toBe('visible');
    }
    const [, , cta] = parts(container, 'caption');
    expect(cta.style.visibility).toBe('visible');
    expect(part(container, 'hud').querySelectorAll('button')[4].hasAttribute('data-on')).toBe(true);
  });

  it('plays backwards when scrolled back to the top', async () => {
    const { container } = await render();
    await scrollToProgress(1);
    await scrollToProgress(0);
    expect(part(container, 'cover').style.transform).toContain('rotateY(0deg)');
    expect(part(container, 'hero').style.visibility).toBe('');
    expect(parts(container, 'card').every((c) => c.style.visibility === 'hidden')).toBe(true);
  });

  it('jumps to the finished steps from the in-page link and from the chapter rail', async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    const { container } = await render();
    const span = TRACK_HEIGHT - window.innerHeight;
    const link = container.querySelector<HTMLAnchorElement>('a[href="#how-borrowing-works"]')!;
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      link.dispatchEvent(ev);
    });
    expect(ev.defaultPrevented).toBe(true);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: STEPS_DONE_AT * span, behavior: 'smooth' });

    await clickElement(part(container, 'hud').querySelectorAll('button')[2]);
    expect(scrollTo.mock.lastCall?.[0].top).toBeCloseTo((0.38 + 0.02) * span);
  });

  it('tilts toward a mouse pointer but ignores touch pointers', async () => {
    const { container } = await render();
    pointer('pointermove', window, window.innerWidth, { pointerType: 'touch' });
    await flushFrames();
    expect(part(container, 'tilt').style.transform).toBe('rotateX(0deg) rotateY(0deg)');
    pointer('pointermove', window, window.innerWidth, { pointerType: 'mouse' });
    await flushFrames();
    expect(part(container, 'tilt').style.transform).toMatch(/rotateY\(6\.9\d*deg\)|rotateY\(7deg\)/);
  });

  it('spins the book while dragged and springs it back to face the reader', async () => {
    const { container } = await render();
    const book = part(container, 'book');
    await act(async () => {
      pointer('pointerdown', book, 100);
      pointer('pointermove', book, 220);
    });
    await flushFrames();
    expect(book.style.transform).toContain('rotateY(40deg)'); // -32 + 120px * 0.6
    await act(async () => {
      pointer('pointerup', book, 220);
    });
    await flushFrames();
    expect(book.style.transform).toContain('rotateY(-32deg)');
  });

  it('flips the book on a tap with a short vibration, and ignores grabs once the toss starts', async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    const { container } = await render();
    const book = part(container, 'book');
    await act(async () => {
      pointer('pointerdown', book, 150);
      pointer('pointerup', book, 150);
    });
    expect(vibrate).toHaveBeenCalledWith(8);
    let peak = -32;
    await act(async () => {
      for (let i = 0; i < 3000 && frames.length; i++) {
        const q = frames;
        frames = [];
        clock += 16;
        q.forEach((cb) => cb(clock));
        const ry = Number(/rotateY\((-?[\d.]+)deg\)/.exec(book.style.transform)?.[1]);
        peak = Math.max(peak, ry);
      }
    });
    expect(peak).toBeGreaterThan(200);
    expect(book.style.transform).toContain('rotateY(-32deg)');

    await scrollToProgress(0.3);
    const during = book.style.transform;
    await act(async () => {
      pointer('pointerdown', book, 100);
      pointer('pointermove', book, 300);
    });
    await flushFrames();
    expect(book.style.transform).toBe(during);
  });

  it('switches to the still layout when reduced motion turns on, and cleans up on unmount', async () => {
    const { container, unmount } = await render();
    const root = container.firstElementChild as HTMLElement;
    await scrollToProgress(1);
    cineMatches = false;
    await act(async () => {
      mqListeners.forEach((fn) => fn());
    });
    expect(root.dataset.live).toBe('false');
    expect(parts(container, 'card')[0].style.transform).toBe('');
    await scrollToProgress(0.5);
    expect(frames).toHaveLength(0);

    cineMatches = true;
    await act(async () => {
      mqListeners.forEach((fn) => fn());
    });
    expect(root.dataset.live).toBe('true');
    unmount();
    expect(mqListeners.size).toBe(0);
    setScrollY(1000);
    window.dispatchEvent(new Event('scroll'));
    expect(frames).toHaveLength(0);
  });
});
