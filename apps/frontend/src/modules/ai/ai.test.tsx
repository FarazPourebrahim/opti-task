import { HttpResponse } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ErrorCode } from '@contracts';
import { routes } from '@/App';
import {
  ASSIGNMENT_ID,
  ESTIMATE_ID,
  HEALTH_ID,
  PAT,
  PROJECT_ID,
  SPRINT_ID,
  TASK_ID,
  TERRY,
  assignmentNode,
  candidate,
  contextData,
  decided,
  estimateNode,
  healthNode,
  queueScenario,
  recommendationNode,
  recommendationsData,
} from '@/modules/ai/ai.fixtures';
import type { RecommendationNode } from '@/modules/ai/ai.fixtures';
import {
  overrideAssigneeSchema,
  overrideStoryPointsSchema,
} from '@/modules/ai/schemas/ai.schema';
import {
  aiCapabilities,
  confidencePercent,
  readSuggestion,
} from '@/modules/ai/utils/ai.utils';
import type { Scenario } from '@/modules/project/project.fixtures';
import { sprintDetailScenario } from '@/modules/sprint/sprint.fixtures';
import { detailScenario } from '@/modules/task/task.fixtures';
import type { TaskOverrides } from '@/modules/task/task.fixtures';
import {
  projectAiPath,
  projectPath,
  sprintPath,
  taskPath,
} from '@/shared/routes/route.constants';
import { resetRefreshState } from '@/shared/services/auth.gateway';
import {
  clearAccessToken,
  setAccessToken,
} from '@/shared/services/session.store';
import { auditA11y } from '@/shared/tests/a11y';
import { graphql, mockMutationError } from '@/shared/tests/graphql';
import {
  createRealtimeServer,
  createRealtimeTestClient,
} from '@/shared/tests/realtime';
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

const AI_ROUTE = projectAiPath(PROJECT_ID);
const TASK_ROUTE = taskPath(PROJECT_ID, TASK_ID);
const SPRINT_ROUTE = sprintPath(PROJECT_ID, SPRINT_ID);

function mutationFails(name: string, code: ErrorCode) {
  return mockMutationError(name, code, SERVER_DETAIL);
}

function card(typeName: string) {
  return screen.findByRole('article', { name: `${typeName}, from the AI` });
}

/** Answers a decision mutation and applies it to the queue, as the server does. */
function decisionSucceeds(
  mutation:
    'ApproveRecommendation' | 'RejectRecommendation' | 'OverrideRecommendation',
  field: string,
  status: 'APPROVED' | 'REJECTED' | 'OVERRIDDEN',
  queue: { recommendations: RecommendationNode[] },
) {
  const sent: unknown[] = [];
  const handler = graphql.mutation(mutation, ({ variables }) => {
    sent.push(variables);
    let result: RecommendationNode | undefined;
    queue.recommendations = queue.recommendations.map((node) => {
      if (node.id !== variables['id']) return node;
      result = decided(node, status);
      return result;
    });
    return HttpResponse.json({ data: { [field]: result ?? null } });
  });
  return { sent, handler };
}

/** The two fields an applied decision changes on its task. */
function appliedTask(storyPoints: number | null, assignee = TERRY) {
  let reads = 0;
  const handler = graphql.query('AiAppliedTask', () => {
    reads += 1;
    return HttpResponse.json({
      data: {
        task: {
          __typename: 'Task',
          id: TASK_ID,
          storyPoints,
          assigneeId: assignee.id,
          assignee: {
            __typename: 'User',
            id: assignee.id,
            name: assignee.name,
            avatarUrl: null,
          },
        },
      },
    });
  });
  return { reads: () => reads, handler };
}

/** Holds a response back until the test lets it go. */
function gate() {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
}

function queuePage(scenario: Scenario, recommendations: RecommendationNode[]) {
  const scene = queueScenario(scenario, recommendations);
  server.use(...scene.handlers);
  return scene;
}

/*
 * The sprint page brings the charting library with it. Its first import under
 * a parallel run can outlast a query's timeout, so it is loaded once up front.
 */
beforeAll(async () => {
  await import('@/modules/sprint/SprintDetail.page');
}, 60_000);

beforeEach(() => {
  resetRefreshState();
  clearAccessToken();
  server.use(...signedIn());
});

afterEach(() => {
  clearAccessToken();
});

