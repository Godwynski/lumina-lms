import * as React from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnimationProvider } from '@/components/providers/animation-provider';
import { BorrowingWalkthrough } from '@/components/landing/BorrowingWalkthrough';
import { DigitalCardShowcase } from '@/components/landing/DigitalCardShowcase';
import { InteractiveBook } from '@/components/landing/InteractiveBook';
import { LandingFaq } from '@/components/landing/LandingFaq';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { DEFAULT_POLICIES } from '@/lib/actions/policy-constants';
import { REDUCED_MOTION_QUERY } from '@/lib/landing/book-motion';
import { cleanupClients, clickElement, renderClient } from './helpers/render';

let reducedMotion = false;
let hoverMatches = true;
const mqListeners = new Set<() => void>();
let frames: FrameRequestCallback[] = [];
let clock = 0;

function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      get matches() {
        if (query === REDUCED_MOTION_QUERY) return reducedMotion;
        if (query === '(hover: hover)') return hoverMatches;
        return false;
      },
      media: query,
      addEventListener: (_: string, fn: () => void) => mqListeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => mqListeners.delete(fn),
    }),
  });
}

async function flushFrames(limit = 400) {
  await act(async () => {
    for (let i = 0; i < limit && frames.length; i++) {
      const queue = frames;
      frames = [];
      clock += 16;
      queue.forEach((cb) => cb(clock));
    }
  });
}

function pointer(type: string, target: EventTarget, clientX: number, extra: Record<string, unknown> = {}) {
  const ev = new MouseEvent(type, { bubbles: true, clientX, clientY: 200 });
  for (const [k, v] of Object.entries(extra)) Object.defineProperty(ev, k, { value: v });
  target.dispatchEvent(ev);
}

const part = (root: ParentNode, name: string) =>
  root.querySelector<HTMLElement>(`[data-part='${name}']`)!;

const findButton = (root: ParentNode, text: string) =>
  Array.from(root.querySelectorAll('button')).find((b) =>
    b.textContent?.toLowerCase().includes(text.toLowerCase()),
  ) as HTMLButtonElement;

beforeEach(() => {
  reducedMotion = false;
  hoverMatches = true;
  mqListeners.clear();
  frames = [];
  clock = 0;
  installMatchMedia();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
  Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 });
});

