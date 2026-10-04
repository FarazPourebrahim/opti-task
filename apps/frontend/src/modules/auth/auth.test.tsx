import { HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { routes } from '@/App';
import { LoginPage } from '@/modules/auth/Login.page';
import { RegisterPage } from '@/modules/auth/Register.page';
import { ForgotPasswordPage } from '@/modules/auth/ForgotPassword.page';
import {
  changePasswordSchema,
  loginSchema,
  passwordSchema,
  registerSchema,
} from '@/modules/auth/schemas/auth.schema';
import { auditA11y } from '@/shared/tests/a11y';
import { graphql } from '@/shared/tests/graphql';
import { ROUTES } from '@/shared/routes/route.constants';
import {
  renderRoutes,
  renderWithProviders,
  screen,
  waitFor,
} from '@/shared/tests/renderWithProviders';
import { server } from '@/shared/tests/server';
import { resetRefreshState } from '@/shared/services/auth.gateway';
import {
  clearAccessToken,
  getAccessToken,
} from '@/shared/services/session.store';

const USER = {
  __typename: 'User',
  id: 'u1',
  email: 'me@acme.test',
  name: 'Dana Scully',
  avatarUrl: null,
  seniority: null,
  organizationCount: 1,
};

/** `me` answers as signed-out unless a test says otherwise. */
function anonymous() {
  return graphql.query('CurrentUser', () =>
    HttpResponse.json({
      errors: [{ message: 'no session', extensions: { code: 'UNAUTHENTICATED' } }],
      data: null,
    }),
  );
}

function refreshFails() {
  return graphql.mutation('Refresh', () =>
    HttpResponse.json({
      errors: [{ message: 'no session', extensions: { code: 'UNAUTHENTICATED' } }],
      data: null,
    }),
  );
}

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
  window.localStorage.clear();
  window.sessionStorage.clear();
  server.use(anonymous(), refreshFails());
});

describe('password policy', () => {
  // Mirrors apps/backend/src/modules/auth/auth.validation.ts exactly. If the
  // backend's policy moves, this is what fails first.
  const cases: Array<[string, string, boolean]> = [
    ['7 characters', 'abcde12', false],
    ['exactly 8', 'abcdef12', true],
    ['101 characters', `${'a'.repeat(95)}123456`, false],
    ['letters only', 'abcdefgh', false],
    ['digits only', '12345678', false],
    ['letter and digit', 'passw0rd', true],
  ];

  it.each(cases)('%s', (_label, value, valid) => {
    expect(passwordSchema.safeParse(value).success).toBe(valid);
  });

  it('accepts exactly 100 characters', () => {
    expect(passwordSchema.safeParse(`${'a'.repeat(99)}1`).success).toBe(true);
  });

  it('normalizes the email the way the server does', () => {
    const parsed = loginSchema.parse({
      email: '  Me@Acme.TEST  ',
      password: 'x',
    });

    // Otherwise the same person could appear to have two accounts.
    expect(parsed.email).toBe('me@acme.test');
  });

  it('does not apply the password policy when signing in', () => {
    // Applying it here would reveal which passwords are even possible.
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(
      true,
    );
  });

  it('requires a name to register', () => {
    const result = registerSchema.safeParse({
      email: 'a@b.co',
      name: '   ',
      password: 'passw0rd',
    });

    expect(result.success).toBe(false);
  });

  it('refuses a new password identical to the current one', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'passw0rd',
      newPassword: 'passw0rd',
    });

    expect(result.success).toBe(false);
  });
});

