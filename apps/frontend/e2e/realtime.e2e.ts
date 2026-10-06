import { expect, test } from './support/test';
import {
  addComment,
  changeTaskStatus,
  gql,
  seedWorkspace,
} from './support/api';
import type { Workspace } from './support/api';
import { connectionStatus, expectLive, signIn } from './support/app';

/*
 * The socket against the real server: `graphql-ws` over a real WebSocket,
 * authenticated with the token the client obtains for it. The component suite
 * has only ever met a stand-in for the far end.
 */

let workspace: Workspace;

test.beforeEach(async () => {
  workspace = await seedWorkspace();
});

test('someone else’s change to a task, and their comment, appear without a reload', async ({
  page,
}) => {
  // Arrange
  const { owner, member, projectId, activeTaskId } = workspace;
  await signIn(page, owner);
  await page.goto(`/projects/${projectId}/tasks/${activeTaskId}`);
  await expectLive(page);
  await expect(
    page.getByRole('button', { name: 'Move to In review' }),
  ).toBeVisible();

  // Act — the member, from somewhere else entirely.
  await changeTaskStatus(member, activeTaskId, 'IN_REVIEW');
  await addComment(member, activeTaskId, 'Ready for a look.');

  // Assert
  await expect(
    page.getByRole('button', { name: 'Move to Testing' }),
  ).toBeVisible();
  await expect(
    page.getByText(/Bao Nguyen moved it from In progress to In review/),
  ).toBeVisible();
  await expect(page.getByText('Ready for a look.')).toBeVisible();
});

test('a mention reaches the bell while the page is open', async ({ page }) => {
  // Arrange
  const { owner, member, activeTaskId } = workspace;
  await signIn(page, owner);
  await page.goto('/');
  await expectLive(page);
  const bell = page.getByRole('button', { name: /Notifications/ });
  const before = (await bell.textContent()) ?? '';

  // Act
  await gql(
    member.token,
    `mutation ($t: UUID!, $u: UUID!) { createComment(taskId: $t, input: { body: "One more thing.", mentionedUserIds: [$u] }) { id } }`,
    { t: activeTaskId, u: owner.id },
  );

  // Assert
  await expect(bell).not.toHaveText(before);
  await expect(
    page.getByText('You were mentioned in a comment').first(),
  ).toBeVisible();
});

test('two people on the same board see each other’s moves', async ({
  page,
  browser,
}) => {
  // Arrange
  const { owner, member, projectId, backlogTaskId, backlogTaskTitle } =
    workspace;
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await signIn(other, member);
  await other.goto(`/projects/${projectId}/board`);
  await expectLive(other);
  await expect(
    other.getByRole('region', { name: 'Backlog' }).getByText(backlogTaskTitle),
  ).toBeVisible();

  await signIn(page, owner);
  await page.goto(`/projects/${projectId}/tasks/${backlogTaskId}`);

  // Act
  await page.getByRole('button', { name: 'Move to To do' }).click();

  // Assert
  await expect(
    other.getByRole('region', { name: 'To do' }).getByText(backlogTaskTitle),
  ).toBeVisible();
  await otherContext.close();
});

test('the app keeps working, and says so, when the socket cannot connect', async ({
  page,
}) => {
  // Arrange — every WebSocket is refused; HTTP is left alone.
  const { owner, projectId, backlogTaskId } = workspace;
  await page.routeWebSocket(/\/graphql/, (socket) => {
    void socket.close({ code: 1011, reason: 'unavailable' });
  });
  await signIn(page, owner);

  // Act
  await page.goto(`/projects/${projectId}/tasks/${backlogTaskId}`);
  await page.getByRole('button', { name: 'Move to To do' }).click();

  // Assert
  await expect(
    page.getByRole('button', { name: 'Move to In progress' }),
  ).toBeVisible();
  await expect(connectionStatus(page)).toHaveText(/Reconnecting…|Offline/);
});