describe('reading a recommendation', () => {
  it('reads what each kind proposes, and nothing from a shape it does not know', () => {
    // Arrange
    const read = (type: string, metadata: Record<string, unknown>) =>
      readSuggestion({ type: type as never, metadata });

    // Act
    const estimate = read('STORY_POINT_ESTIMATION', { storyPoints: 5 });
    const assignment = read('TASK_ASSIGNMENT', { suggestedAssigneeId: 'u1' });
    const insight = read('SPRINT_HEALTH', { risks: ['Late', 7, null] });

    // Assert
    expect(estimate).toEqual({ kind: 'storyPoints', storyPoints: 5 });
    expect(assignment).toEqual({ kind: 'assignee', assigneeId: 'u1' });
    expect(insight).toEqual({ kind: 'insight', risks: ['Late'] });
    expect(read('STORY_POINT_ESTIMATION', { storyPoints: '5' })).toEqual({
      kind: 'storyPoints',
      storyPoints: null,
    });
    expect(read('STORY_POINT_ESTIMATION', { storyPoints: -1 })).toEqual({
      kind: 'storyPoints',
      storyPoints: null,
    });
    expect(read('TASK_ASSIGNMENT', { suggestedAssigneeId: null })).toEqual({
      kind: 'assignee',
      assigneeId: null,
    });
    expect(read('PROGRESS_TRACKING', {})).toEqual({
      kind: 'insight',
      risks: [],
    });
    expect(read('RECOMMENDATION', { risks: 'none' })).toEqual({
      kind: 'insight',
      risks: [],
    });
  });

  it('writes confidence as a whole percentage, or as unknown', () => {
    // Arrange
    const scores = [0, 0.654, 1, 1.4, -0.2, null, undefined, Number.NaN];

    // Act
    const percents = scores.map(confidencePercent);

    // Assert
    expect(percents).toEqual([0, 65, 100, 100, 0, null, null, null]);
  });

  it('lets members ask and only admins decide', () => {
    // Arrange / Act
    const member = aiCapabilities(['PROJECT_MEMBER']);
    const lead = aiCapabilities(['TEAM_LEAD']);
    const admin = aiCapabilities(['PROJECT_ADMIN']);
    const viewer = aiCapabilities(['VIEWER']);

    // Assert
    expect(member).toEqual({ canRequest: true, canDecide: false });
    expect(lead).toEqual({ canRequest: true, canDecide: false });
    expect(admin).toEqual({ canRequest: true, canDecide: true });
    expect(viewer).toEqual({ canRequest: false, canDecide: false });
  });

  it('takes a whole estimate from 0 to 1,000, or a person, as an override', () => {
    // Arrange
    const points = (storyPoints: number) =>
      overrideStoryPointsSchema.safeParse({ storyPoints }).success;

    // Act / Assert
    expect(points(0)).toBe(true);
    expect(points(1000)).toBe(true);
    expect(points(1001)).toBe(false);
    expect(points(2.5)).toBe(false);
    expect(points(-1)).toBe(false);
    expect(points(Number.NaN)).toBe(false);
    expect(overrideAssigneeSchema.safeParse({ assigneeId: '' }).success).toBe(
      false,
    );
    expect(overrideAssigneeSchema.safeParse({ assigneeId: 'u1' }).success).toBe(
      true,
    );
  });
});

