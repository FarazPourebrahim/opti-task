import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PASSWORD } from './api';
import type { Account, Workspace } from './api';

export const DESKTOP = { width: 1280, height: 800 };
export const PHONE = { width: 360, height: 740 };

/** Signs in through the form, as a person would. */
export async function signIn(page: Page, account: Account): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(
    page.getByRole('button', { name: 'Account menu' }),
  ).toBeVisible();
}

/** Every signed-in screen, by name, for a seeded workspace. */
export function signedInRoutes(workspace: Workspace): Array<[string, string]> {
  const {
    organizationId: org,
    projectId: project,
    teamId,
    sprintId,
    epicId,
    activeTaskId,
    member,
  } = workspace;

  return [
    ['home', '/'],
    ['organisations', '/organizations'],
    ['organisation projects', `/organizations/${org}`],
    ['organisation members', `/organizations/${org}/members`],
    ['organisation invitations', `/organizations/${org}/invitations`],
    ['organisation settings', `/organizations/${org}/settings`],
    ['project overview', `/projects/${project}`],
    ['board', `/projects/${project}/board`],
    ['task list', `/projects/${project}/tasks`],
    ['task', `/projects/${project}/tasks/${activeTaskId}`],
    ['sprints', `/projects/${project}/sprints`],
    ['sprint', `/projects/${project}/sprints/${sprintId}`],
    ['epics', `/projects/${project}/epics`],
    ['epic', `/projects/${project}/epics/${epicId}`],
    ['AI recommendations', `/projects/${project}/ai`],
    ['analytics', `/projects/${project}/analytics`],
    ['project members', `/projects/${project}/members`],
    ['teams', `/projects/${project}/teams`],
    ['team', `/projects/${project}/teams/${teamId}`],
    ['project settings', `/projects/${project}/settings`],
    ['notifications', '/notifications'],
    ['own profile', '/account/profile'],
    ['sessions', '/account/sessions'],
    ['security', '/account/security'],
    ['another person', `/users/${member.id}`],
    ['not found', '/nowhere'],
  ];
}

export type Problem = { kind: string; detail: string };

/**
 * Listens for what a healthy screen never produces: a GraphQL error, an
 * uncaught exception, a console error. Returns the list it fills.
 */
export function watchForProblems(page: Page): Problem[] {
  const problems: Problem[] = [];

  page.on('pageerror', (error) => {
    problems.push({ kind: 'exception', detail: String(error) });
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      problems.push({ kind: 'console', detail: message.text() });
    }
  });
  page.on('response', (response) => {
    const request = response.request();
    if (!response.url().endsWith('/graphql') || request.method() !== 'POST') {
      return;
    }
    void response
      .json()
      .then((body: { errors?: unknown }) => {
        if (!body.errors) return;
        const sent = JSON.parse(request.postData() ?? '{}') as {
          operationName?: string;
        };
        problems.push({
          kind: 'graphql',
          detail: `${sent.operationName ?? 'unnamed'}: ${JSON.stringify(body.errors)}`,
        });
      })
      .catch(() => undefined);
  });

  return problems;
}

/** Waits until the screen has stopped asking the server for things. */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** How far the document is wider than the window; 0 when it fits. */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
  );
}

/**
 * The top bar's connection badge. Its text is a hidden label plus the state
 * ("Live updates: Live"), so it is found by role, not by the visible word.
 */
export function connectionStatus(page: Page) {
  return page.getByRole('status').filter({ hasText: 'Live updates:' });
}

export async function expectLive(page: Page): Promise<void> {
  await expect(connectionStatus(page)).toHaveText(/Live updates:\s*Live$/);
}

/**
 * A toast, by its title. The same sentence is also written to a live region
 * for screen readers, so the text alone matches twice.
 */
export function toast(page: Page, title: string) {
  return page.locator('[data-slot="toast-title"]', { hasText: title });
}