afterEach(() => {
  cleanupClients();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('InteractiveBook', () => {
  it('renders accessible controls, hides decorative 3D scene from assistive tech, and stamps today', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 21, 9, 0));

    const { container } = await renderClient(<InteractiveBook />);
    const openBtn = findButton(container, 'Open book');
    const spinBtn = findButton(container, 'Spin book');

    expect(openBtn).toHaveAttribute('aria-pressed', 'false');
    expect(spinBtn).toBeInTheDocument();
    expect(part(container, 'book').closest('[aria-hidden="true"]')).not.toBeNull();
    expect(part(container, 'stamp').textContent).toBe('NOV 21');
    expect(part(container, 'book').style.transform).toContain('rotateY(-26deg)');
  });

  it('opens and closes smoothly via the control button and tap on the book', async () => {
    const { container } = await renderClient(<InteractiveBook />);
    const openBtn = findButton(container, 'Open book');

    await clickElement(openBtn);
    expect(openBtn).toHaveAttribute('aria-pressed', 'true');
    expect(openBtn).toHaveTextContent('Close book');

    await flushFrames();
    expect(part(container, 'cover').style.transform).toContain('rotateY(-172deg)');
    expect(part(container, 'stamp').style.opacity).toBe('1');

    // Clicking the book itself closes it back to 0deg
    const book = part(container, 'book');
    await act(async () => {
      pointer('pointerdown', book, 120);
      pointer('pointerup', book, 120);
    });
    await flushFrames();
    expect(openBtn).toHaveAttribute('aria-pressed', 'false');
    expect(part(container, 'cover').style.transform).toContain('rotateY(0deg)');
  });

  it('spins on Spin book click and springs back after horizontal drag', async () => {
    const { container } = await renderClient(<InteractiveBook />);
    const book = part(container, 'book');

    // Drag closed book horizontally
    await act(async () => {
      pointer('pointerdown', book, 100);
      pointer('pointermove', book, 200);
    });
    await flushFrames();
    expect(book.style.transform).toContain('rotateY(39deg)'); // -26 + 100 * 0.65

    await act(async () => {
      pointer('pointerup', book, 200);
    });
    await flushFrames();
    expect(book.style.transform).toContain('rotateY(-26deg)');

    // Click Spin book while open: closes and completes a >200deg flip before settling
    await clickElement(findButton(container, 'Open book'));
    await flushFrames();
    await clickElement(findButton(container, 'Spin book'));

    let peak = -26;
    await act(async () => {
      for (let i = 0; i < 400 && frames.length; i++) {
        const q = frames;
        frames = [];
        clock += 16;
        q.forEach((cb) => cb(clock));
        const ry = Number(/rotateY\((-?[\d.]+)deg\)/.exec(book.style.transform)?.[1]);
        if (!Number.isNaN(ry)) peak = Math.max(peak, ry);
      }
    });
    expect(peak).toBeGreaterThan(200);
    expect(book.style.transform).toContain('rotateY(-26deg)');
  });

  it('tilts toward mouse pointers, ignores touch pointers, and cleans up on unmount', async () => {
    const { container, unmount } = await renderClient(<InteractiveBook />);
    const stage = container.firstElementChild as HTMLElement;

    await act(async () => {
      pointer('pointermove', stage, 500, { pointerType: 'touch' });
    });
    await flushFrames();
    expect(part(container, 'tilt').style.transform).toBe('rotateX(0deg) rotateY(0deg)');

    await act(async () => {
      pointer('pointermove', stage, window.innerWidth, { pointerType: 'mouse' });
    });
    await flushFrames();
    expect(part(container, 'tilt').style.transform).toMatch(/rotateY\((7\.9\d*|8)deg\)/);

    unmount();
    expect(mqListeners.size).toBe(0);
    expect(frames).toHaveLength(0);
  });

  it('switches to static BookArt when prefers-reduced-motion is enabled', async () => {
    reducedMotion = true;
    const { container } = await renderClient(<InteractiveBook />);
    expect((container.firstElementChild as HTMLElement).dataset.reducedMotion).toBe('true');
    expect(container.querySelector('svg[aria-hidden="true"] path')).not.toBeNull();
    expect(findButton(container, 'Spin book')).toBeUndefined();
    expect(frames).toHaveLength(0);
  });
});

describe('LandingHeader', () => {
  it('renders brand lockup, nav links, scroll progress bar, and reveals Sign in past hero', async () => {
    const signInAnchor = document.createElement('div');
    signInAnchor.id = 'sign-in';
    document.body.appendChild(signInAnchor);

    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });

    const { container } = await renderClient(
      <LandingHeader authSlot={<span data-testid="auth-slot">Account</span>} isSignedIn={false} showSignInButton={true} />,
    );

    expect(container).toHaveTextContent('Lumina');
    expect(container).toHaveTextContent('STI Alabang Library');
    expect(container.querySelector('nav[aria-label="Landing sections"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="auth-slot"]')).toBeInTheDocument();

    const headerSignIn = part(container, 'header-signin');
    expect(headerSignIn.dataset.visible).toBe('false');

    await act(async () => {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 500 });
      window.dispatchEvent(new Event('scroll'));
    });

    expect(part(container, 'scroll-progress').style.transform).toBe('scaleX(0.5)');
    expect(headerSignIn.dataset.visible).toBe('true');
    signInAnchor.remove();
  });

  it('hides quick Sign in when user is already signed in', async () => {
    const { container } = await renderClient(
      <LandingHeader authSlot={null} isSignedIn={true} showSignInButton={true} />,
    );
    expect(container.querySelector('[data-part="header-signin"]')).toBeNull();
  });
});

