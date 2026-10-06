import { HttpResponse } from 'msw';
import type { TaskStatus } from '@contracts';
import { discussionScenario } from '@/modules/comment/comment.fixtures';
import {
  PAT,
  PROJECT_ID,
  TERRY,
  VIEWER,
  projectScenario,
} from '@/modules/project/project.fixtures';
import type { Person, Scenario } from '@/modules/project/project.fixtures';
import { graphql } from '@/shared/tests/graphql';

/**
 * Test fixtures for the task screens: a handful of tasks spread over the
 * board, one sprint, one epic, and handlers for each query the screens make.
 */

export const TASK_ID = '66666666-6666-4666-8666-666666666666';
export const OTHER_TASK_ID = '77777777-7777-4777-8777-777777777777';
export const SPRINT_ID = '88888888-8888-4888-8888-888888888888';
export const EPIC_ID = '99999999-9999-4999-8999-999999999999';

export function person(source: Person) {
  return {
    __typename: 'User',
    id: source.id,
    name: source.name,
    avatarUrl: null,
  };
}

export type TaskOverrides = Partial<{
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: TaskStatus;
  storyPoints: number | null;
  assignee: Person | null;
  reporter: Person | null;
  sprintId: string | null;
  epicId: string | null;
  dueDate: string | null;
  loggedSeconds: number;
  labels: Array<{ id: string; name: string }>;
  watchers: Person[];
  dependencies: Array<{ id: string; title: string; status: TaskStatus }>;
}>;

/** A task with every field any task fragment selects. */
export function taskNode(overrides: TaskOverrides = {}) {
  const assignee =
    overrides.assignee === undefined ? TERRY : overrides.assignee;
  const reporter = overrides.reporter === undefined ? PAT : overrides.reporter;

  return {
    __typename: 'Task',
    id: overrides.id ?? TASK_ID,
    title: overrides.title ?? 'Build login',
    description:
      overrides.description === undefined
        ? 'Email and password.'
        : overrides.description,
    priority: overrides.priority ?? 'HIGH',
    status: overrides.status ?? 'TODO',
    storyPoints:
      overrides.storyPoints === undefined ? 5 : overrides.storyPoints,
    projectId: PROJECT_ID,
    assigneeId: assignee?.id ?? null,
    reporterId: reporter?.id ?? null,
    sprintId: overrides.sprintId === undefined ? SPRINT_ID : overrides.sprintId,
    epicId: overrides.epicId === undefined ? EPIC_ID : overrides.epicId,
    dueDate:
      overrides.dueDate === undefined
        ? '2099-03-15T00:00:00.000Z'
        : overrides.dueDate,
    createdAt: '2026-09-05T10:00:00.000Z',
    updatedAt: '2026-09-06T10:00:00.000Z',
    loggedSeconds: overrides.loggedSeconds ?? 12_000,
    assignee: assignee ? person(assignee) : null,
    reporter: reporter ? person(reporter) : null,
    labels: (overrides.labels ?? [{ id: 'label-auth', name: 'auth' }]).map(
      (label) => ({ __typename: 'Label', ...label }),
    ),
    watchers: (overrides.watchers ?? []).map(person),
    dependencies: (overrides.dependencies ?? []).map((dependency) => ({
      __typename: 'Task',
      ...dependency,
    })),
  };
}

type TaskNode = ReturnType<typeof taskNode>;

export function taskConnection<Node extends { id: string }>(
  nodes: Node[],
  page: {
    hasNextPage?: boolean;
    endCursor?: string | null;
    total?: number;
  } = {},
) {
  return {
    __typename: 'TaskConnection',
    edges: nodes.map((node) => ({
      __typename: 'TaskEdge',
      cursor: `cursor-${node.id}`,
      node,
    })),
    pageInfo: {
      __typename: 'PageInfo',
      hasNextPage: page.hasNextPage ?? false,
      endCursor: page.endCursor ?? null,
    },
    totalCount: page.total ?? nodes.length,
  };
}

export const SECOND_TASK = {
  id: OTHER_TASK_ID,
  title: 'Design schema',
  status: 'IN_PROGRESS' as const,
};

/** The default set: one task to do, one in progress. */
export function defaultTasks(): TaskNode[] {
  return [
    taskNode(),
    taskNode({
      ...SECOND_TASK,
      priority: 'LOW',
      assignee: null,
      sprintId: null,
      epicId: null,
      dueDate: null,
      storyPoints: null,
      labels: [],
    }),
  ];
}

