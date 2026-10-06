import { HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RequestHandler } from 'msw';
import type { ErrorCode } from '@contracts';
import { routes } from '@/App';
import { myAnalyticsScenario } from '@/modules/analytics/analytics.fixtures';
import {
  expertiseSchema,
  profileSchema,
  skillSchema,
  toConfidencePercent,
  toConfidenceScore,
} from '@/modules/user/schemas/user.schema';
import { ROUTES, userPath } from '@/shared/routes/route.constants';
import { resetRefreshState } from '@/shared/services/auth.gateway';
import { clearAccessToken } from '@/shared/services/session.store';
import {
  graphql,
  mockMutationError,
  mockQueryError,
} from '@/shared/tests/graphql';
import {
  renderRoutes,
  screen,
  waitFor,
  within,
} from '@/shared/tests/renderWithProviders';
import { server } from '@/shared/tests/server';
import { TEST_USER, signedIn } from '@/shared/tests/session';

const OTHER_USER_ID = '33333333-3333-4333-8333-333333333333';

function expertise(id: string, tag: string, confidenceScore: number) {
  return { __typename: 'UserExpertise', id, tag, confidenceScore };
}

function myProfile(overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'User',
    id: TEST_USER.id,
    email: TEST_USER.email,
    name: TEST_USER.name,
    avatarUrl: null,
    seniority: null,
    skills: ['TypeScript'],
    expertise: [expertise('e1', 'GraphQL', 0.8)],
    ...overrides,
  };
}

function profileIs(profile = myProfile()) {
  return graphql.query('MyProfile', () =>
    HttpResponse.json({ data: { me: profile } }),
  );
}

// The server's own wording, which must never reach the screen.
const SERVER_DETAIL = 'internal reason';

function queryFails(name: string, code: ErrorCode) {
  return mockQueryError(name, code, SERVER_DETAIL);
}

function mutationFails(name: string, code: ErrorCode) {
  return mockMutationError(name, code, SERVER_DETAIL);
}

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
  // The profile carries the analytics card, which reads on sight.
  server.use(...signedIn(), ...myAnalyticsScenario());
});

