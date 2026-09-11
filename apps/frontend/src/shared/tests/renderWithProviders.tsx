import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import type { RenderOptions, RenderResult } from '@testing-library/react';
import { AppProviders } from '@/shared/context/AppProviders';

/**
 * The single render entry point for component tests.
 *
 * It wraps in the SAME provider tree the real app uses, so a test can never
 * pass against a provider stack the user never gets.
 */
const AllProviders = AppProviders;

export type RenderWithProvidersResult = RenderResult & {
  user: ReturnType<typeof userEvent.setup>;
};

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
): RenderWithProvidersResult {
  const user = userEvent.setup({
    /*
     * Radix sets `pointer-events: none` on <body> while any dismissable layer
     * is open, which is how it makes the rest of the page inert. userEvent's
     * pointer-events check sees that and stalls, so every menu/popover/select
     * interaction times out with no error. jsdom does no hit-testing anyway,
     * so the check protects nothing here.
     */
    pointerEventsCheck: 0,
    /*
     * Dispatch events synchronously. The default inserts a real timer between
     * each one, which interleaves with the timers Radix's positioning engine
     * schedules and makes floating surfaces open nondeterministically — tests
     * then hang instead of failing.
     */
    delay: null,
  });
  const result = render(ui, { wrapper: AllProviders, ...options });

  return { ...result, user };
}

export * from '@testing-library/react';