export function boardData(tasks: TaskNode[] = defaultTasks()) {
  const column = (status: TaskStatus) =>
    taskConnection(tasks.filter((task) => task.status === status));

  return {
    project: {
      __typename: 'Project',
      id: PROJECT_ID,
      backlog: column('BACKLOG'),
      todo: column('TODO'),
      inProgress: column('IN_PROGRESS'),
      inReview: column('IN_REVIEW'),
      testing: column('TESTING'),
      done: column('DONE'),
      blocked: column('BLOCKED'),
    },
  };
}

function sprintConnection() {
  return {
    __typename: 'SprintConnection',
    edges: [
      {
        __typename: 'SprintEdge',
        cursor: 'cursor-sprint',
        node: {
          __typename: 'Sprint',
          id: SPRINT_ID,
          name: 'Sprint 1',
          state: 'ACTIVE',
        },
      },
    ],
    pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
    totalCount: 1,
  };
}

function epicConnection() {
  return {
    __typename: 'EpicConnection',
    edges: [
      {
        __typename: 'EpicEdge',
        cursor: 'cursor-epic',
        node: { __typename: 'Epic', id: EPIC_ID, name: 'Onboarding' },
      },
    ],
    pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
    totalCount: 1,
  };
}

/** The project frame plus the sprint and epic names every task screen reads. */
export function taskFrame(scenario: Scenario = {}) {
  return [
    ...projectScenario(scenario),
    graphql.query('ProjectPlanning', () =>
      HttpResponse.json({
        data: {
          project: {
            __typename: 'Project',
            id: PROJECT_ID,
            sprints: sprintConnection(),
            epics: epicConnection(),
          },
        },
      }),
    ),
  ];
}

export function boardScenario(scenario: Scenario = {}, tasks?: TaskNode[]) {
  return [
    ...taskFrame(scenario),
    graphql.query('ProjectBoard', () =>
      HttpResponse.json({ data: boardData(tasks) }),
    ),
  ];
}

export function listData(tasks: Array<{ id: string }> = defaultTasks()) {
  return {
    project: {
      __typename: 'Project',
      id: PROJECT_ID,
      tasks: taskConnection(tasks),
    },
  };
}

export function listScenario(scenario: Scenario = {}, tasks?: TaskNode[]) {
  return [
    ...taskFrame(scenario),
    graphql.query('ProjectTasks', () =>
      HttpResponse.json({ data: listData(tasks) }),
    ),
  ];
}

export function activity(
  id: string,
  type: string,
  metadata: Record<string, unknown>,
  actor: Person | null = PAT,
) {
  return {
    __typename: 'ActivityLog',
    id,
    type,
    metadata,
    createdAt: '2026-09-06T10:00:00.000Z',
    actor: actor
      ? { __typename: 'User', id: actor.id, name: actor.name }
      : null,
  };
}

export function detailData(
  overrides: TaskOverrides = {},
  activities: Array<ReturnType<typeof activity>> = [
    activity('a-created', 'TASK_CREATED', { title: 'Build login' }),
  ],
) {
  return {
    task: {
      ...taskNode(overrides),
      activities: {
        __typename: 'ActivityLogConnection',
        edges: activities.map((node) => ({
          __typename: 'ActivityLogEdge',
          cursor: `cursor-${node.id}`,
          node,
        })),
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
        totalCount: activities.length,
      },
    },
  };
}

/**
 * `current` is read on every request, so a test can change it from a mutation
 * handler and the page's next read of the task sees the change, as it would
 * against a real server.
 */
export function detailScenario(
  scenario: Scenario = {},
  overrides: TaskOverrides = {},
  activities?: Array<ReturnType<typeof activity>>,
  current: { overrides: TaskOverrides } = { overrides },
) {
  return [
    ...taskFrame(scenario),
    graphql.query('Task', () =>
      HttpResponse.json({ data: detailData(current.overrides, activities) }),
    ),
    graphql.query('ProjectTaskOptions', () =>
      HttpResponse.json({
        data: {
          project: {
            __typename: 'Project',
            id: PROJECT_ID,
            tasks: taskConnection([
              {
                __typename: 'Task',
                id: TASK_ID,
                title: 'Build login',
                status: 'TODO',
              },
              { __typename: 'Task', ...SECOND_TASK },
            ]),
          },
        },
      }),
    ),
    // The page also loads the task's discussion: empty here. A test about
    // comments or attachments puts its own handlers ahead of this scenario.
    ...discussionScenario(TASK_ID),
  ];
}

export { PAT, PROJECT_ID, TERRY, VIEWER };
