import { axe } from 'jest-axe';
import { HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteObject } from 'react-router';
import { routes } from '@/App';
import { RouteErrorBoundary } from '@/modules/shell/components/RouteErrorBoundary';
import { RequireCapability } from '@/shared/components';
import { useEscalateRouteError } from '@/shared/hooks/useEscalateRouteError';
import { ApiError } from '@/shared/lib/apiError';
import { ROUTES } from '@/shared/routes/route.constants';
import { resetRefreshState } from '@/shared/services/auth.gateway';
import { clearAccessToken } from '@/shared/services/session.store';
import { graphql } from '@/shared/tests/graphql';
import {
  renderRoutes,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from '@/shared/tests/renderWithProviders';
import { server } from '@/shared/tests/server';
import {
  TEST_USER,
  loginSucceeds,
  signedIn,
  signedOut,
} from '@/shared/tests/session';

const HOME_HEADING = `Welcome back, ${TEST_USER.name}`;

function sessionsSucceed() {
  return graphql.query('Sessions', () =>
    HttpResponse.json({ data: { sessions: [] } }),
  );
}

function logoutSucceeds() {
  return graphql.mutation('Logout', () =>
    HttpResponse.json({ data: { logout: true } }),
  );
}

async function renderShell(route: string = ROUTES.home) {
  const result = renderRoutes(routes, { route });
  // The shell is a lazy chunk; wait for it rather than for a page inside it.
  await screen.findByRole('navigation', { name: 'Main' });
  return result;
}

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
  server.use(...signedIn());
});

describe('app shell', () => {
  it('frames the page with navigation, a top bar and a main region', async () => {
    // Arrange / Act
    await renderShell();

    // Assert
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Account' })).toBeVisible();
    expect(screen.getByRole('banner')).toBeVisible();
    expect(
      await within(screen.getByRole('main')).findByRole('heading', {
        name: HOME_HEADING,
      }),
    ).toBeVisible();
  });

  it('marks the current destination in the sidebar', async () => {
    // Arrange
    server.use(sessionsSucceed());

    // Act
    await renderShell(ROUTES.accountSessions);

    // Assert
    const account = screen.getByRole('navigation', { name: 'Account' });
    expect(
      within(account).getByRole('link', { name: 'Sessions' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(account).getByRole('link', { name: 'Security' }),
    ).not.toHaveAttribute('aria-current');
    // Home prefixes every path; it must not light up everywhere.
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole(
        'link',
        { name: 'Home' },
      ),
    ).not.toHaveAttribute('aria-current');
  });

  it('navigates from the sidebar without a reload', async () => {
    // Arrange
    const { user, router } = await renderShell();

    // Act
    await user.click(screen.getByRole('link', { name: 'Security' }));

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Security', level: 1 }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(ROUTES.accountSecurity);
  });

  it('offers a skip link that targets the main region', async () => {
    // Arrange / Act
    await renderShell();

    // Assert
    const skipLink = screen.getByRole('link', { name: 'Skip to content' });
    const main = screen.getByRole('main');
    expect(skipLink).toHaveAttribute('href', `#${main.id}`);
    // Focusable, so the browser has somewhere to move focus to.
    expect(main).toHaveAttribute('tabindex', '-1');
  });

  it('is the first thing a keyboard user reaches', async () => {
    // Arrange
    const { user } = await renderShell();

    // Act
    await user.tab();

    // Assert
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus();
  });

  it('redirects /account to its first section', async () => {
    // Arrange
    server.use(sessionsSucceed());

    // Act
    const { router } = await renderShell(ROUTES.account);

    // Assert
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(ROUTES.accountSessions),
    );
  });

  it('has no accessibility violations, landmarks included', async () => {
    // Arrange
    const { container } = await renderShell();
    await screen.findByRole('heading', { name: HOME_HEADING });

    // Act — `region` stays ON here: unlike a lone component, the shell is
    // what supplies the landmarks.
    const results = await axe(container);

    // Assert
    expect(results).toHaveNoViolations();
  });
});

