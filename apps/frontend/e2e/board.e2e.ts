import { expect, test } from './support/test';
import { seedWorkspace, taskStatus } from './support/api';
import type { Workspace } from './support/api';
import { signIn } from './support/app';

/*
 * Moving a card, in a browser that really lays the columns out. The component
 * suite drives the same code with synthetic events over rectangles it makes
 * up; this is the first place the drag library measures real ones.
 */

let workspace: Workspace;

test.beforeEach(async ({ page }) => {
  workspace = await seedWorkspace();
  await signIn(page, workspace.owner);
  await page.goto(`/projects/${workspace.projectId}/board`);
  await expect(page.getByRole('region', { name: 'Task board' })).toBeVisible();
});

test('a card is dragged with the mouse into a column the workflow allows, and stays there', async ({
  page,
}) => {
  // Arrange
  const title = workspace.backlogTaskTitle;
  const handle = page.getByRole('button', { name: `Move “${title}”` });
  const todo = page.getByRole('region', { name: 'To do' });
  const from = await handle.boundingBox();
  const to = await todo.boundingBox();
  if (!from || !to) throw new Error('The board was not laid out');

  // Act
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Past the start threshold first, then across in steps, as a hand does.
  await page.mouse.move(from.x + 30, from.y + 30, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 12 });
  await page.mouse.up();

  // Assert
  await expect(todo.getByText(title)).toBeVisible();
  await expect
    .poll(() => taskStatus(workspace.owner, workspace.backlogTaskId))
    .toBe('TODO');
  await page.reload();
  await expect(
    page.getByRole('region', { name: 'To do' }).getByText(title),
  ).toBeVisible();
});

test('a card released over a column the workflow forbids goes nowhere', async ({
  page,
}) => {
  // Arrange — a backlog card may only go to To do. The pointer crosses that
  // column on its way, and lets go over In progress.
  const title = workspace.backlogTaskTitle;
  const handle = page.getByRole('button', { name: `Move “${title}”` });
  const from = await handle.boundingBox();
  const to = await page
    .getByRole('region', { name: 'In progress' })
    .boundingBox();
  if (!from || !to) throw new Error('The board was not laid out');

  // Act
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y + 30, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 16 });
  await page.mouse.up();

  // Assert
  await expect(
    page.getByRole('region', { name: 'Backlog' }).getByText(title),
  ).toBeVisible();
  expect(await taskStatus(workspace.owner, workspace.backlogTaskId)).toBe(
    'BACKLOG',
  );
});

test('a card is moved with the keyboard alone, and each step is announced', async ({
  page,
}) => {
  // Arrange
  const title = workspace.backlogTaskTitle;
  const handle = page.getByRole('button', { name: `Move “${title}”` });
  const announcer = page.getByRole('status').filter({ hasText: title });

  // Act
  await handle.focus();
  await page.keyboard.press('Enter');
  await expect(announcer).toContainText(`Picked up “${title}”`);
  await page.keyboard.press('Enter');

  // Assert
  await expect(announcer).toContainText(`“${title}” moved to`);
  await expect
    .poll(() => taskStatus(workspace.owner, workspace.backlogTaskId))
    .not.toBe('BACKLOG');
});

test('on a phone the board scrolls inside itself and a card is moved by tapping', async ({
  page,
}) => {
  // Arrange
  await page.setViewportSize({ width: 360, height: 740 });
  const board = page.getByRole('region', { name: 'Task board' });
  const title = workspace.backlogTaskTitle;

  // Assert — the columns are wider than the screen, the page is not.
  expect(
    await board.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  // Act
  await page.getByRole('button', { name: `Move “${title}”` }).click();
  await page.getByRole('button', { name: 'Move here' }).first().click();

  // Assert
  await expect
    .poll(() => taskStatus(workspace.owner, workspace.backlogTaskId))
    .not.toBe('BACKLOG');
});
