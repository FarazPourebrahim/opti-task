import { readFileSync } from 'node:fs';
import { HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ErrorCode } from '@contracts';
import { routes } from '@/App';
import {
  ATTACHMENT_ID,
  COMMENT_ID,
  NEW_ATTACHMENT_ID,
  NEW_COMMENT_ID,
  REPLY_ID,
  attachmentNode,
  commentNode,
  commentsData,
  discussionScenario,
  threadNode,
} from '@/modules/comment/comment.fixtures';
import {
  ATTACHMENT_SIZE_MAX,
  COMMENT_BODY_MAX,
  COMMENT_MENTIONS_MAX,
} from '@/modules/comment/constants/comment.constants';
import {
  attachmentSchema,
  commentSchema,
} from '@/modules/comment/schemas/comment.schema';
import {
  discussionCapabilities,
  formatFileSize,
  ownsOrModerates,
} from '@/modules/comment/utils/comment.utils';
import type { Scenario } from '@/modules/project/project.fixtures';
import {
  OTHER_TASK_ID,
  PAT,
  PROJECT_ID,
  TASK_ID,
  TERRY,
  VIEWER,
  detailScenario,
} from '@/modules/task/task.fixtures';
import { taskCommentPath, taskPath } from '@/shared/routes/route.constants';
import { resetRefreshState } from '@/shared/services/auth.gateway';
import { clearAccessToken } from '@/shared/services/session.store';
import { auditA11y } from '@/shared/tests/a11y';
import { graphql, mockMutationError } from '@/shared/tests/graphql';
import {
  renderRoutes,
  screen,
  waitFor,
  within,
} from '@/shared/tests/renderWithProviders';
import { server } from '@/shared/tests/server';
import { signedIn } from '@/shared/tests/session';

// The server's own wording, which must never reach the screen.
const SERVER_DETAIL = 'internal reason';

const TASK_ROUTE = taskPath(PROJECT_ID, TASK_ID);

type Discussion = NonNullable<Parameters<typeof discussionScenario>[1]>;

/** The task page with a discussion of the test's choosing. */
function taskPage(scenario: Scenario, discussion: Discussion = {}) {
  return [
    ...discussionScenario(TASK_ID, discussion),
    ...detailScenario(scenario),
  ];
}

function mutationFails(name: string, code: ErrorCode) {
  return mockMutationError(name, code, SERVER_DETAIL);
}

function commentBy(name: string) {
  return screen.findByRole('article', { name: `Comment by ${name}` });
}

/** Holds a response back until the test lets it go. */
function gate() {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
}

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
  server.use(...signedIn());
});

describe('comment and attachment rules', () => {
  it('requires text, trims it and bounds it at 10,000 characters', () => {
    // Arrange
    const parse = (body: string) =>
      commentSchema.safeParse({ body, mentionedUserIds: [] });

    // Act
    const blank = parse('   ');
    const trimmed = parse('  Looks good  ');
    const atLimit = parse('a'.repeat(COMMENT_BODY_MAX));
    const pastLimit = parse('a'.repeat(COMMENT_BODY_MAX + 1));

    // Assert
    expect(blank.success).toBe(false);
    expect(trimmed.success && trimmed.data.body).toBe('Looks good');
    expect(atLimit.success).toBe(true);
    expect(pastLimit.success).toBe(false);
  });

  it('allows 50 mentions and no more', () => {
    // Arrange
    const ids = (count: number) =>
      Array.from({ length: count }, (_, index) => `user-${index}`);

    // Act
    const atLimit = commentSchema.safeParse({
      body: 'Hello',
      mentionedUserIds: ids(COMMENT_MENTIONS_MAX),
    });
    const pastLimit = commentSchema.safeParse({
      body: 'Hello',
      mentionedUserIds: ids(COMMENT_MENTIONS_MAX + 1),
    });

    // Assert
    expect(atLimit.success).toBe(true);
    expect(pastLimit.success).toBe(false);
  });

  it('takes a file name, an optional type, and a size that fits the API', () => {
    // Arrange
    const parse = (sizeBytes: number | null, filename = ' notes.txt ') =>
      attachmentSchema.safeParse({ filename, contentType: '  ', sizeBytes });

    // Act
    const unknownSize = parse(null);

    // Assert
    expect(unknownSize.success && unknownSize.data).toEqual({
      filename: 'notes.txt',
      contentType: null,
      sizeBytes: null,
    });
    expect(parse(0).success).toBe(true);
    expect(parse(ATTACHMENT_SIZE_MAX).success).toBe(true);
    // One past what a GraphQL Int can carry.
    expect(parse(ATTACHMENT_SIZE_MAX + 1).success).toBe(false);
    expect(parse(1.5).success).toBe(false);
    expect(parse(-1).success).toBe(false);
    expect(parse(Number.NaN).success).toBe(false);
    expect(parse(null, '   ').success).toBe(false);
    expect(parse(null, 'a'.repeat(256)).success).toBe(false);
  });

  it('writes a size as a person would read it', () => {
    // Arrange
    const sizes = [0, 1, 512, 1536, 5 * 1024 * 1024];

    // Act
    const written = sizes.map((size) => formatFileSize(size, 'en'));

    // Assert
    expect(written).toEqual([
      '0 bytes',
      '1 byte',
      '512 bytes',
      '1.5 kB',
      '5 MB',
    ]);
  });

  it('lets members comment, and only moderators or the owner change a comment', () => {
    // Arrange
    const member = discussionCapabilities(['PROJECT_MEMBER']);
    const viewer = discussionCapabilities(['VIEWER']);
    const lead = discussionCapabilities(['TEAM_LEAD']);

    // Act
    const ownComment = ownsOrModerates(member.canModerate, 'me', 'me');
    const someoneElses = ownsOrModerates(member.canModerate, 'me', 'them');
    const signedOut = ownsOrModerates(false, undefined, 'them');

    // Assert
    expect(member).toEqual({ canComment: true, canModerate: false });
    expect(viewer).toEqual({ canComment: false, canModerate: false });
    expect(lead).toEqual({ canComment: true, canModerate: true });
    expect(ownComment).toBe(true);
    expect(someoneElses).toBe(false);
    expect(signedOut).toBe(false);
  });

  it('never asks the API where a file is, since it is nowhere', () => {
    // Arrange
    const operations = readFileSync(
      'src/modules/comment/graphql/comment.operations.ts',
      'utf8',
    );

    // Act — every line that is part of a document, not of a comment.
    const selected = operations
      .split('\n')
      .filter((line) => !line.trim().startsWith('*'))
      .join('\n');

    // Assert
    expect(selected).not.toMatch(/\burl\b/);
  });
});