describe('breadcrumbs', () => {
  it('derives the trail from the route tree', async () => {
    // Arrange / Act
    await renderShell(ROUTES.accountSecurity);

    // Assert
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const items = within(trail).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Home',
      'Account',
      'Security',
    ]);
    expect(within(trail).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'href',
      ROUTES.home,
    );
    // The page itself is text, not a link back to where the user already is.
    expect(within(trail).getByText('Security')).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(trail).queryByRole('link', { name: 'Security' })).toBeNull();
  });

  it('is omitted when the trail is a single page', async () => {
    // Arrange / Act
    await renderShell(ROUTES.home);

    // Assert
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
  });
});

describe('mobile navigation', () => {
  it('opens in a drawer, traps focus and closes on navigating', async () => {
    // Arrange
    const { user, router } = await renderShell();
    const trigger = screen.getByRole('button', { name: 'Open navigation' });

    // Act
    await user.click(trigger);
    const drawer = await screen.findByRole('dialog', { name: 'OptiTask' });

    // Assert — focus is inside the drawer and tabbing never leaves it.
    expect(drawer).toContainElement(document.activeElement as HTMLElement);
    for (let press = 0; press < 8; press += 1) {
      await user.tab();
      expect(drawer).toContainElement(document.activeElement as HTMLElement);
    }

    // Act
    await user.click(within(drawer).getByRole('link', { name: 'Security' }));

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(router.state.location.pathname).toBe(ROUTES.accountSecurity);
  });

  it('closes on Escape and returns focus to the button that opened it', async () => {
    // Arrange
    const { user } = await renderShell();
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(trigger);
    await screen.findByRole('dialog', { name: 'OptiTask' });

    // Act
    await user.keyboard('{Escape}');

    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe('account menu', () => {
  it('signs out and does not carry the old page to the next sign-in', async () => {
    // Arrange
    server.use(logoutSucceeds(), loginSucceeds());
    const { user, router } = await renderShell(ROUTES.accountSecurity);

    // Act
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    server.use(...signedOut());
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Sign in to OptiTask' }),
    ).toBeVisible();
    await waitFor(() => expect(router.state.location.state).toBeNull());

    // Act — the next person signs in on this browser.
    await user.type(screen.getByLabelText('Email'), 'me@acme.test');
    await user.type(screen.getByLabelText('Password'), 'passw0rd');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    // Assert — home, not the previous user's page.
    expect(
      await screen.findByRole('heading', { name: HOME_HEADING }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(ROUTES.home);
  });

  it('still signs out locally when the server call fails', async () => {
    // Arrange
    server.use(graphql.mutation('Logout', () => HttpResponse.error()));
    const { user } = await renderShell();

    // Act
    await user.click(screen.getByRole('button', { name: 'Account menu' }));
    server.use(...signedOut());
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Sign in to OptiTask' }),
    ).toBeVisible();
  });
});

describe('command palette', () => {
  it('opens on Ctrl+K and navigates to the chosen destination', async () => {
    // Arrange
    const { user, router } = await renderShell();

    // Act
    await user.keyboard('{Control>}k{/Control}');
    const palette = await screen.findByRole('dialog', {
      name: 'Command palette',
    });
    await user.type(within(palette).getByRole('combobox'), 'secur');
    await user.keyboard('{Enter}');

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Security', level: 1 }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(ROUTES.accountSecurity);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('opens from the search button', async () => {
    // Arrange
    const { user } = await renderShell();

    // Act
    await user.click(screen.getByRole('button', { name: 'Search' }));

    // Assert
    expect(
      await screen.findByRole('dialog', { name: 'Command palette' }),
    ).toBeVisible();
  });

  it('says so when nothing matches', async () => {
    // Arrange
    const { user } = await renderShell();
    await user.keyboard('{Control>}k{/Control}');
    const palette = await screen.findByRole('dialog', {
      name: 'Command palette',
    });

    // Act
    await user.type(within(palette).getByRole('combobox'), 'zzzz');

    // Assert
    expect(
      await within(palette).findByText('No matching pages or actions.'),
    ).toBeVisible();
  });
});

describe('unknown paths', () => {
  it('renders the not-found screen inside the shell', async () => {
    // Arrange / Act
    await renderShell('/no/such/page');

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
    // The frame survives, so the user can navigate away.
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute(
      'href',
      ROUTES.home,
    );
  });
});

describe('route errors', () => {
  // React reports every error a boundary catches; that is the point of these
  // tests, not noise worth reading.
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function Escalating({ error }: { error: ApiError }) {
    useEscalateRouteError(error);
    return <p>Page content</p>;
  }

  function treeWith(element: RouteObject['element']): RouteObject[] {
    return [
      {
        errorElement: <RouteErrorBoundary standalone />,
        children: [{ path: '/', element }],
      },
    ];
  }

  it('renders the forbidden screen when a page’s query is refused', async () => {
    // Arrange
    const forbidden = new ApiError({
      kind: 'forbidden',
      messageKey: 'error.forbidden',
      detail: 'role check failed for project 42',
    });

    // Act
    renderRoutes(treeWith(<Escalating error={forbidden} />));

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'You don’t have access' }),
    ).toBeVisible();
    expect(screen.queryByText('Page content')).toBeNull();
    // The server's own wording never reaches the screen.
    expect(screen.queryByText(/role check failed/)).toBeNull();
  });

  it('renders the not-found screen when the resource does not exist', async () => {
    // Arrange
    const missing = new ApiError({
      kind: 'not_found',
      messageKey: 'error.notFound',
    });

    // Act
    renderRoutes(treeWith(<Escalating error={missing} />));

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeVisible();
  });

  it('leaves other failures with the page, which shows them inline', () => {
    // Arrange
    const network = new ApiError({
      kind: 'network',
      messageKey: 'error.network',
    });

    // Act
    renderRoutes(treeWith(<Escalating error={network} />));

    // Assert
    expect(screen.getByText('Page content')).toBeVisible();
  });

  it('catches a render error, hides its message and recovers on retry', async () => {
    // Arrange
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error('secret internal detail');
      return <p>Recovered</p>;
    }
    const { user } = renderRoutes(treeWith(<Flaky />));

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' }),
    ).toBeVisible();
    expect(screen.queryByText(/secret internal detail/)).toBeNull();

    // Act
    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(await screen.findByText('Recovered')).toBeVisible();
  });

  it('shows the request reference for an API failure', async () => {
    // Arrange
    function Broken(): never {
      throw new ApiError({
        kind: 'server',
        messageKey: 'error.server',
        requestId: 'req-789',
      });
    }

    // Act
    renderRoutes(treeWith(<Broken />));

    // Assert
    expect(
      await screen.findByText('Something went wrong on our end.'),
    ).toBeVisible();
    expect(screen.getByText('Reference: req-789')).toBeVisible();
  });
});

describe('RequireCapability', () => {
  it('shows an action the user’s role allows', () => {
    // Arrange / Act
    renderWithProviders(
      <RequireCapability roles={['PROJECT_ADMIN']} permission="sprint:create">
        <button type="button">New sprint</button>
      </RequireCapability>,
    );

    // Assert
    expect(screen.getByRole('button', { name: 'New sprint' })).toBeVisible();
  });

  it('hides an action the user’s role does not allow', () => {
    // Arrange / Act
    renderWithProviders(
      <RequireCapability
        roles={['VIEWER']}
        permission="sprint:create"
        fallback={<p>Read only</p>}
      >
        <button type="button">New sprint</button>
      </RequireCapability>,
    );

    // Assert
    expect(screen.queryByRole('button', { name: 'New sprint' })).toBeNull();
    expect(screen.getByText('Read only')).toBeVisible();
  });
});