describe('profile details', () => {
  it('saves the name and seniority', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      profileIs(),
      graphql.mutation('UpdateProfile', ({ variables }) => {
        sent = variables['input'];
        return HttpResponse.json({
          data: {
            updateProfile: {
              __typename: 'User',
              id: TEST_USER.id,
              name: 'Dana K. Scully',
              avatarUrl: null,
              seniority: 'SENIOR',
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.accountProfile });
    const name = await screen.findByLabelText('Full name');

    // Act
    await user.clear(name);
    await user.type(name, 'Dana K. Scully');
    await user.click(screen.getByRole('combobox', { name: 'Seniority' }));
    await user.click(await screen.findByRole('option', { name: 'Senior' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(
      await screen.findByText('Your profile has been saved.'),
    ).toBeVisible();
    expect(sent).toEqual({
      name: 'Dana K. Scully',
      avatarUrl: null,
      seniority: 'SENIOR',
    });
  });

  it('shows the email as read-only, since the API cannot change it', async () => {
    // Arrange
    server.use(profileIs());

    // Act
    renderRoutes(routes, { route: ROUTES.accountProfile });

    // Assert
    const email = await screen.findByLabelText('Email');
    expect(email).toHaveValue(TEST_USER.email);
    expect(email).toHaveAttribute('readonly');
  });

  it('validates before sending anything', async () => {
    // Arrange
    let calls = 0;
    server.use(
      profileIs(),
      graphql.mutation('UpdateProfile', () => {
        calls += 1;
        return HttpResponse.json({ data: null });
      }),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.accountProfile });
    const name = await screen.findByLabelText('Full name');

    // Act
    await user.clear(name);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(await screen.findByText('Enter your name.')).toBeVisible();
    expect(calls).toBe(0);
  });

  it.each<[string, RequestHandler, RegExp]>([
    [
      'a rejected input',
      mutationFails('UpdateProfile', 'BAD_USER_INPUT'),
      /Some of the details below need fixing/,
    ],
    [
      'a network failure',
      graphql.mutation('UpdateProfile', () => HttpResponse.error()),
      /Can’t reach the server/,
    ],
  ])('explains %s', async (_label, updateFails, message) => {
    // Arrange
    server.use(profileIs(), updateFails);
    const { user } = renderRoutes(routes, { route: ROUTES.accountProfile });

    // Act
    await user.click(await screen.findByRole('button', { name: 'Save' }));

    // Assert
    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.queryByText('internal reason')).toBeNull();
  });

  it('resolves a failed load into an error with a retry', async () => {
    // Arrange
    let attempts = 0;
    server.use(
      graphql.query('MyProfile', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json({ data: { me: myProfile() } });
      }),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.accountProfile });

    // Act
    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    // Assert
    expect(await screen.findByLabelText('Full name')).toHaveValue(
      TEST_USER.name,
    );
  });
});

describe('skills', () => {
  it('adds a skill, updating the list from the mutation result', async () => {
    // Arrange
    let profileRequests = 0;
    let sent: unknown;
    server.use(
      graphql.query('MyProfile', () => {
        profileRequests += 1;
        return HttpResponse.json({ data: { me: myProfile() } });
      }),
      graphql.mutation('AddSkill', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            addSkill: {
              __typename: 'User',
              id: TEST_USER.id,
              skills: ['TypeScript', 'React'],
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.accountProfile });

    // Act
    await user.type(await screen.findByLabelText('Add a skill'), ' React ');
    await user.click(screen.getByRole('button', { name: 'Add skill' }));

    // Assert
    const list = await screen.findByRole('list', { name: 'Skills' });
    await waitFor(() =>
      expect(
        within(list)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(['TypeScript', 'React']),
    );
    expect(sent).toEqual({ skill: 'React' });
    expect(screen.getByLabelText('Add a skill')).toHaveValue('');
    expect(profileRequests).toBe(1);
  });

  it('refuses a duplicate without asking the server', async () => {
    // Arrange — no AddSkill handler: a request would fail the test.
    server.use(profileIs());
    const { user } = renderRoutes(routes, { route: ROUTES.accountProfile });

    // Act
    await user.type(await screen.findByLabelText('Add a skill'), 'TypeScript');
    await user.click(screen.getByRole('button', { name: 'Add skill' }));

    // Assert
    expect(
      await screen.findByText('You’ve already added that skill.'),
    ).toBeVisible();
  });

  it('removes a skill', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      profileIs(),
      graphql.mutation('RemoveSkill', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            removeSkill: { __typename: 'User', id: TEST_USER.id, skills: [] },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.accountProfile });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Remove TypeScript' }),
    );

    // Assert
    expect(
      await screen.findByText('You haven’t added any skills yet.'),
    ).toBeVisible();
    expect(sent).toEqual({ skill: 'TypeScript' });
  });

  it('keeps the skill and explains when removal is refused', async () => {
    // Arrange
    server.use(profileIs(), mutationFails('RemoveSkill', 'FORBIDDEN'));
    const { user } = renderRoutes(routes, { route: ROUTES.accountProfile });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Remove TypeScript' }),
    );

    // Assert
    expect(
      await screen.findByText('You don’t have permission to do that.'),
    ).toBeVisible();
    expect(
      within(screen.getByRole('list', { name: 'Skills' })).getByText(
        'TypeScript',
      ),
    ).toBeVisible();
  });
});

describe('expertise', () => {
  it('shows each area with its confidence as a percentage', async () => {
    // Arrange
    server.use(profileIs());

    // Act
    renderRoutes(routes, { route: ROUTES.accountProfile });

    // Assert
    const list = await screen.findByRole('list', { name: 'Expertise' });
    expect(within(list).getByText('GraphQL')).toBeVisible();
    expect(within(list).getByText('80%')).toBeVisible();
    expect(
      within(list).getByRole('progressbar', { name: 'Confidence in GraphQL' }),
    ).toHaveAttribute('aria-valuenow', '80');
  });

  it('sends the confidence as a fraction, not a percentage', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      profileIs(),
      graphql.mutation('AddExpertise', ({ variables }) => {
        sent = variables['input'];
        return HttpResponse.json({
          data: {
            addExpertise: {
              __typename: 'User',
              id: TEST_USER.id,
              expertise: [
                expertise('e1', 'GraphQL', 0.8),
                expertise('e2', 'Testing', 0.7),
              ],
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.accountProfile });
    const confidence = await screen.findByLabelText('Confidence (%)');

    // Act
    await user.type(screen.getByLabelText('Area'), 'Testing');
    await user.clear(confidence);
    await user.type(confidence, '70');
    await user.click(screen.getByRole('button', { name: 'Add expertise' }));

    // Assert
    expect(await screen.findByText('70%')).toBeVisible();
    expect(sent).toEqual({ tag: 'Testing', confidenceScore: 0.7 });
  });

  it.each(['101', '-1', '12.5', ''])(
    'rejects a confidence of "%s" before sending anything',
    async (value) => {
      // Arrange — no AddExpertise handler: a request would fail the test.
      server.use(profileIs());
      const { user } = renderRoutes(routes, { route: ROUTES.accountProfile });
      const confidence = await screen.findByLabelText('Confidence (%)');

      // Act
      await user.type(screen.getByLabelText('Area'), 'Testing');
      await user.clear(confidence);
      if (value) await user.type(confidence, value);
      await user.click(screen.getByRole('button', { name: 'Add expertise' }));

      // Assert
      expect(
        await screen.findByText('Enter a whole number from 0 to 100.'),
      ).toBeVisible();
    },
  );

  it('removes an area', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      profileIs(),
      graphql.mutation('RemoveExpertise', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            removeExpertise: {
              __typename: 'User',
              id: TEST_USER.id,
              expertise: [],
            },
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: ROUTES.accountProfile });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Remove GraphQL' }),
    );

    // Assert
    expect(
      await screen.findByText('You haven’t added any expertise yet.'),
    ).toBeVisible();
    expect(sent).toEqual({ tag: 'GraphQL' });
  });
});