describe('comment thread', () => {
  it('shows threads oldest first, replies inside, with their markers', async () => {
    // Arrange
    server.use(
      ...taskPage(
        { project: 'MEMBER' },
        {
          threads: [
            threadNode(
              TASK_ID,
              PAT,
              { body: 'Is the copy final?', resolved: true, mentions: [TERRY] },
              [
                commentNode(TASK_ID, TERRY, {
                  id: REPLY_ID,
                  body: 'Yes, signed off.',
                  edited: true,
                  parentCommentId: COMMENT_ID,
                }),
              ],
            ),
            threadNode(TASK_ID, VIEWER, {
              id: NEW_COMMENT_ID,
              body: 'Shipping Friday.',
            }),
          ],
        },
      ),
    );

    // Act
    renderRoutes(routes, { route: TASK_ROUTE });

    // Assert
    const first = await commentBy(PAT.name);
    expect(within(first).getByText('Is the copy final?')).toBeVisible();
    expect(within(first).getByText('Resolved')).toBeVisible();
    expect(within(first).getByText('Mentions Terry Teammate')).toBeVisible();

    const replies = screen.getByRole('list', {
      name: 'Replies to Pat Project',
    });
    const reply = within(replies).getByRole('article', {
      name: 'Comment by Terry Teammate',
    });
    expect(within(reply).getByText('Yes, signed off.')).toBeVisible();
    expect(within(reply).getByText('Edited')).toBeVisible();

    expect(
      screen
        .getAllByRole('article')
        .map((article) => article.getAttribute('aria-label')),
    ).toEqual([
      'Comment by Pat Project',
      'Comment by Terry Teammate',
      'Comment by Dana Scully',
    ]);
  });

  it('shows a comment as plain text, never as markup', async () => {
    // Arrange
    const body = '<img src="x" alt="injected"> <b>bold</b>';
    server.use(
      ...taskPage(
        { project: 'MEMBER' },
        { threads: [threadNode(TASK_ID, PAT, { body })] },
      ),
    );

    // Act
    renderRoutes(routes, { route: TASK_ROUTE });

    // Assert
    const comment = await commentBy(PAT.name);
    expect(within(comment).getByText(body)).toBeVisible();
    expect(screen.queryByAltText('injected')).toBeNull();
    expect(comment.querySelector('b')).toBeNull();
  });

  it('invites a member to start the discussion, and only tells a viewer it is empty', async () => {
    // Arrange
    server.use(...taskPage({ project: 'MEMBER' }));

    // Act
    const member = renderRoutes(routes, { route: TASK_ROUTE });

    // Assert
    expect(
      await screen.findByText('No comments yet. Start the discussion below.'),
    ).toBeVisible();
    expect(screen.getByLabelText('Add a comment')).toBeVisible();

    // Arrange
    member.unmount();
    server.use(...taskPage({ project: 'VIEWER' }));

    // Act
    renderRoutes(routes, { route: TASK_ROUTE });

    // Assert
    expect(await screen.findByText('No comments yet.')).toBeVisible();
    expect(screen.queryByLabelText('Add a comment')).toBeNull();
  });

  it('offers a member their own comment to change, and nobody else’s', async () => {
    // Arrange
    server.use(
      ...taskPage(
        { project: 'MEMBER' },
        {
          threads: [
            threadNode(TASK_ID, PAT),
            threadNode(TASK_ID, VIEWER, { id: NEW_COMMENT_ID, body: 'Mine.' }),
          ],
        },
      ),
    );

    // Act
    renderRoutes(routes, { route: TASK_ROUTE });

    // Assert
    const theirs = within(await commentBy(PAT.name));
    expect(theirs.getByRole('button', { name: 'Reply' })).toBeVisible();
    expect(theirs.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(theirs.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(theirs.queryByRole('button', { name: 'Resolve' })).toBeNull();

    const mine = within(await commentBy(VIEWER.name));
    expect(mine.getByRole('button', { name: 'Edit' })).toBeVisible();
    expect(mine.getByRole('button', { name: 'Delete' })).toBeVisible();
    expect(mine.getByRole('button', { name: 'Resolve' })).toBeVisible();
  });

  it('offers a viewer no way to change the discussion', async () => {
    // Arrange
    server.use(
      ...taskPage(
        { project: 'VIEWER' },
        { threads: [threadNode(TASK_ID, PAT)] },
      ),
    );

    // Act
    renderRoutes(routes, { route: TASK_ROUTE });

    // Assert — a link to a comment is open to anyone who can read it.
    const comment = within(await commentBy(PAT.name));
    expect(
      comment.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Copy link']);
  });

  it('pages forward, sending the cursor back untouched', async () => {
    // Arrange
    const cursor = 'b3BhcXVlK2N1cnNvci89PQ==';
    const requests: Array<Record<string, unknown>> = [];
    server.use(
      graphql.query('TaskComments', ({ variables }) => {
        requests.push(variables);
        return HttpResponse.json({
          data: variables['after']
            ? commentsData(
                TASK_ID,
                [
                  threadNode(TASK_ID, TERRY, {
                    id: NEW_COMMENT_ID,
                    body: 'Second page.',
                  }),
                ],
                { total: 2 },
              )
            : commentsData(TASK_ID, [threadNode(TASK_ID, PAT)], {
                hasNextPage: true,
                endCursor: cursor,
                total: 2,
              }),
        });
      }),
      ...taskPage({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await commentBy(PAT.name);
    expect(screen.getByText('Showing 1 of 2')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    // Assert
    expect(await screen.findByText('Second page.')).toBeVisible();
    expect(screen.getByText('Is the copy final?')).toBeVisible();
    expect(screen.getByText('Showing 2 of 2')).toBeVisible();
    expect(requests.at(-1)?.['after']).toBe(cursor);
    expect(
      requests.every(
        (request) =>
          typeof request['first'] === 'number' && request['first'] <= 100,
      ),
    ).toBe(true);
  });

  it('resolves a failed load into an error with a retry, leaving the task on screen', async () => {
    // Arrange
    let attempts = 0;
    server.use(
      graphql.query('TaskComments', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json({
              data: commentsData(TASK_ID, [threadNode(TASK_ID, PAT)]),
            });
      }),
      ...taskPage({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    expect(
      await screen.findByText('Could not load the comments.'),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Build login' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(await screen.findByText('Is the copy final?')).toBeVisible();
  });
});

describe('writing a comment', () => {
  it('shows the comment at once, then sends it and re-reads the audit trail', async () => {
    // Arrange
    const held = gate();
    let sent: unknown;
    let taskReads = 0;
    server.use(
      graphql.mutation('CreateComment', async ({ variables }) => {
        sent = variables;
        await held.opened;
        return HttpResponse.json({
          data: {
            createComment: threadNode(TASK_ID, VIEWER, {
              id: NEW_COMMENT_ID,
              body: 'Looks good',
            }),
          },
        });
      }),
      ...taskPage({ project: 'MEMBER' }),
    );
    server.events.on('request:start', ({ request }) => {
      void request
        .clone()
        .text()
        .then((text) => {
          if (text.includes('query Task(')) taskReads += 1;
        });
    });
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });
    const field = await screen.findByLabelText('Add a comment');
    await waitFor(() => expect(taskReads).toBe(1));

    // Act
    await user.type(field, '  Looks good  ');
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    // Assert — on screen before the server has answered.
    const pending = await commentBy(VIEWER.name);
    expect(within(pending).getByText('Looks good')).toBeVisible();
    expect(within(pending).getByText('Sending…')).toBeVisible();
    expect(within(pending).queryByRole('button')).toBeNull();
    expect(field).toHaveValue('');

    // Act
    held.open();

    // Assert
    await waitFor(() => expect(screen.queryByText('Sending…')).toBeNull());
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(
      within(await commentBy(VIEWER.name)).getByRole('button', {
        name: 'Edit',
      }),
    ).toBeVisible();
    expect(sent).toEqual({
      taskId: TASK_ID,
      input: { body: 'Looks good', mentionedUserIds: [] },
    });
    await waitFor(() => expect(taskReads).toBe(2));

    server.events.removeAllListeners();
  });

  it.each<[ErrorCode, string]>([
    ['FORBIDDEN', 'You don’t have permission to do that.'],
    ['BAD_USER_INPUT', 'Some of the details below need fixing.'],
  ])(
    'takes the comment back on %s and returns what was typed',
    async (code, message) => {
      // Arrange
      const held = gate();
      server.use(
        graphql.mutation('CreateComment', async () => {
          await held.opened;
          return HttpResponse.json({
            errors: [{ message: SERVER_DETAIL, extensions: { code } }],
            data: null,
          });
        }),
        ...taskPage({ project: 'MEMBER' }),
      );
      const { user } = renderRoutes(routes, { route: TASK_ROUTE });
      const field = await screen.findByLabelText('Add a comment');

      // Act
      await user.type(field, 'Looks good');
      await user.click(screen.getByRole('button', { name: 'Comment' }));
      await commentBy(VIEWER.name);
      held.open();

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.queryByRole('article')).toBeNull();
      expect(field).toHaveValue('Looks good');
      expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
    },
  );

  it('takes the comment back when the server cannot be reached', async () => {
    // Arrange
    server.use(
      graphql.mutation('CreateComment', () => HttpResponse.error()),
      ...taskPage({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });
    const field = await screen.findByLabelText('Add a comment');

    // Act
    await user.type(field, 'Looks good');
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Can’t reach the server. Check your connection and try again.',
    );
    expect(screen.queryByRole('article')).toBeNull();
    expect(field).toHaveValue('Looks good');
  });

  it('refuses an empty comment and sends nothing', async () => {
    // Arrange — no CreateComment handler: a request would fail the test.
    server.use(...taskPage({ project: 'MEMBER' }));
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });
    const field = await screen.findByLabelText('Add a comment');

    // Act
    await user.type(field, '   ');
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    // Assert
    expect(await screen.findByText('Write something first.')).toBeVisible();
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('sends on Ctrl+Enter from the text field', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      graphql.mutation('CreateComment', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            createComment: threadNode(TASK_ID, VIEWER, {
              id: NEW_COMMENT_ID,
              body: 'From the keyboard',
            }),
          },
        });
      }),
      ...taskPage({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });
    const field = await screen.findByLabelText('Add a comment');

    // Act
    await user.type(field, 'From the keyboard');
    await user.keyboard('{Control>}{Enter}{/Control}');

    // Assert
    await waitFor(() =>
      expect(sent).toEqual({
        taskId: TASK_ID,
        input: { body: 'From the keyboard', mentionedUserIds: [] },
      }),
    );
  });

  it('mentions only people picked from the project, never a name in the text', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      graphql.mutation('CreateComment', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            createComment: threadNode(TASK_ID, VIEWER, {
              id: NEW_COMMENT_ID,
              body: '@Terry Teammate please look',
              mentions: [PAT],
            }),
          },
        });
      }),
      ...taskPage({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });
    const field = await screen.findByLabelText('Add a comment');

    // Act — the keyboard alone: type to filter, Enter to pick.
    await user.type(field, '@Terry Teammate please look');
    await user.click(screen.getByRole('combobox', { name: 'Mention someone' }));
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual([PAT.name, TERRY.name]);
    await user.keyboard('pat{Enter}');

    // Assert
    const mentioned = screen.getByRole('list', { name: 'People mentioned' });
    expect(within(mentioned).getByText(PAT.name)).toBeVisible();

    // Act
    await user.click(screen.getByRole('button', { name: 'Comment' }));

    // Assert
    await waitFor(() =>
      expect(sent).toEqual({
        taskId: TASK_ID,
        input: {
          body: '@Terry Teammate please look',
          mentionedUserIds: [PAT.id],
        },
      }),
    );
    expect(await screen.findByText('Mentions Pat Project')).toBeVisible();
  });

  it('lets a picked mention be taken back before sending', async () => {
    // Arrange
    server.use(...taskPage({ project: 'MEMBER' }));
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });
    await screen.findByLabelText('Add a comment');

    // Act
    await user.click(screen.getByRole('combobox', { name: 'Mention someone' }));
    await user.click(await screen.findByRole('option', { name: TERRY.name }));
    await user.click(
      screen.getByRole('button', { name: 'Remove mention of Terry Teammate' }),
    );

    // Assert
    expect(screen.queryByRole('list', { name: 'People mentioned' })).toBeNull();
  });

  it('files a reply under its thread', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      graphql.mutation('CreateComment', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            createComment: threadNode(TASK_ID, VIEWER, {
              id: REPLY_ID,
              body: 'On it.',
              parentCommentId: COMMENT_ID,
            }),
          },
        });
      }),
      ...taskPage(
        { project: 'MEMBER' },
        { threads: [threadNode(TASK_ID, PAT)] },
      ),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      within(await commentBy(PAT.name)).getByRole('button', { name: 'Reply' }),
    );
    await user.type(screen.getByLabelText('Reply to Pat Project'), 'On it.');
    await user.click(
      within(
        screen.getByLabelText('Reply to Pat Project').closest('form')!,
      ).getByRole('button', { name: 'Reply' }),
    );

    // Assert
    const replies = await screen.findByRole('list', {
      name: 'Replies to Pat Project',
    });
    expect(within(replies).getByText('On it.')).toBeVisible();
    expect(sent).toEqual({
      taskId: TASK_ID,
      input: {
        body: 'On it.',
        mentionedUserIds: [],
        parentCommentId: COMMENT_ID,
      },
    });
    await waitFor(() =>
      expect(screen.queryByLabelText('Reply to Pat Project')).toBeNull(),
    );
  });
});

