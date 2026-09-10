import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';
import { afterAll, afterEach, beforeAll, expect } from 'vitest';
import { server } from './server';

expect.extend(toHaveNoViolations);

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