describe('another user’s profile', () => {
  function otherUser(overrides: Record<string, unknown> = {}) {
    return {
      __typename: 'User',
      id: OTHER_USER_ID,
      name: 'Fox Mulder',
      avatarUrl: null,
      seniority: 'LEAD',
      skills: ['Profiling'],
      expertise: [expertise('e9', 'Investigation', 0.95)],
      teamMemberships: [
        {
          __typename: 'UserTeamMembership',
          teamId: 't1',
          teamName: 'X-Files',
          role: 'LEAD',
          availability: 'BUSY',
          workload: 4,
        },
      ],
      ...overrides,
    };
  }

  it('shows who they are, read-only', async () => {
    // Arrange
    server.use(
      graphql.query('UserProfile', () =>
        HttpResponse.json({ data: { user: otherUser() } }),
      ),
    );

    // Act
    renderRoutes(routes, { route: userPath(OTHER_USER_ID) });

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Fox Mulder', level: 1 }),
    ).toBeVisible();
    expect(screen.getByText('Lead')).toBeVisible();
    expect(screen.getByText('Profiling')).toBeVisible();
    expect(screen.getByText('95%')).toBeVisible();
    expect(screen.getByText('X-Files')).toBeVisible();
    expect(screen.getByText('Busy')).toBeVisible();
    // Nothing here edits someone else's profile.
    expect(
      screen.queryByRole('button', { name: /Remove|Add|Save/ }),
    ).toBeNull();
  });

  it('gives each empty section its own message', async () => {
    // Arrange
    server.use(
      graphql.query('UserProfile', () =>
        HttpResponse.json({
          data: {
            user: otherUser({ skills: [], expertise: [], teamMemberships: [] }),
          },
        }),
      ),
    );

    // Act
    renderRoutes(routes, { route: userPath(OTHER_USER_ID) });

    // Assert
    expect(await screen.findByText('No skills listed.')).toBeVisible();
    expect(screen.getByText('No expertise listed.')).toBeVisible();
    expect(screen.getByText('Not on any team yet.')).toBeVisible();
  });

  it.each<[ErrorCode, string]>([
    ['NOT_FOUND', 'Page not found'],
    ['FORBIDDEN', 'You don’t have access'],
  ])('renders the right screen for %s', async (code, heading) => {
    // Arrange
    server.use(queryFails('UserProfile', code));

    // Act
    renderRoutes(routes, { route: userPath(OTHER_USER_ID) });

    // Assert
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
  });
});

describe('profile validation', () => {
  // Mirrors apps/backend/src/modules/user/user.validation.ts.
  it.each<[string, string, boolean]>([
    ['blank', '  ', false],
    ['exactly 100', 'a'.repeat(100), true],
    ['101 characters', 'a'.repeat(101), false],
  ])('name: %s', (_label, name, valid) => {
    expect(
      profileSchema.safeParse({ name, avatarUrl: '', seniority: null }).success,
    ).toBe(valid);
  });

  it.each<[string, string, boolean]>([
    ['blank', ' ', false],
    ['exactly 50', 'a'.repeat(50), true],
    ['51 characters', 'a'.repeat(51), false],
  ])('skill: %s', (_label, skill, valid) => {
    expect(skillSchema.safeParse(skill).success).toBe(valid);
  });

  it.each<[number, boolean]>([
    [0, true],
    [100, true],
    [101, false],
    [-1, false],
    [50.5, false],
    [Number.NaN, false],
  ])('confidence %s%%', (confidencePercent, valid) => {
    expect(
      expertiseSchema.safeParse({ tag: 'Testing', confidencePercent }).success,
    ).toBe(valid);
  });

  it('converts between the form’s percentage and the API’s fraction', () => {
    expect(toConfidenceScore(70)).toBe(0.7);
    expect(toConfidencePercent(0.7)).toBe(70);
    // A stored fraction that is not a round percentage still displays as one.
    expect(toConfidencePercent(0.333)).toBe(33);
  });
});