describe('BorrowingWalkthrough', () => {
  const STEPS = [
    { title: 'Find the title in the catalog', body: 'Search by title, author or ISBN.' },
    { title: 'Reserve a copy for pickup', body: 'Hold a copy or join the queue.' },
    { title: 'Borrow and return at the circulation desk', body: 'Show your QR library card.' },
  ];

  it('renders ordered steps and switches live preview pane on step selection', async () => {
    vi.unstubAllGlobals();
    const { container } = await renderClient(
      <AnimationProvider>
        <BorrowingWalkthrough steps={STEPS} />
      </AnimationProvider>,
    );

    const stepButtons = Array.from(container.querySelectorAll('ol button'));
    expect(stepButtons).toHaveLength(3);
    expect(stepButtons[0]).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('[data-preview-step="0"]')).toBeInTheDocument();

    await clickElement(stepButtons[1]);
    expect(stepButtons[1]).toHaveAttribute('aria-pressed', 'true');
    await vi.waitFor(() => {
      expect(container.querySelector('[data-preview-step="1"]')).toBeInTheDocument();
    });

    await clickElement(stepButtons[2]);
    expect(stepButtons[2]).toHaveAttribute('aria-pressed', 'true');
    await vi.waitFor(() => {
      expect(container.querySelector('[data-preview-step="2"]')).toBeInTheDocument();
    });
  });
});

describe('DigitalCardShowcase', () => {
  it('renders STI Alabang card preview, real DEFAULT_POLICIES limits, and flips front/back', async () => {
    const { container } = await renderClient(<DigitalCardShowcase />);

    expect(container).toHaveTextContent('LIBRARY CARD');
    expect(container).toHaveTextContent('Juan Dela Cruz');
    expect(container).toHaveTextContent(`${DEFAULT_POLICIES.loan_period_days.value} days`);
    expect(container).toHaveTextContent(`Up to ${DEFAULT_POLICIES.max_borrow_limit.value} books`);

    const flipBtn = findButton(container, 'View back of card');
    expect(flipBtn).toHaveAttribute('aria-pressed', 'false');

    await clickElement(flipBtn);
    expect(flipBtn).toHaveAttribute('aria-pressed', 'true');
    expect(flipBtn).toHaveTextContent('View front of card');

    await clickElement(part(container, 'card-flip-surface'));
    expect(flipBtn).toHaveAttribute('aria-pressed', 'false');
    expect(flipBtn).toHaveTextContent('View back of card');
  });

  it('switches faces cleanly without 3D transform when reduced motion is preferred', async () => {
    reducedMotion = true;
    const { container } = await renderClient(<DigitalCardShowcase />);
    const flipBtn = findButton(container, 'View back of card');

    await clickElement(flipBtn);
    expect(flipBtn).toHaveAttribute('aria-pressed', 'true');
    expect(part(container, 'card-flip-surface').style.perspective).toBe('');
  });
});

describe('LandingFaq', () => {
  const ITEMS = [
    { q: 'Which account do I use?', a: 'Your @alabang.sti.edu.ph Microsoft account.' },
    { q: 'Where do I check due dates?', a: 'Under My Borrowing on your dashboard.' },
  ];

  it('opens the first item by default and toggles items with aria-expanded and inert', async () => {
    const { container } = await renderClient(<LandingFaq items={ITEMS} />);
    const triggers = Array.from(container.querySelectorAll('button'));

    expect(triggers[0]).toHaveAttribute('aria-expanded', 'true');
    expect(triggers[1]).toHaveAttribute('aria-expanded', 'false');

    const panel0 = document.getElementById(triggers[0].getAttribute('aria-controls')!)!;
    const panel1 = document.getElementById(triggers[1].getAttribute('aria-controls')!)!;
    expect(panel0.hasAttribute('inert')).toBe(false);
    expect(panel1.hasAttribute('inert')).toBe(true);

    await clickElement(triggers[1]);
    expect(triggers[0]).toHaveAttribute('aria-expanded', 'false');
    expect(triggers[1]).toHaveAttribute('aria-expanded', 'true');
    expect(panel0.hasAttribute('inert')).toBe(true);
    expect(panel1.hasAttribute('inert')).toBe(false);

    await clickElement(triggers[1]);
    expect(triggers[1]).toHaveAttribute('aria-expanded', 'false');
  });
});