describe('changing a comment', () => {
  it('edits the text and marks the comment as edited', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      graphql.mutation('EditComment', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            editComment: {
              __typename: 'Comment',
              id: COMMENT_ID,
              body: 'Copy is final.',
              edited: true,
              editedAt: '2026-09-08T10:00:00.000Z',
            },
          },
        });
      }),
      ...taskPage(
        { project: 'MEMBER' },
        { threads: [threadNode(TASK_ID, VIEWER, { mentions: [PAT] })] },
      ),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      within(await commentBy(VIEWER.name)).getByRole('button', {
        name: 'Edit',
      }),
    );
    const field = screen.getByLabelText('Edit comment');

    // Assert — an edit cannot change who is mentioned, and says so.
    expect(field).toHaveValue('Is the copy final?');
    expect(
      screen.getByText(
        'Editing changes the text only. The people already mentioned stay mentioned.',
      ),
    ).toBeVisible();

    // Act
    await user.clear(field);
    await user.type(field, ' Copy is final. ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(await screen.findByText('Comment saved.')).toBeVisible();
    const comment = within(await commentBy(VIEWER.name));
    expect(comment.getByText('Copy is final.')).toBeVisible();
    expect(comment.getByText('Edited')).toBeVisible();
    expect(sent).toEqual({
      id: COMMENT_ID,
      input: { body: 'Copy is final.' },
    });
  });

  it('keeps the edit open with the reason when the server refuses it', async () => {
    // Arrange
    server.use(
      mutationFails('EditComment', 'FORBIDDEN'),
      ...taskPage(
        { project: 'ADMIN' },
        { threads: [threadNode(TASK_ID, PAT)] },
      ),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act — an admin is offered another person's comment.
    await user.click(
      within(await commentBy(PAT.name)).getByRole('button', { name: 'Edit' }),
    );
    await user.type(screen.getByLabelText('Edit comment'), ' Really?');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You don’t have permission to do that.',
    );
    expect(screen.getByLabelText('Edit comment')).toHaveValue(
      'Is the copy final? Really?',
    );
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('resolves and reopens a thread at once', async () => {
    // Arrange
    const sent: unknown[] = [];
    server.use(
      graphql.mutation('ResolveComment', ({ variables }) => {
        sent.push(variables);
        return HttpResponse.json({
          data: {
            resolveComment: {
              __typename: 'Comment',
              id: COMMENT_ID,
              resolved: variables['resolved'],
            },
          },
        });
      }),
      ...taskPage(
        { project: 'ADMIN' },
        { threads: [threadNode(TASK_ID, PAT)] },
      ),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });
    const comment = within(await commentBy(PAT.name));

    // Act
    await user.click(comment.getByRole('button', { name: 'Resolve' }));

    // Assert
    expect(await comment.findByText('Resolved')).toBeVisible();

    // Act
    await user.click(await comment.findByRole('button', { name: 'Reopen' }));

    // Assert
    await waitFor(() => expect(comment.queryByText('Resolved')).toBeNull());
    expect(sent).toEqual([
      { id: COMMENT_ID, resolved: true },
      { id: COMMENT_ID, resolved: false },
    ]);
  });

  it('puts a thread back when resolving it is refused', async () => {
    // Arrange
    server.use(
      mutationFails('ResolveComment', 'FORBIDDEN'),
      ...taskPage(
        { project: 'ADMIN' },
        { threads: [threadNode(TASK_ID, PAT)] },
      ),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });
    const comment = within(await commentBy(PAT.name));

    // Act
    await user.click(comment.getByRole('button', { name: 'Resolve' }));

    // Assert
    expect(
      await screen.findByText('You don’t have permission to do that.'),
    ).toBeVisible();
    await waitFor(() => expect(comment.queryByText('Resolved')).toBeNull());
    expect(comment.getByRole('button', { name: 'Resolve' })).toBeVisible();
  });

  it('asks before deleting, then takes the thread out of the list', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      graphql.mutation('DeleteComment', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({ data: { deleteComment: true } });
      }),
      ...taskPage(
        { project: 'ADMIN' },
        {
          threads: [
            threadNode(TASK_ID, PAT),
            threadNode(TASK_ID, TERRY, { id: NEW_COMMENT_ID, body: 'Stays.' }),
          ],
        },
      ),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      within(await commentBy(PAT.name)).getByRole('button', {
        name: 'Delete',
      }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Delete this comment by Pat Project?',
    });

    // Assert — nothing is sent before the confirmation.
    expect(sent).toBeUndefined();

    // Act
    await user.click(
      within(dialog).getByRole('button', { name: 'Delete comment' }),
    );

    // Assert
    expect(await screen.findByText('Comment deleted.')).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByText('Is the copy final?')).toBeNull(),
    );
    expect(screen.getByText('Stays.')).toBeVisible();
    expect(screen.getByText('Showing 1 of 1')).toBeVisible();
    expect(sent).toEqual({ id: COMMENT_ID });
  });

  it('takes a deleted reply out of its thread only', async () => {
    // Arrange
    server.use(
      graphql.mutation('DeleteComment', () =>
        HttpResponse.json({ data: { deleteComment: true } }),
      ),
      ...taskPage(
        { project: 'MEMBER' },
        {
          threads: [
            threadNode(TASK_ID, PAT, {}, [
              commentNode(TASK_ID, VIEWER, {
                id: REPLY_ID,
                body: 'My reply.',
                parentCommentId: COMMENT_ID,
              }),
            ]),
          ],
        },
      ),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      within(await commentBy(VIEWER.name)).getByRole('button', {
        name: 'Delete',
      }),
    );
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Delete comment',
      }),
    );

    // Assert
    await waitFor(() => expect(screen.queryByText('My reply.')).toBeNull());
    expect(screen.getByText('Is the copy final?')).toBeVisible();
  });

  it('leaves another person’s comment in place when deleting it is refused', async () => {
    // Arrange
    server.use(
      mutationFails('DeleteComment', 'FORBIDDEN'),
      ...taskPage(
        { project: 'ADMIN' },
        { threads: [threadNode(TASK_ID, PAT)] },
      ),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      within(await commentBy(PAT.name)).getByRole('button', {
        name: 'Delete',
      }),
    );
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Delete comment',
      }),
    );

    // Assert
    expect(
      await screen.findByText('You don’t have permission to do that.'),
    ).toBeVisible();
    expect(screen.getByText('Is the copy final?')).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });
});

