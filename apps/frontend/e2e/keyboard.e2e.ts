import type { Locator, Page } from '@playwright/test';
import { PASSWORD, register } from './support/api';
import type { Account } from './support/api';
import { signIn } from './support/app';
import { expect, test } from './support/test';

/*
 * The app with no pointer at all: only Tab, Enter, Escape and the shortcuts.
 * Moving a card by keyboard is in `board.e2e.ts`.
 */

let account: Account;

test.beforeEach(async () => {
  account = await register('Annie Easley', 'keyboard');
});

/** Presses Tab until `target` has the focus, as someone tabbing would. */
async function tabTo(page: Page, target: Locator, limit = 40): Promise<void> {
  for (let presses = 0; presses < limit; presses += 1) {
    if (await target.evaluate((element) => element === document.activeElement))
      return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

test('signing in needs no pointer', async ({ page }) => {
  // Arrange
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();

  // Act
  await tabTo(page, page.getByLabel('Email'));
  await page.keyboard.type(account.email);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password')).toBeFocused();
  await page.keyboard.type(PASSWORD);
  await page.keyboard.press('Enter');

  // Assert
  await expect(
    page.getByRole('button', { name: 'Account menu' }),
  ).toBeVisible();
});

test('the first Tab offers to skip to the content, and does', async ({
  page,
}) => {
  // Arrange
  await signIn(page, account);
  await page.goto('/organizations');
  await expect(
    page.getByRole('heading', { name: 'Organisations', level: 1 }),
  ).toBeVisible();

  // Act
  await page.keyboard.press('Tab');

  // Assert
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('the command palette opens on its shortcut, goes where it is told, and closes on Escape', async ({
  page,
}) => {
  // Arrange
  await signIn(page, account);
  const palette = page.getByRole('dialog', { name: 'Command palette' });

  // Act
  await page.keyboard.press('Control+k');
  await expect(palette).toBeVisible();
  await page.keyboard.type('Organ');
  await page.keyboard.press('Enter');

  // Assert
  await expect(page).toHaveURL(/\/organizations$/);
  await expect(palette).toBeHidden();

  await page.keyboard.press('Control+k');
  await expect(palette).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
});

test('a dialog takes the focus, keeps it, and hands it back on Escape', async ({
  page,
}) => {
  // Arrange
  await signIn(page, account);
  await page.goto('/organizations');
  const open = page.getByRole('button', { name: 'New organisation' }).first();
  const dialog = page.getByRole('dialog');

  // Act
  await tabTo(page, open);
  await page.keyboard.press('Enter');

  // Assert — the focus is inside, and tabbing never leaves.
  await expect(dialog).toBeVisible();
  for (let presses = 0; presses < 8; presses += 1) {
    expect(
      await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      ),
      `focus is inside the dialog after ${presses} presses of Tab`,
    ).toBe(true);
    await page.keyboard.press('Tab');
  }

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});

test('an organisation is created without a pointer', async ({ page }) => {
  // Arrange
  await signIn(page, account);
  await page.goto('/organizations');
  const dialog = page.getByRole('dialog');

  // Act
  await tabTo(
    page,
    page.getByRole('button', { name: 'New organisation' }).first(),
  );
  await page.keyboard.press('Enter');
  await tabTo(page, dialog.getByLabel('Name'));
  await page.keyboard.type('Keyboard Works');
  await page.keyboard.press('Enter');

  // Assert
  await expect(
    page.getByRole('heading', { name: 'Keyboard Works', level: 1 }),
  ).toBeVisible();
});