describe('sign in', () => {
  function loginSucceeds() {
    return graphql.mutation('Login', () =>
      HttpResponse.json({
        data: { login: { accessToken: 'access-123', user: USER } },
      }),
    );
  }

  function loginRejects() {
    return graphql.mutation('Login', () =>
      HttpResponse.json({
        errors: [
          { message: 'bad credentials', extensions: { code: 'UNAUTHENTICATED' } },
        ],
        data: null,
      }),
    );
  }

  async function fillAndSubmit(
    user: ReturnType<typeof renderWithProviders>['user'],
    email = 'me@acme.test',
    password = 'passw0rd',
  ) {
    await user.type(screen.getByLabelText('Email'), email);
    await user.type(screen.getByLabelText('Password'), password);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
  }

  it('signs in and lands in the app', async () => {
    server.use(loginSucceeds());
    const { user, router } = renderRoutes(routes, { route: ROUTES.login });
    await screen.findByLabelText('Email');

    await fillAndSubmit(user);

    expect(
      await screen.findByRole('heading', { name: 'Welcome back, Dana Scully' }),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe(ROUTES.home);
  });

  it('keeps the access token in memory and out of storage', async () => {
    server.use(loginSucceeds());
    const { user } = renderWithProviders(<LoginPage />);

    await fillAndSubmit(user);

    await waitFor(() => expect(getAccessToken()).toBe('access-123'));
    // The rule that matters: a token readable by JS storage is a token an XSS
    // can steal.
    expect(JSON.stringify(window.localStorage)).not.toContain('access-123');
    expect(JSON.stringify(window.sessionStorage)).not.toContain('access-123');
  });

  it('never reveals whether an email has an account', async () => {
    server.use(loginRejects());
    const { user } = renderWithProviders(<LoginPage />);

    await fillAndSubmit(user, 'nobody@acme.test');

    const alert = await screen.findByRole('alert');
    // One message for both "no such user" and "wrong password".
    expect(alert).toHaveTextContent(
      'That email and password don’t match an account.',
    );
    expect(alert.textContent).not.toMatch(/not found|no account|unknown user/i);
  });

  it('validates before sending anything to the server', async () => {
    let calls = 0;
    server.use(
      graphql.mutation('Login', () => {
        calls += 1;
        return HttpResponse.json({ data: null });
      }),
    );
    const { user } = renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'passw0rd');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter a valid email address.')).toBeVisible();
    expect(calls).toBe(0);
  });

  it('associates the validation message with its field', async () => {
    const { user } = renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'nope');
    await user.type(screen.getByLabelText('Password'), 'passw0rd');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Email')).toHaveAttribute(
        'aria-invalid',
        'true',
      ),
    );
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Enter a valid email address.',
    );
  });

  it('submits on Enter', async () => {
    server.use(loginSucceeds());
    const { user } = renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'me@acme.test');
    await user.type(screen.getByLabelText('Password'), 'passw0rd{Enter}');

    await waitFor(() => expect(getAccessToken()).toBe('access-123'));
  });

  it('disables the inputs while the request is in flight', async () => {
    server.use(
      graphql.mutation('Login', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({
          data: { login: { accessToken: 'access-123', user: USER } },
        });
      }),
    );
    const { user } = renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), 'me@acme.test');
    await user.type(screen.getByLabelText('Password'), 'passw0rd');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    // A double submit would attempt a second sign-in against a rotating token.
    expect(screen.getByRole('button', { name: /Signing in/ })).toBeDisabled();
  });

  it('shows a network failure as a network failure', async () => {
    server.use(graphql.mutation('Login', () => HttpResponse.error()));
    const { user } = renderWithProviders(<LoginPage />);

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Can’t reach the server/,
    );
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<LoginPage />);

    expect(await auditA11y(container)).toHaveNoViolations();
  });
});

describe('register', () => {
  it('explains that an email is already taken', async () => {
    server.use(
      graphql.mutation('Register', () =>
        HttpResponse.json({
          errors: [
            { message: 'duplicate', extensions: { code: 'CONFLICT' } },
          ],
          data: null,
        }),
      ),
    );
    const { user } = renderWithProviders(<RegisterPage />);

    await user.type(screen.getByLabelText('Full name'), 'Dana Scully');
    await user.type(screen.getByLabelText('Email'), 'me@acme.test');
    await user.type(screen.getByLabelText('Password'), 'passw0rd');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    // Not an enumeration leak: the person is choosing this address themselves.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with that email already exists.',
    );
  });

  it('surfaces the password rule before submitting', async () => {
    const { user } = renderWithProviders(<RegisterPage />);

    await user.type(screen.getByLabelText('Full name'), 'Dana');
    await user.type(screen.getByLabelText('Email'), 'me@acme.test');
    await user.type(screen.getByLabelText('Password'), 'abcdefgh');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(
      await screen.findByText('Include at least one number.'),
    ).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderWithProviders(<RegisterPage />);

    expect(await auditA11y(container)).toHaveNoViolations();
  });
});

describe('forgot password', () => {
  it('does not promise an email it cannot send', () => {
    renderWithProviders(<ForgotPasswordPage />);

    expect(
      screen.getByText('Password reset isn’t available yet'),
    ).toBeVisible();
    // The backend's requestPasswordReset is a no-op; claiming otherwise would
    // leave a user waiting for a message that never arrives.
    expect(screen.queryByText(/check your (inbox|email)/i)).toBeNull();
    expect(screen.queryByText(/we(’| ha)ve sent/i)).toBeNull();
  });

  it('offers no email field, since submitting would do nothing', () => {
    renderWithProviders(<ForgotPasswordPage />);

    expect(screen.queryByLabelText('Email')).toBeNull();
  });
});