describe('linked comment', () => {
  it('copies a link that opens the task on that comment', async () => {
    // Arrange
    server.use(
      ...taskPage(
        { project: 'MEMBER' },
        { threads: [threadNode(TASK_ID, PAT)] },
      ),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      within(await commentBy(PAT.name)).getByRole('button', {
        name: 'Copy link',
      }),
    );

    // Assert
    expect(await screen.findByText('Link copied.')).toBeVisible();
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}${taskCommentPath(PROJECT_ID, TASK_ID, COMMENT_ID)}`,
    );
  });

  it('shows the linked comment above the thread, even a reply, and can be dismissed', async () => {
    // Arrange
    let asked: unknown;
    server.use(
      graphql.query('LinkedComment', ({ variables }) => {
        asked = variables;
        return HttpResponse.json({
          data: {
            comment: threadNode(TASK_ID, TERRY, {
              id: REPLY_ID,
              body: 'Yes, signed off.',
              parentCommentId: COMMENT_ID,
            }),
          },
        });
      }),
      ...taskPage({ project: 'MEMBER' }),
    );

    // Act
    const { user, router } = renderRoutes(routes, {
      route: taskCommentPath(PROJECT_ID, TASK_ID, REPLY_ID),
    });

    // Assert
    const linked = await screen.findByRole('region', {
      name: 'Linked comment',
    });
    expect(await within(linked).findByText('Yes, signed off.')).toBeVisible();
    // Read-only: the comment's actions belong to the thread below.
    expect(
      within(linked)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Dismiss']);
    expect(asked).toEqual({ id: REPLY_ID });

    // Act
    await user.click(within(linked).getByRole('button', { name: 'Dismiss' }));

    // Assert
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Linked comment' }),
      ).toBeNull(),
    );
    expect(router.state.location.search).toBe('');
  });

  it('says a comment is not here when the link is malformed, without asking', async () => {
    // Arrange — no LinkedComment handler: a request would fail the test.
    server.use(...taskPage({ project: 'MEMBER' }));

    // Act
    renderRoutes(routes, { route: `${TASK_ROUTE}?comment=not-an-id` });

    // Assert
    const linked = await screen.findByRole('region', {
      name: 'Linked comment',
    });
    expect(
      within(linked).getByText(
        'This comment is not here. It may have been deleted, or the link may be wrong.',
      ),
    ).toBeVisible();
  });

  it.each<[string, () => Response]>([
    [
      'has been deleted',
      () =>
        HttpResponse.json({
          errors: [
            { message: SERVER_DETAIL, extensions: { code: 'NOT_FOUND' } },
          ],
          data: null,
        }),
    ],
    [
      'belongs to another task',
      () =>
        HttpResponse.json({
          data: { comment: threadNode(OTHER_TASK_ID, PAT) },
        }),
    ],
  ])('says a comment is not here when it %s', async (_case, respond) => {
    // Arrange
    server.use(
      graphql.query('LinkedComment', () => respond() as never),
      ...taskPage({ project: 'MEMBER' }),
    );

    // Act
    renderRoutes(routes, {
      route: taskCommentPath(PROJECT_ID, TASK_ID, COMMENT_ID),
    });

    // Assert
    const linked = await screen.findByRole('region', {
      name: 'Linked comment',
    });
    expect(
      await within(linked).findByText(
        'This comment is not here. It may have been deleted, or the link may be wrong.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('Is the copy final?')).toBeNull();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });
});

describe('attachments', () => {
  it('says only a record is kept, whether or not anything is listed', async () => {
    // Arrange
    server.use(...taskPage({ project: 'VIEWER' }));

    // Act
    renderRoutes(routes, { route: TASK_ROUTE });

    // Assert
    expect(await screen.findByText('No attachment records yet.')).toBeVisible();
    expect(
      screen.getByText(/The files themselves are not stored here/),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Record an attachment' }),
    ).toBeNull();
  });

  it('lists a record as text with its type and size, never as a link or a download', async () => {
    // Arrange
    server.use(
      ...taskPage(
        { project: 'MEMBER' },
        { attachments: [attachmentNode(PAT)] },
      ),
    );

    // Act
    renderRoutes(routes, { route: TASK_ROUTE });

    // Assert
    const record = (await screen.findByText('wireframes.pdf')).closest('li');
    expect(record).not.toBeNull();
    const row = within(record as HTMLElement);
    expect(row.getByText('application/pdf · 1.5 kB')).toBeVisible();
    expect(row.getByText(/^Recorded by Pat Project/)).toBeVisible();
    // Nothing to follow and nothing to press: no link, no download, and — for
    // a member who neither recorded it nor moderates — no way to remove it.
    expect(row.queryByRole('link')).toBeNull();
    expect(row.queryByRole('button')).toBeNull();
  });

  it('records an attachment from typed details, with no file picker anywhere', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      graphql.mutation('AddTaskAttachment', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            addTaskAttachment: attachmentNode(VIEWER, {
              id: NEW_ATTACHMENT_ID,
              filename: 'spec.docx',
              contentType: null,
              sizeBytes: 2048,
            }),
          },
        });
      }),
      ...taskPage({ project: 'MEMBER' }),
    );
    const { user, container } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Record an attachment' }),
    );

    // Assert — the form says what it does before anything is typed.
    expect(screen.getByText('No file is uploaded')).toBeVisible();
    expect(container.querySelector('input[type="file"]')).toBeNull();

    // Act
    await user.type(screen.getByLabelText('File name'), ' spec.docx ');
    await user.type(screen.getByLabelText('Size in bytes'), '2048');
    await user.click(screen.getByRole('button', { name: 'Record attachment' }));

    // Assert
    expect(
      await screen.findByText('A record of spec.docx has been added.'),
    ).toBeVisible();
    expect(screen.getByText('2 kB')).toBeVisible();
    expect(screen.queryByText('No attachment records yet.')).toBeNull();
    expect(sent).toEqual({
      taskId: TASK_ID,
      input: { filename: 'spec.docx', contentType: null, sizeBytes: 2048 },
    });
    // The person who recorded it may remove it.
    expect(
      screen.getByRole('button', { name: 'Remove the record of spec.docx' }),
    ).toBeVisible();
  });

  it('points at the field when a detail is wrong, and sends nothing', async () => {
    // Arrange — no AddTaskAttachment handler: a request would fail the test.
    server.use(...taskPage({ project: 'MEMBER' }));
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Record an attachment' }),
    );
    await user.type(screen.getByLabelText('Size in bytes'), '1.5');
    await user.click(screen.getByRole('button', { name: 'Record attachment' }));

    // Assert
    expect(await screen.findByText('Enter the file’s name.')).toBeVisible();
    expect(
      screen.getByText('Enter a whole number of bytes, up to 2,147,483,647.'),
    ).toBeVisible();
  });

  it('shows a form-level error when the server rejects a record', async () => {
    // Arrange
    server.use(
      mutationFails('AddTaskAttachment', 'BAD_USER_INPUT'),
      ...taskPage({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Record an attachment' }),
    );
    await user.type(screen.getByLabelText('File name'), 'spec.docx');
    await user.click(screen.getByRole('button', { name: 'Record attachment' }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Some of the details below need fixing.',
    );
    expect(screen.getByLabelText('File name')).toHaveValue('spec.docx');
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('asks before removing a record, and says no file is deleted', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      graphql.mutation('RemoveAttachment', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({ data: { removeAttachment: true } });
      }),
      ...taskPage({ project: 'ADMIN' }, { attachments: [attachmentNode(PAT)] }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', {
        name: 'Remove the record of wireframes.pdf',
      }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Remove the record of wireframes.pdf?',
    });

    // Assert — nothing is sent before the confirmation.
    expect(sent).toBeUndefined();
    expect(
      within(dialog).getByText(
        'Only the record is removed. No file is stored here, so none is deleted.',
      ),
    ).toBeVisible();

    // Act
    await user.click(
      within(dialog).getByRole('button', { name: 'Remove record' }),
    );

    // Assert
    expect(
      await screen.findByText('The record of wireframes.pdf has been removed.'),
    ).toBeVisible();
    expect(await screen.findByText('No attachment records yet.')).toBeVisible();
    expect(sent).toEqual({ id: ATTACHMENT_ID });
  });

  it('keeps a record listed when removing it is refused', async () => {
    // Arrange
    server.use(
      mutationFails('RemoveAttachment', 'FORBIDDEN'),
      ...taskPage({ project: 'ADMIN' }, { attachments: [attachmentNode(PAT)] }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', {
        name: 'Remove the record of wireframes.pdf',
      }),
    );
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Remove record',
      }),
    );

    // Assert
    expect(
      await screen.findByText('You don’t have permission to do that.'),
    ).toBeVisible();
    expect(screen.getByText('wireframes.pdf')).toBeVisible();
  });

  it('records an attachment on a comment and lists it under that comment', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      graphql.mutation('AddCommentAttachment', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: {
            addCommentAttachment: attachmentNode(VIEWER, {
              id: NEW_ATTACHMENT_ID,
              filename: 'screenshot.png',
              contentType: 'image/png',
              sizeBytes: null,
            }),
          },
        });
      }),
      ...taskPage(
        { project: 'MEMBER' },
        { threads: [threadNode(TASK_ID, PAT)] },
      ),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });
    const comment = within(await commentBy(PAT.name));

    // Act
    await user.click(comment.getByRole('button', { name: 'Record a file' }));
    await user.type(comment.getByLabelText('File name'), 'screenshot.png');
    await user.type(comment.getByLabelText('File type'), 'image/png');
    await user.click(
      comment.getByRole('button', { name: 'Record attachment' }),
    );

    // Assert
    expect(await comment.findByText('screenshot.png')).toBeVisible();
    expect(comment.getByText('image/png')).toBeVisible();
    expect(sent).toEqual({
      commentId: COMMENT_ID,
      input: {
        filename: 'screenshot.png',
        contentType: 'image/png',
        sizeBytes: null,
      },
    });
    await waitFor(() =>
      expect(comment.queryByLabelText('File name')).toBeNull(),
    );
  });
});

describe('task discussion accessibility', () => {
  it('has no violations with comments, replies and records on screen', async () => {
    // Arrange
    server.use(
      ...taskPage(
        { project: 'ADMIN' },
        {
          threads: [
            threadNode(
              TASK_ID,
              PAT,
              {
                resolved: true,
                mentions: [TERRY],
                attachments: [attachmentNode(PAT)],
              },
              [
                commentNode(TASK_ID, TERRY, {
                  id: REPLY_ID,
                  body: 'Yes, signed off.',
                  parentCommentId: COMMENT_ID,
                }),
              ],
            ),
          ],
          attachments: [
            attachmentNode(TERRY, {
              id: NEW_ATTACHMENT_ID,
              filename: 'brief.txt',
            }),
          ],
        },
      ),
    );

    // Act
    const { container, user } = renderRoutes(routes, { route: TASK_ROUTE });
    await user.click(
      await screen.findByRole('button', { name: 'Record an attachment' }),
    );
    await commentBy(PAT.name);
    await waitFor(() => {
      for (const select of screen.getAllByRole('combobox')) {
        if (select instanceof HTMLButtonElement) {
          expect(select.textContent).not.toBe('');
        }
      }
    });

    // Assert
    expect(await auditA11y(container)).toHaveNoViolations();
  });
});