describe('recommendation queue', () => {
  it('is reached from the project’s AI tab', async () => {
    // Arrange
    queuePage({ project: 'MEMBER' }, [estimateNode()]);
    const { user } = renderRoutes(routes, { route: projectPath(PROJECT_ID) });

    // Act
    await user.click(await screen.findByRole('link', { name: 'AI' }));

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'AI recommendations' }),
    ).toBeVisible();
    expect(await card('Story point estimate')).toBeVisible();
  });

  it('shows a suggestion as a suggestion: what, how sure, from whom, when, and both statuses', async () => {
    // Arrange
    queuePage({ project: 'MEMBER' }, [
      estimateNode(),
      decided(assignmentNode(), 'APPROVED'),
      healthNode({ confidenceScore: null, provider: null, requestedBy: null }),
    ]);

    // Act
    renderRoutes(routes, { route: AI_ROUTE });

    // Assert
    const estimate = within(await card('Story point estimate'));
    expect(estimate.getByText('Suggests 5 story points')).toBeVisible();
    expect(
      estimate.getByText(
        'Estimated 5 points from 12 words of scope and 3 similar tasks.',
      ),
    ).toBeVisible();
    expect(estimate.getByText('Confidence').parentElement).toHaveTextContent(
      'Confidence80%',
    );
    expect(estimate.getByText('From stub')).toBeVisible();
    expect(estimate.getByText('Requested by Pat Project')).toBeVisible();
    expect(estimate.getByText('Decision').parentElement).toHaveTextContent(
      'DecisionPending',
    );
    expect(estimate.getByText('Outcome').parentElement).toHaveTextContent(
      'OutcomeOpen',
    );
    expect(
      estimate.getByRole('link', { name: 'Open the task' }),
    ).toHaveAttribute('href', taskPath(PROJECT_ID, TASK_ID));

    // A person is named from the project's members, never shown as an id.
    const assignment = within(await card('Assignment suggestion'));
    expect(
      assignment.getByText('Suggests assigning this to Terry Teammate'),
    ).toBeVisible();
    expect(assignment.getByText('Decision').parentElement).toHaveTextContent(
      'DecisionApproved',
    );
    expect(assignment.getByText('Outcome').parentElement).toHaveTextContent(
      'OutcomeResolved',
    );
    expect(assignment.getByText('Decided by Pat Project')).toBeVisible();
    expect(screen.queryByText(TERRY.id)).toBeNull();

    // Nothing reported is said to be so, never left blank.
    const health = within(await card('Sprint health'));
    expect(health.getByText('For information only')).toBeVisible();
    expect(
      health.getByText('Committed story points exceed sprint capacity.'),
    ).toBeVisible();
    expect(health.getByText('Confidence').parentElement).toHaveTextContent(
      'ConfidenceNot reported',
    );
    expect(health.getByText('From an unnamed provider')).toBeVisible();
    expect(health.getByText('Requester unknown')).toBeVisible();
    expect(
      health.getByRole('link', { name: 'Open the sprint' }),
    ).toHaveAttribute('href', sprintPath(PROJECT_ID, SPRINT_ID));
  });

  it('filters by kind and by decision, asking the server, and tells its empty states apart', async () => {
    // Arrange
    const { requests } = queuePage({ project: 'MEMBER' }, [
      estimateNode(),
      healthNode(),
    ]);
    const { user } = renderRoutes(routes, { route: AI_ROUTE });
    await card('Story point estimate');

    // Act
    await user.click(screen.getByRole('combobox', { name: 'Kind' }));
    await user.click(
      await screen.findByRole('option', { name: 'Sprint health' }),
    );

    // Assert
    await waitFor(() =>
      expect(
        screen.queryByRole('article', {
          name: 'Story point estimate, from the AI',
        }),
      ).toBeNull(),
    );
    expect(await card('Sprint health')).toBeVisible();
    expect(requests.at(-1)).toMatchObject({
      type: 'SPRINT_HEALTH',
      approvalStatus: null,
    });

    // Act
    await user.click(screen.getByRole('combobox', { name: 'Decision' }));
    await user.click(await screen.findByRole('option', { name: 'Rejected' }));

    // Assert
    expect(
      await screen.findByText('No recommendations match these filters.'),
    ).toBeVisible();
    expect(requests.at(-1)).toMatchObject({
      type: 'SPRINT_HEALTH',
      approvalStatus: 'REJECTED',
    });
  });

  it('says where suggestions come from when the project has none', async () => {
    // Arrange
    queuePage({ project: 'MEMBER' }, []);

    // Act
    renderRoutes(routes, { route: AI_ROUTE });

    // Assert
    expect(
      await screen.findByText(
        'No recommendations yet. Ask for one from a task or a sprint.',
      ),
    ).toBeVisible();
  });

  it('offers the decision to an admin on what is pending, and to nobody else', async () => {
    // Arrange
    queuePage({ project: 'ADMIN' }, [
      estimateNode(),
      healthNode(),
      decided(assignmentNode(), 'REJECTED'),
    ]);

    // Act
    const admin = renderRoutes(routes, { route: AI_ROUTE });

    // Assert
    const names = (article: HTMLElement) =>
      within(article)
        .queryAllByRole('button')
        .map((button) => button.textContent);
    expect(names(await card('Story point estimate'))).toEqual([
      'Approve',
      'Use my own',
      'Reject',
    ]);
    // An insight has no value to replace: there is nothing to override.
    expect(names(await card('Sprint health'))).toEqual(['Approve', 'Reject']);
    expect(names(await card('Assignment suggestion'))).toEqual([]);

    // Arrange — may request, may not decide.
    admin.unmount();
    queuePage({ project: 'MEMBER' }, [estimateNode()]);

    // Act
    renderRoutes(routes, { route: AI_ROUTE });

    // Assert
    expect(names(await card('Story point estimate'))).toEqual([]);
  });

  it('pages forward, sending the cursor back untouched', async () => {
    // Arrange
    const cursor = 'b3BhcXVlK2N1cnNvci89PQ==';
    const requests: Array<Record<string, unknown>> = [];
    server.use(
      graphql.query('ProjectAiRecommendations', ({ variables }) => {
        requests.push(variables);
        return HttpResponse.json({
          data: variables['after']
            ? recommendationsData([healthNode()], { total: 2 })
            : recommendationsData([estimateNode()], {
                hasNextPage: true,
                endCursor: cursor,
                total: 2,
              }),
        });
      }),
      ...queueScenario({ project: 'MEMBER' }).handlers,
    );
    const { user } = renderRoutes(routes, { route: AI_ROUTE });
    await card('Story point estimate');

    // Act
    await user.click(screen.getByRole('button', { name: 'Load more' }));

    // Assert
    expect(await card('Sprint health')).toBeVisible();
    expect(await card('Story point estimate')).toBeVisible();
    expect(requests.at(-1)?.['after']).toBe(cursor);
    expect(
      requests.every(
        (request) =>
          typeof request['first'] === 'number' && request['first'] <= 100,
      ),
    ).toBe(true);
  });

  it('resolves a network failure into an error with a retry', async () => {
    // Arrange
    let attempts = 0;
    server.use(
      graphql.query('ProjectAiRecommendations', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.error()
          : HttpResponse.json({ data: recommendationsData([estimateNode()]) });
      }),
      ...queueScenario({ project: 'MEMBER' }).handlers,
    );
    const { user } = renderRoutes(routes, { route: AI_ROUTE });

    // Act
    expect(
      await screen.findByText('Could not load the recommendations.'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    // Assert
    expect(await card('Story point estimate')).toBeVisible();
  });

  it('has no accessibility violations', async () => {
    // Arrange
    queuePage({ project: 'ADMIN' }, [
      estimateNode(),
      decided(assignmentNode(), 'APPROVED'),
      healthNode(),
    ]);

    // Act
    const { container } = renderRoutes(routes, { route: AI_ROUTE });
    await card('Sprint health');
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

describe('deciding on a suggestion', () => {
  it('says what approving an estimate will change before changing it', async () => {
    // Arrange
    const { queue } = queuePage({ project: 'ADMIN' }, [estimateNode()]);
    const approved = decisionSucceeds(
      'ApproveRecommendation',
      'approveRecommendation',
      'APPROVED',
      queue,
    );
    const task = appliedTask(5);
    server.use(approved.handler, task.handler);
    const { user } = renderRoutes(routes, { route: AI_ROUTE });

    // Act
    await user.click(
      within(await card('Story point estimate')).getByRole('button', {
        name: 'Approve',
      }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Approve this suggestion?',
    });

    // Assert — the change, in words, and nothing sent yet.
    expect(
      within(dialog).getByText(
        'Approving sets this task’s estimate to 5 story points.',
      ),
    ).toBeVisible();
    expect(approved.sent).toEqual([]);

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));

    // Assert
    expect(await screen.findByText('Suggestion approved.')).toBeVisible();
    const decidedCard = within(await card('Story point estimate'));
    await waitFor(() =>
      expect(decidedCard.getByText('Decision').parentElement).toHaveTextContent(
        'DecisionApproved',
      ),
    );
    expect(decidedCard.getByText('Outcome').parentElement).toHaveTextContent(
      'OutcomeResolved',
    );
    expect(decidedCard.queryByRole('button')).toBeNull();
    expect(approved.sent).toEqual([{ id: ESTIMATE_ID }]);
    // The task it changed is read again, so every screen showing it follows.
    await waitFor(() => expect(task.reads()).toBe(1));
  });

  it('names the person an approved assignment goes to, and that they are told', async () => {
    // Arrange
    queuePage({ project: 'ADMIN' }, [
      assignmentNode(),
      {
        ...assignmentNode({ metadata: { suggestedAssigneeId: null } }),
        id: 'a4a4a4a4-a4a4-4a4a-8a4a-a4a4a4a4a4a4',
      },
    ]);
    const { user } = renderRoutes(routes, { route: AI_ROUTE });
    const cards = await screen.findAllByRole('article', {
      name: 'Assignment suggestion, from the AI',
    });

    // Act
    await user.click(
      within(cards[0] as HTMLElement).getByRole('button', { name: 'Approve' }),
    );

    // Assert
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(
        'Approving assigns this task to Terry Teammate, and notifies them.',
      ),
    ).toBeVisible();

    // Act — and one that names nobody says what that does.
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await user.click(
      within(cards[1] as HTMLElement).getByRole('button', { name: 'Approve' }),
    );

    // Assert
    expect(
      await screen.findByText(
        'Approving leaves this task with no assignee, removing the current one: the suggestion names nobody.',
      ),
    ).toBeVisible();
  });

  it('says that approving an insight changes nothing, and touches no task', async () => {
    // Arrange — no AiAppliedTask handler: a request would fail the test.
    const { queue } = queuePage({ project: 'ADMIN' }, [healthNode()]);
    const approved = decisionSucceeds(
      'ApproveRecommendation',
      'approveRecommendation',
      'APPROVED',
      queue,
    );
    server.use(approved.handler);
    const { user } = renderRoutes(routes, { route: AI_ROUTE });

    // Act
    await user.click(
      within(await card('Sprint health')).getByRole('button', {
        name: 'Approve',
      }),
    );
    const dialog = await screen.findByRole('alertdialog');

    // Assert
    expect(
      within(dialog).getByText(
        'Approving records that this has been reviewed. It changes nothing in the project.',
      ),
    ).toBeVisible();

    // Act
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }));

    // Assert
    expect(await screen.findByText('Suggestion approved.')).toBeVisible();
    expect(approved.sent).toEqual([{ id: HEALTH_ID }]);
  });

  it('rejects without changing anything else', async () => {
    // Arrange — no AiAppliedTask handler: a request would fail the test.
    const { queue } = queuePage({ project: 'ADMIN' }, [estimateNode()]);
    const rejected = decisionSucceeds(
      'RejectRecommendation',
      'rejectRecommendation',
      'REJECTED',
      queue,
    );
    server.use(rejected.handler);
    const { user } = renderRoutes(routes, { route: AI_ROUTE });

    // Act
    await user.click(
      within(await card('Story point estimate')).getByRole('button', {
        name: 'Reject',
      }),
    );

    // Assert
    expect(
      await screen.findByText('Suggestion rejected. Nothing was changed.'),
    ).toBeVisible();
    const decidedCard = within(await card('Story point estimate'));
    await waitFor(() =>
      expect(decidedCard.getByText('Decision').parentElement).toHaveTextContent(
        'DecisionRejected',
      ),
    );
    expect(decidedCard.getByText('Outcome').parentElement).toHaveTextContent(
      'OutcomeDismissed',
    );
    expect(rejected.sent).toEqual([{ id: ESTIMATE_ID }]);
  });

  it('replaces an estimate with one’s own, saying what that does as it is typed', async () => {
    // Arrange
    const { queue } = queuePage({ project: 'ADMIN' }, [estimateNode()]);
    const overridden = decisionSucceeds(
      'OverrideRecommendation',
      'overrideRecommendation',
      'OVERRIDDEN',
      queue,
    );
    const task = appliedTask(8);
    server.use(overridden.handler, task.handler);
    const { user } = renderRoutes(routes, { route: AI_ROUTE });

    // Act
    await user.click(
      within(await card('Story point estimate')).getByRole('button', {
        name: 'Use my own',
      }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Use your own value instead',
    });
    const field = within(dialog).getByLabelText('Story points');

    // Assert — nothing to save yet.
    expect(
      within(dialog).getByText(
        'Enter the estimate to use instead of the suggestion.',
      ),
    ).toBeVisible();

    // Act — out of range first: refused before anything is sent.
    await user.type(field, '1001');
    await user.click(
      within(dialog).getByRole('button', { name: 'Save my value' }),
    );

    // Assert
    expect(
      await within(dialog).findByText('Enter a whole number from 0 to 1,000.'),
    ).toBeVisible();
    expect(overridden.sent).toEqual([]);

    // Act
    await user.clear(field);
    await user.type(field, '8');

    // Assert
    expect(
      within(dialog).getByText(
        'Saving sets this task’s estimate to 8 story points and records that the suggestion was overridden.',
      ),
    ).toBeVisible();

    // Act
    await user.click(
      within(dialog).getByRole('button', { name: 'Save my value' }),
    );

    // Assert
    expect(
      await screen.findByText(
        'Your value was saved in place of the suggestion.',
      ),
    ).toBeVisible();
    expect(overridden.sent).toEqual([
      { id: ESTIMATE_ID, input: { storyPoints: 8 } },
    ]);
    const decidedCard = within(await card('Story point estimate'));
    await waitFor(() =>
      expect(decidedCard.getByText('Decision').parentElement).toHaveTextContent(
        'DecisionOverridden',
      ),
    );
    await waitFor(() => expect(task.reads()).toBe(1));
  });

  it('replaces an assignment with a project member picked by name', async () => {
    // Arrange
    const { queue } = queuePage({ project: 'ADMIN' }, [assignmentNode()]);
    const overridden = decisionSucceeds(
      'OverrideRecommendation',
      'overrideRecommendation',
      'OVERRIDDEN',
      queue,
    );
    server.use(overridden.handler, appliedTask(5, PAT).handler);
    const { user } = renderRoutes(routes, { route: AI_ROUTE });

    // Act
    await user.click(
      within(await card('Assignment suggestion')).getByRole('button', {
        name: 'Use my own',
      }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: 'Use your own value instead',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'Save my value' }),
    );

    // Assert — nobody picked: refused, nothing sent.
    expect(await within(dialog).findByText('Pick someone.')).toBeVisible();
    expect(overridden.sent).toEqual([]);

    // Act
    await user.click(
      within(dialog).getByRole('combobox', { name: 'Assign to' }),
    );
    await user.click(await screen.findByRole('option', { name: PAT.name }));

    // Assert
    expect(
      within(dialog).getByText(
        'Saving assigns this task to Pat Project and records that the suggestion was overridden.',
      ),
    ).toBeVisible();

    // Act
    await user.click(
      within(dialog).getByRole('button', { name: 'Save my value' }),
    );

    // Assert
    await waitFor(() =>
      expect(overridden.sent).toEqual([
        { id: ASSIGNMENT_ID, input: { assigneeId: PAT.id } },
      ]),
    );
  });

  it('leaves a suggestion pending when the decision is refused', async () => {
    // Arrange
    queuePage({ project: 'ADMIN' }, [estimateNode()]);
    server.use(mutationFails('ApproveRecommendation', 'FORBIDDEN'));
    const { user } = renderRoutes(routes, { route: AI_ROUTE });

    // Act
    await user.click(
      within(await card('Story point estimate')).getByRole('button', {
        name: 'Approve',
      }),
    );
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Approve',
      }),
    );

    // Assert
    expect(
      await screen.findByText('You don’t have permission to do that.'),
    ).toBeVisible();
    const pending = within(await card('Story point estimate'));
    expect(pending.getByText('Decision').parentElement).toHaveTextContent(
      'DecisionPending',
    );
    expect(pending.getByRole('button', { name: 'Approve' })).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('shows someone else’s decision when it got there first', async () => {
    // Arrange
    let reads = 0;
    queuePage({ project: 'ADMIN' }, [estimateNode()]);
    server.use(
      mutationFails('ApproveRecommendation', 'CONFLICT'),
      graphql.query('AiRecommendation', ({ variables }) => {
        reads += 1;
        return HttpResponse.json({
          data: {
            aiRecommendation: decided(
              recommendationNode(String(variables['id'])),
              'REJECTED',
              TERRY,
            ),
          },
        });
      }),
    );
    const { user } = renderRoutes(routes, { route: AI_ROUTE });

    // Act
    await user.click(
      within(await card('Story point estimate')).getByRole('button', {
        name: 'Approve',
      }),
    );
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Approve',
      }),
    );

    // Assert — why it did not take, and how the suggestion now stands.
    expect(
      await screen.findByText(
        'Someone else has already decided on this. It now shows their decision.',
      ),
    ).toBeVisible();
    const current = within(await card('Story point estimate'));
    await waitFor(() =>
      expect(current.getByText('Decision').parentElement).toHaveTextContent(
        'DecisionRejected',
      ),
    );
    expect(current.getByText('Decided by Terry Teammate')).toBeVisible();
    expect(current.queryByRole('button')).toBeNull();
    expect(reads).toBe(1);
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();
  });

  it('follows a decision someone else makes, as it is made', async () => {
    // Arrange
    setAccessToken('token-1');
    const socket = createRealtimeServer();
    queuePage({ project: 'ADMIN' }, [estimateNode()]);
    renderRoutes(routes, {
      route: AI_ROUTE,
      apolloClient: createRealtimeTestClient(socket),
    });
    const pending = within(await card('Story point estimate'));
    expect(pending.getByRole('button', { name: 'Approve' })).toBeVisible();
    await waitFor(() =>
      expect(socket.subscribed('AiRecommendationUpdated')).toHaveLength(1),
    );

    // Act
    socket.push('AiRecommendationUpdated', {
      aiRecommendationUpdated: {
        __typename: 'AiRecommendationEvent',
        recommendationId: ESTIMATE_ID,
        projectId: PROJECT_ID,
        approvalStatus: 'APPROVED',
        recommendation: decided(estimateNode(), 'APPROVED', TERRY),
      },
    });

    // Assert
    await waitFor(() =>
      expect(pending.getByText('Decision').parentElement).toHaveTextContent(
        'DecisionApproved',
      ),
    );
    expect(pending.getByText('Decided by Terry Teammate')).toBeVisible();
    expect(pending.queryByRole('button')).toBeNull();
  });
});

