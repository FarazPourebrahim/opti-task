import { render } from '@testing-library/react';
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import type { ApolloClient } from '@apollo/client';
import type { ReactElement } from 'react';
import type { RenderOptions, RenderResult } from '@testing-library/react';
import type { RouteObject } from 'react-router';
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
  /** The location the component under test is rendered at. */
  route?: string;
};

type Harness = {
  client: ApolloClient;
  user: ReturnType<typeof userEvent.setup>;
};

function createHarness(
  options: Pick<
    RenderWithProvidersOptions,
    'apolloClient' | 'onSessionExpired'
  >,
): Harness {
  const { apolloClient, onSessionExpired } = options;

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

  return { client, user };
}

/**
 * Renders one component. It sits inside a router, since almost everything
 * renders a link — but not a data router, so anything that reads the route
 * tree (breadcrumbs, route errors) is tested through `renderRoutes` instead.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const {
    apolloClient,
    onSessionExpired,
    route = '/',
    ...renderOptions
  } = options;
  const { client, user } = createHarness({
    ...(apolloClient ? { apolloClient } : {}),
    ...(onSessionExpired ? { onSessionExpired } : {}),
  });

  const result = render(ui, {
    wrapper: ({ children }) => (
      <AppProviders apolloClient={client}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </AppProviders>
    ),
    ...renderOptions,
  });

  return { ...result, user, apolloClient: client };
}

export type RenderRoutesResult = RenderWithProvidersResult & {
  router: ReturnType<typeof createMemoryRouter>;
};

/**
 * Renders a route tree at a location, through the same data router the app
 * uses. Pass the app's own `routes` to exercise guards, layouts and redirects
 * exactly as a user meets them.
 */
export function renderRoutes(
  routes: RouteObject[],
  options: Omit<RenderWithProvidersOptions, 'wrapper'> = {},
): RenderRoutesResult {
  const {
    apolloClient,
    onSessionExpired,
    route = '/',
    ...renderOptions
  } = options;
  const { client, user } = createHarness({
    ...(apolloClient ? { apolloClient } : {}),
    ...(onSessionExpired ? { onSessionExpired } : {}),
  });

  const router = createMemoryRouter(routes, { initialEntries: [route] });

  const result = render(<RouterProvider router={router} />, {
    wrapper: ({ children }) => (
      <AppProviders apolloClient={client}>{children}</AppProviders>
    ),
    ...renderOptions,
  });

  return { ...result, user, apolloClient: client, router };
}

export * from '@testing-library/react';
