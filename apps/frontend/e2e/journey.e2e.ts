import { expect, test } from './support/test';
import { PASSWORD, uniqueEmail } from './support/api';
import { toast, watchForProblems } from './support/app';

/*
 * The whole product in one sitting, by hand: a new person registers and takes
 * a piece of work from nothing to an approved AI estimate and a figure on the
 * analytics page. Nothing is arranged through the API — every step is a click.
 */
test('a new user goes from registering to an approved AI estimate and analytics', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const problems = watchForProblems(page);

  await test.step('register', async () => {
    await page.goto('/register');
    await page.getByLabel('Full name').fill('Grace Hopper');
    await page.getByLabel('Email').fill(uniqueEmail('journey'));
    await page.getByLabel('Password').fill(PASSWORD);
    // The sign-out check is what the visitor was until now; not a problem.
    problems.length = 0;
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(
      page.getByRole('button', { name: 'Account menu' }),
    ).toBeVisible();
  });

  await test.step('create an organisation', async () => {
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Organisations' })
      .click();
    // The list's own button, and the same offer inside its empty state.
    await page
      .getByRole('button', { name: 'New organisation' })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Compilers Ltd');
    await dialog.getByRole('button', { name: 'Create organisation' }).click();
    await expect(toast(page, 'Compilers Ltd has been created.')).toBeVisible();
    // Creating one opens it.
    await expect(
      page.getByRole('heading', { name: 'Compilers Ltd', level: 1 }),
    ).toBeVisible();
  });

  await test.step('create a project', async () => {
    await page.getByRole('button', { name: 'New project' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('COBOL');
    await dialog.getByRole('button', { name: 'Create project' }).click();
    await expect(toast(page, 'COBOL has been created.')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'COBOL', level: 1 }),
    ).toBeVisible();
  });

  const tabs = page.getByRole('navigation', { name: 'Project sections' });

  await test.step('create a sprint', async () => {
    await tabs.getByRole('link', { name: 'Sprints' }).click();
    await page.getByRole('button', { name: 'New sprint' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Sprint 1');
    await dialog.getByLabel('Capacity').fill('20');
    await dialog.getByRole('button', { name: 'Create sprint' }).click();
    // Creating one opens it.
    await expect(
      page.getByRole('heading', { name: 'Sprint 1', level: 2 }),
    ).toBeVisible();
  });

  await test.step('create a task and open it', async () => {
    await tabs.getByRole('link', { name: 'Tasks' }).click();
    await page.getByRole('button', { name: 'New task' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Title').fill('Write the parser');
    await dialog.getByRole('button', { name: 'Create task' }).click();
    await expect(
      toast(page, '“Write the parser” has been created.'),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Write the parser' }).click();
    await expect(
      page.getByRole('heading', { name: 'Write the parser' }),
    ).toBeVisible();
  });

  await test.step('move it along the workflow', async () => {
    await page.getByRole('button', { name: 'Move to To do' }).click();
    await expect(
      page.getByRole('button', { name: 'Move to In progress' }),
    ).toBeVisible();
    await expect(
      page.getByText(/moved it from Backlog to To do/),
    ).toBeVisible();
  });

  await test.step('comment on it', async () => {
    await page.getByLabel('Add a comment').fill('Recursive descent, please.');
    await page.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(page.getByText('Recursive descent, please.')).toBeVisible();
    await expect(page.getByText(/commented\./)).toBeVisible();
  });

  await test.step('ask the AI for an estimate', async () => {
    await page.getByRole('button', { name: 'Estimate story points' }).click();
    await expect(page.getByText(/Suggests \d+ story points?/)).toBeVisible();
  });

  await test.step('approve it, seeing first what it will change', async () => {
    await tabs.getByRole('link', { name: 'AI' }).click();
    await page.getByRole('button', { name: 'Approve' }).click();
    const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
    await expect(
      dialog.getByText(/Approving sets this task’s estimate to \d+ story/),
    ).toBeVisible();
    await dialog.getByRole('button', { name: /Approve|Confirm/ }).click();
    await expect(toast(page, 'Suggestion approved.')).toBeVisible();
  });

  await test.step('see it counted in analytics', async () => {
    await tabs.getByRole('link', { name: 'Analytics' }).click();
    await expect(
      page.getByRole('heading', { name: 'Project figures' }),
    ).toBeVisible();
    const tasks = page.locator('dt', { hasText: /^Tasks$/ }).locator('+ dd');
    await expect(tasks).toHaveText('1');
    const points = page
      .locator('dt', { hasText: /^Story points$/ })
      .locator('+ dd');
    await expect(points).not.toHaveText('0');
  });

  expect(problems, 'nothing was refused or thrown along the way').toEqual([]);

  await test.step('sign out, and stay out', async () => {
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/organizations');
    await expect(page).toHaveURL(/\/login/);
  });
});