describe('asking for a suggestion about a task', () => {
  it('waits in words while the service works, then shows what it suggested', async () => {
    // Arrange
    const held = gate();
    let sent: unknown;
    server.use(
      graphql.mutation('RequestStoryPointEstimate', async ({ variables }) => {
        sent = variables;
        await held.opened;
        return HttpResponse.json({
          data: { requestStoryPointEstimate: estimateNode() },
        });
      }),
      ...detailScenario({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Estimate story points' }),
    );

    // Assert — the wait is said, and the other request waits its turn.
    expect(
      await screen.findByText(
        'Asking the AI service. This can take several seconds.',
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Suggest an assignee' }),
    ).toBeDisabled();

    // Act
    held.open();

    // Assert
    const suggestion = within(await card('Story point estimate'));
    expect(suggestion.getByText('Suggests 5 story points')).toBeVisible();
    expect(suggestion.getByText('Confidence').parentElement).toHaveTextContent(
      'Confidence80%',
    );
    // A member may ask, and may not decide.
    expect(suggestion.queryByRole('button')).toBeNull();
    expect(
      screen.queryByText(
        'Asking the AI service. This can take several seconds.',
      ),
    ).toBeNull();
    expect(sent).toEqual({ taskId: TASK_ID });
  });

  it('explains a provider failure as the provider’s, saves nothing, and retries on request', async () => {
    // Arrange
    let attempts = 0;
    server.use(
      graphql.mutation('RequestAssignmentRecommendation', () => {
        attempts += 1;
        return attempts === 1
          ? HttpResponse.json({
              errors: [
                {
                  message: SERVER_DETAIL,
                  extensions: { code: 'SERVICE_UNAVAILABLE' },
                },
              ],
              data: null,
            })
          : HttpResponse.json({
              data: { requestAssignmentRecommendation: assignmentNode() },
            });
      }),
      ...detailScenario({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Suggest an assignee' }),
    );

    // Assert
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The AI service did not answer');
    expect(alert).toHaveTextContent('Nothing was saved.');
    expect(
      screen.queryByRole('article', {
        name: 'Assignment suggestion, from the AI',
      }),
    ).toBeNull();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();

    // Act
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));

    // Assert
    expect(await card('Assignment suggestion')).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(attempts).toBe(2);
  });

  it('reports a refused request, and offers a viewer none at all', async () => {
    // Arrange
    server.use(
      mutationFails('RequestStoryPointEstimate', 'FORBIDDEN'),
      ...detailScenario({ project: 'MEMBER' }),
    );
    const member = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await member.user.click(
      await screen.findByRole('button', { name: 'Estimate story points' }),
    );

    // Assert
    expect(
      await screen.findByText('You don’t have permission to do that.'),
    ).toBeVisible();
    expect(screen.queryByText(SERVER_DETAIL)).toBeNull();

    // Arrange
    member.unmount();
    server.use(...detailScenario({ project: 'VIEWER' }));

    // Act
    renderRoutes(routes, { route: TASK_ROUTE });
    await screen.findByRole('heading', { name: 'Build login' });

    // Assert
    expect(
      screen.queryByRole('button', { name: 'Estimate story points' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Suggest an assignee' }),
    ).toBeNull();
  });

  it('applies an approved estimate to the task on the same page', async () => {
    // Arrange
    const current: { overrides: TaskOverrides } = { overrides: {} };
    server.use(
      graphql.mutation('RequestStoryPointEstimate', () =>
        HttpResponse.json({
          data: {
            requestStoryPointEstimate: estimateNode({
              metadata: { storyPoints: 8 },
            }),
          },
        }),
      ),
      graphql.mutation('ApproveRecommendation', () => {
        current.overrides = { storyPoints: 8 };
        return HttpResponse.json({
          data: {
            approveRecommendation: decided(
              estimateNode({ metadata: { storyPoints: 8 } }),
              'APPROVED',
            ),
          },
        });
      }),
      appliedTask(8).handler,
      ...detailScenario({ project: 'ADMIN' }, {}, undefined, current),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });
    expect(await screen.findByLabelText('Story points')).toHaveValue(5);

    // Act
    await user.click(
      screen.getByRole('button', { name: 'Estimate story points' }),
    );
    await user.click(
      within(await card('Story point estimate')).getByRole('button', {
        name: 'Approve',
      }),
    );
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Approve',
      }),
    );

    // Assert
    await waitFor(() =>
      expect(screen.getByLabelText('Story points')).toHaveValue(8),
    );
    const decidedCard = within(await card('Story point estimate'));
    expect(decidedCard.getByText('Decision').parentElement).toHaveTextContent(
      'DecisionApproved',
    );
  });

  it('shows who an assignment chooses among, only when asked', async () => {
    // Arrange
    let reads = 0;
    server.use(
      graphql.query('AssignmentContext', () => {
        reads += 1;
        return HttpResponse.json({
          data: contextData([
            candidate(TERRY, {
              skills: ['TypeScript', 'React'],
              expertise: ['auth'],
              availability: 'BUSY',
              workload: 7,
              activeTaskCount: 4,
              completedTasks: 12,
            }),
            candidate(PAT, { skills: [], availability: null }),
          ]),
        });
      }),
      ...detailScenario({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });
    const toggle = await screen.findByRole('button', {
      name: 'Show who the AI chooses among',
    });

    // Assert — a second request, not made for a visit that does not need it.
    expect(reads).toBe(0);

    // Act
    await user.click(toggle);

    // Assert
    const table = await screen.findByRole('table', {
      name: 'Who an assignment suggestion chooses among',
    });
    const [, terry, pat] = within(table).getAllByRole('row');
    const cells = (row: HTMLElement | undefined) =>
      within(row as HTMLElement)
        .getAllByRole('cell')
        .map((cell) => cell.textContent);
    expect(
      within(terry as HTMLElement).getByRole('link', {
        name: 'Terry Teammate',
      }),
    ).toBeVisible();
    expect(cells(terry).slice(1)).toEqual([
      'TypeScript, React',
      'auth',
      'Busy',
      '7',
      '4',
      '12',
    ]);
    // Nothing listed is said to be so, never left blank.
    expect(cells(pat).slice(1, 4)).toEqual([
      'None listed',
      'None listed',
      'Not set',
    ]);
    expect(reads).toBe(1);
  });

  it('says why there is nobody to suggest when no one is on a team', async () => {
    // Arrange
    server.use(
      graphql.query('AssignmentContext', () =>
        HttpResponse.json({ data: contextData([]) }),
      ),
      ...detailScenario({ project: 'MEMBER' }),
    );
    const { user } = renderRoutes(routes, { route: TASK_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', {
        name: 'Show who the AI chooses among',
      }),
    );

    // Assert
    expect(
      await screen.findByText(
        'No one is on a team in this project, so there is nobody for the AI to suggest. Add people to a team first.',
      ),
    ).toBeVisible();
  });
});

describe('asking for an insight about a sprint', () => {
  it('shows the insight as information, with its risks and nothing to override', async () => {
    // Arrange
    let sent: unknown;
    server.use(
      graphql.mutation('RequestSprintHealthAnalysis', ({ variables }) => {
        sent = variables;
        return HttpResponse.json({
          data: { requestSprintHealthAnalysis: healthNode() },
        });
      }),
      ...sprintDetailScenario({ project: 'ADMIN' }),
    );
    const { user } = renderRoutes(routes, { route: SPRINT_ROUTE });

    // Act
    await user.click(
      await screen.findByRole('button', { name: 'Analyse sprint health' }),
    );

    // Assert
    const insight = within(await card('Sprint health'));
    expect(insight.getByText('For information only')).toBeVisible();
    expect(
      insight.getByText('Committed story points exceed sprint capacity.'),
    ).toBeVisible();
    expect(
      insight.queryAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Approve', 'Reject']);
    expect(
      screen.getByRole('button', { name: 'Forecast progress' }),
    ).toBeVisible();
    expect(sent).toEqual({ sprintId: SPRINT_ID });
  });
});
