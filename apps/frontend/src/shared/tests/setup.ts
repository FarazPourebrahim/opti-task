import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { server } from './server';

expect.extend(toHaveNoViolations);

/*
 * Every page is a lazy chunk, so the first render of a route waits on a real
 * dynamic import. Under a parallel run that can outlast the 1s default, and
 * the test then fails on a timeout rather than on anything it asserts.
 */
configure({ asyncUtilTimeout: 5000 });

/*
 * The Web Animations spec marks an animation's `finished` promise as handled
 * when the animation is cancelled, so cancelling one never surfaces as an
 * unhandled rejection. happy-dom rejects the promise without that marking, and
 * Avero's toast cancels its progress animation on unmount — which made every
 * test that showed a toast report an unhandled `AbortError`.
 */
const nativeAnimate = Element.prototype.animate as
  | typeof Element.prototype.animate
  | undefined;

if (nativeAnimate) {
  Element.prototype.animate = function animate(
    this: Element,
    ...args: Parameters<typeof nativeAnimate>
  ) {
    const animation = nativeAnimate.apply(this, args);
    animation.finished.catch(() => {});
    return animation;
  };
}

/*
 * jsdom gaps that Radix's positioning engine depends on. Without these, any
 * floating surface (menu, popover, tooltip, select) silently never renders and
 * the test times out rather than failing with a useful message.
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}

/*
 * floating-ui's `autoUpdate` (which Radix Popper uses for every floating
 * surface) constructs an IntersectionObserver to watch for layout shift.
 * jsdom has none, and the resulting throw inside an effect makes React retry
 * the render forever — which surfaces as a hung test, not an error.
 */
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds: readonly number[] = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

if (typeof globalThis.DOMRect === 'undefined') {
  // Minimal stand-in; jsdom performs no layout, so every rect is zero anyway.
  globalThis.DOMRect = class {
    constructor(
      public x = 0,
      public y = 0,
      public width = 0,
      public height = 0,
    ) {}
    top = 0;
    right = 0;
    bottom = 0;
    left = 0;
    static fromRect(): DOMRect {
      return new globalThis.DOMRect();
    }
    toJSON(): unknown {
      return this;
    }
  } as unknown as typeof DOMRect;
}

/*
 * jsdom implements no PointerEvent. Radix menus, selects and popovers open on
 * pointerdown, so without this they simply never open — and userEvent stalls
 * waiting for a surface that will never appear.
 */
if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    readonly isPrimary: boolean;
    readonly width: number;
    readonly height: number;
    readonly pressure: number;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? 'mouse';
      this.isPrimary = params.isPrimary ?? true;
      this.width = params.width ?? 1;
      this.height = params.height ?? 1;
      this.pressure = params.pressure ?? 0;
    }
  }

  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

// Radix Select and friends drive pointer interactions through these.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

/**
 * jsdom implements no media queries, but the theme provider wraps every render.
 * Default to "light, no preference"; a test that cares stubs this itself.
 */
if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  });
}

// `error` rather than `warn`: an unmocked request means the test is silently
// exercising a different code path than it claims to.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
