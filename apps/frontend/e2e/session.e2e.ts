import type { Page } from '@playwright/test';
import { expect, test } from './support/test';
import { register } from './support/api';
import type { Account } from './support/api';
import { expectLive, signIn } from './support/app';

/*
 * The session as a browser really keeps it: HTTP-only cookies, nothing a
 * script can read, and one refresh-token rotation on every load.
 */

let account: Account;

test.beforeEach(async () => {
  account = await register('Katherine Johnson', 'session');
});

function accountMenu(page: Page) {
  return page.getByRole('button', { name: 'Account menu' });
}

test('no token is readable by script, and both cookies are HTTP-only', async ({
  page,
  context,
}) => {
  // Act
  await signIn(page, account);

  // Assert
  const stored = await page.evaluate(() => ({
    local: JSON.stringify({ ...localStorage }),
    session: JSON.stringify({ ...sessionStorage }),
    cookie: document.cookie,
  }));
  // A JWT starts with a base64 `{"`, whatever key it is filed under.
  expect(stored.local).not.toContain('eyJ');
  expect(stored.session).not.toContain('eyJ');
  expect(stored.cookie).not.toContain('optitask');

  const cookies = await context.cookies('http://localhost:4000');
  const auth = cookies.filter((cookie) => cookie.name.startsWith('optitask_'));
  expect(auth.map((cookie) => cookie.name).sort()).toEqual([
    'optitask_access',
    'optitask_refresh',
  ]);
  for (const cookie of auth) {
    expect(cookie.httpOnly, `${cookie.name} is HTTP-only`).toBe(true);
    expect(cookie.sameSite, `${cookie.name} is SameSite=Lax`).toBe('Lax');
  }
});

test('a reload keeps the session, and the socket comes back', async ({
  page,
}) => {
  // Arrange
  await signIn(page, account);

  // Act
  await page.reload();

  // Assert
  await expect(accountMenu(page)).toBeVisible();
  await expectLive(page);
});

test('two tabs loading at the same moment both stay signed in', async ({
  page,
  context,
}) => {
  // Arrange — each load rotates the refresh token to give the socket a token,
  // so two at once present the same one twice.
  await signIn(page, account);
  const second = await context.newPage();

  for (let round = 0; round < 3; round += 1) {
    // Act
    await Promise.all([page.goto('/'), second.goto('/organizations')]);

    // Assert
    await expect(accountMenu(page), `first tab, round ${round}`).toBeVisible();
    await expect(
      accountMenu(second),
      `second tab, round ${round}`,
    ).toBeVisible();
  }

  // The session has to survive the rounds, not only each load.
  await page.reload();
  await expect(accountMenu(page)).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);
});

test('signing out in one tab ends the session for the next request anywhere', async ({
  page,
  context,
}) => {
  // Arrange
  await signIn(page, account);
  const second = await context.newPage();
  await second.goto('/organizations');
  await expect(accountMenu(second)).toBeVisible();

  // Act
  await accountMenu(page).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
  await second.reload();

  // Assert
  await expect(second).toHaveURL(/\/login/);
});
