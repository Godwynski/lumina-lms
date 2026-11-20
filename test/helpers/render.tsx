import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export interface RenderHandle {
  container: HTMLDivElement;
  root: Root;
  rerender: (nextUi: React.ReactElement) => Promise<void>;
  unmount: () => void;
}

const activeHandles = new Set<RenderHandle>();

/**
 * Renders a React 19 element into an attached jsdom container using react-dom/client + act.
 * Note: @testing-library/react is intentionally not installed; callers should use this helper.
 */
export async function renderClient(ui: React.ReactElement): Promise<RenderHandle> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const handle: RenderHandle = {
    container,
    root,
    rerender: async (nextUi: React.ReactElement) => {
      await act(async () => {
        root.render(nextUi);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
      activeHandles.delete(handle);
    },
  };

  activeHandles.add(handle);
  await act(async () => {
    root.render(ui);
  });

  return handle;
}

/**
 * Unmounts any containers mounted via renderClient (call in afterEach).
 */
export function cleanupClients(): void {
  for (const handle of Array.from(activeHandles)) {
    handle.unmount();
  }
}

/**
 * Dispatches a user click on a DOM element inside React act().
 */
export async function clickElement(el: Element | null | undefined): Promise<void> {
  if (!el) {
    throw new Error('clickElement expected a DOM element but received null/undefined');
  }
  await act(async () => {
    if (el instanceof HTMLElement) {
      el.click();
    } else {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  });
}

/**
 * Types a new value into an HTMLInputElement or HTMLTextAreaElement the way React expects.
 */
export async function typeIntoInput(
  el: HTMLInputElement | HTMLTextAreaElement | null | undefined,
  value: string
): Promise<void> {
  if (!el) {
    throw new Error('typeIntoInput expected an input element but received null/undefined');
  }
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  await act(async () => {
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/**
 * Submits an HTMLFormElement inside React act().
 */
export async function submitForm(form: HTMLFormElement | null | undefined): Promise<void> {
  if (!form) {
    throw new Error('submitForm expected a form element but received null/undefined');
  }
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

/**
 * Dispatches a keyboard event inside React act().
 */
export async function pressKey(el: Element | Document | null | undefined, key: string): Promise<void> {
  if (!el) {
    throw new Error('pressKey expected a target element but received null/undefined');
  }
  await act(async () => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}
