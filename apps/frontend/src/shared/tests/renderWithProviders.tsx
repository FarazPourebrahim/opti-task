import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ApolloClient } from '@apollo/client';
import type { ReactElement } from 'react';
import type { RenderOptions, RenderResult } from '@testing-library/react';
import { AppProviders } from '@/shared/context/AppProviders';
import { createApolloClient } from '@/shared/services/apollo.client';

/**
 * The single render entry point for component tests.
 *
 * It wraps in the SAME provider tree the real app uses, so a test can never
 * pass against a provider stack the user never gets.
 */
export type RenderWithProvidersResult = RenderResult & {
  user: ReturnType<typeof userEvent.setup>;
  /** The client backing this render, for cache assertions. */
  apolloClient: ApolloClient;
};

export type RenderWithProvidersOptions = Omit<RenderOptions, 'wrapper'> & {
  apolloClient?: ApolloClient;
  onSessionExpired?: () => void;
};

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const { apolloClient, onSessionExpired, ...renderOptions } = options;

  /*
   * A fresh client per render unless one is supplied: a cache shared between
   * test cases makes them order-dependent. Subscriptions are off — a socket
   * has nothing to connect to under test, and the reconnect loop would keep
   * the run alive.
   */
  const client =
    apolloClient ??
    createApolloClient({
      enableSubscriptions: false,
      ...(onSessionExpired ? { onSessionExpired } : {}),
    });

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

  const result = render(ui, {
    wrapper: ({ children }) => (
      <AppProviders apolloClient={client}>{children}</AppProviders>
    ),
    ...renderOptions,
  });

  return { ...result, user, apolloClient: client };
}

export * from '@testing-library/react';
