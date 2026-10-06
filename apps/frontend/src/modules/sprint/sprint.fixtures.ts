import { HttpResponse } from 'msw';
import type { SprintState, TaskStatus } from '@contracts';
import {
  PAT,
  PROJECT_ID,
  TERRY,
  projectScenario,
} from '@/modules/project/project.fixtures';
import type { Person, Scenario } from '@/modules/project/project.fixtures';
import { graphql } from '@/shared/tests/graphql';

/**
 * Test fixtures for the sprint screens: one sprint with two tasks, its
 * figures and its burndown, and handlers for each query the screens make.
 */

export const SPRINT_ID = '88888888-8888-4888-8888-888888888888';
export const OTHER_SPRINT_ID = '8a8a8a8a-8a8a-48a8-88a8-8a8a8a8a8a8a';
export const TASK_ID = '66666666-6666-4666-8666-666666666666';
export const OTHER_TASK_ID = '77777777-7777-4777-8777-777777777777';
export const LOOSE_TASK_ID = '6a6a6a6a-6a6a-46a6-86a6-6a6a6a6a6a6a';

function person(source: Person) {
  return {
    __typename: 'User',
    id: source.id,
    name: source.name,
    avatarUrl: null,
  };
}

export type SprintOverrides = Partial<{
  id: string;
  name: string;
  goal: string | null;
  state: SprintState;
  startDate: string | null;
  endDate: string | null;
  capacity: number | null;
  taskCount: number;
}>;

export function sprintSummary(overrides: SprintOverrides = {}) {
  return {
    __typename: 'Sprint',
    id: overrides.id ?? SPRINT_ID,
    name: overrides.name ?? 'Sprint 1',
    goal: overrides.goal === undefined ? 'Ship sign-in.' : overrides.goal,
    state: overrides.state ?? 'ACTIVE',
    startDate:
      overrides.startDate === undefined
        ? '2026-03-01T00:00:00.000Z'
        : overrides.startDate,
    endDate:
      overrides.endDate === undefined
        ? '2026-03-14T00:00:00.000Z'
        : overrides.endDate,
    capacity: overrides.capacity === undefined ? 20 : overrides.capacity,
    projectId: PROJECT_ID,
    taskCount: overrides.taskCount ?? 2,
  };
}

type SprintTask = {
  id: string;
  title: string;
  status: TaskStatus;
  storyPoints: number | null;
  assignee: Person | null;
};

export const SPRINT_TASKS: SprintTask[] = [
  {
    id: TASK_ID,
    title: 'Build login',
    status: 'DONE',
    storyPoints: 5,
    assignee: TERRY,
  },
  {
    id: OTHER_TASK_ID,
    title: 'Design schema',
    status: 'IN_PROGRESS',
    storyPoints: 8,
    assignee: PAT,
  },
];

function sprintTask(task: SprintTask, sprintId: string) {
  return {
    __typename: 'Task',
    id: task.id,
    title: task.title,
    status: task.status,
    priority: 'MEDIUM',
    storyPoints: task.storyPoints,
    sprintId,
    assignee: task.assignee ? person(task.assignee) : null,
  };
}

export type SprintDetailOverrides = SprintOverrides & {
  tasks?: SprintTask[];
  overCapacity?: boolean;
  burndown?: Array<{
    date: string;
    idealRemaining: number;
    actualRemaining: number;
  }>;
  tasksPage?: { hasNextPage: boolean; endCursor: string | null; total: number };
};

const DEFAULT_BURNDOWN = [
  { date: '2026-03-01T00:00:00.000Z', idealRemaining: 13, actualRemaining: 13 },
  {
    date: '2026-03-02T00:00:00.000Z',
    idealRemaining: 12.04,
    actualRemaining: 8,
  },
];

/** A sprint with every field the detail query selects. */
export function sprintDetail(overrides: SprintDetailOverrides = {}) {
  const tasks = overrides.tasks ?? SPRINT_TASKS;
  const summary = sprintSummary({ taskCount: tasks.length, ...overrides });
  const total = tasks.reduce((sum, task) => sum + (task.storyPoints ?? 0), 0);
  const done = tasks.filter((task) => task.status === 'DONE');
  const completed = done.reduce(
    (sum, task) => sum + (task.storyPoints ?? 0),
    0,
  );
  const assignees = [...new Set(tasks.map((task) => task.assignee))];

  return {
    ...summary,
    metrics: {
      __typename: 'SprintMetrics',
      totalStoryPoints: total,
      completedStoryPoints: completed,
      remainingStoryPoints: total - completed,
      totalTasks: tasks.length,
      completedTasks: done.length,
      completionRate: tasks.length === 0 ? 0 : done.length / tasks.length,
      velocity: completed,
      capacity: summary.capacity,
      overCapacity: overrides.overCapacity ?? false,
      workloadDistribution: assignees.map((assignee) => {
        const own = tasks.filter((task) => task.assignee === assignee);
        return {
          __typename: 'SprintWorkload',
          assigneeId: assignee?.id ?? null,
          storyPoints: own.reduce(
            (sum, task) => sum + (task.storyPoints ?? 0),
            0,
          ),
          taskCount: own.length,
          user: assignee ? person(assignee) : null,
        };
      }),
    },
    burndown: (
      overrides.burndown ??
      (summary.startDate && summary.endDate ? DEFAULT_BURNDOWN : [])
    ).map((point) => ({ __typename: 'BurndownPoint', ...point })),
    tasks: {
      __typename: 'TaskConnection',
      edges: tasks.map((task) => ({
        __typename: 'TaskEdge',
        cursor: `cursor-${task.id}`,
        node: sprintTask(task, summary.id),
      })),
      pageInfo: {
        __typename: 'PageInfo',
        hasNextPage: overrides.tasksPage?.hasNextPage ?? false,
        endCursor: overrides.tasksPage?.endCursor ?? null,
      },
      totalCount: overrides.tasksPage?.total ?? tasks.length,
    },
  };
}

export function sprintsData(
  sprints: Array<ReturnType<typeof sprintSummary>> = [sprintSummary()],
  page: {
    hasNextPage?: boolean;
    endCursor?: string | null;
    total?: number;
  } = {},
) {
  return {
    project: {
      __typename: 'Project',
      id: PROJECT_ID,
      sprints: {
        __typename: 'SprintConnection',
        edges: sprints.map((sprint) => ({
          __typename: 'SprintEdge',
          cursor: `cursor-${sprint.id}`,
          node: sprint,
        })),
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: page.hasNextPage ?? false,
          endCursor: page.endCursor ?? null,
        },
        totalCount: page.total ?? sprints.length,
      },
    },
  };
}

/** The project's recent tasks: the two in the sprint and one in none. */
export function candidatesData() {
  const node = (id: string, title: string, sprintId: string | null) => ({
    __typename: 'Task',
    id,
    title,
    status: 'TODO',
    sprintId,
  });
  const nodes = [
    node(TASK_ID, 'Build login', SPRINT_ID),
    node(OTHER_TASK_ID, 'Design schema', SPRINT_ID),
    node(LOOSE_TASK_ID, 'Write docs', null),
  ];

  return {
    project: {
      __typename: 'Project',
      id: PROJECT_ID,
      tasks: {
        __typename: 'TaskConnection',
        edges: nodes.map((task) => ({
          __typename: 'TaskEdge',
          cursor: `cursor-${task.id}`,
          node: task,
        })),
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
        totalCount: nodes.length,
      },
    },
  };
}

export function sprintListScenario(
  scenario: Scenario = {},
  sprints?: Array<ReturnType<typeof sprintSummary>>,
) {
  return [
    ...projectScenario(scenario),
    graphql.query('ProjectSprints', () =>
      HttpResponse.json({ data: sprintsData(sprints) }),
    ),
  ];
}

export function sprintDetailScenario(
  scenario: Scenario = {},
  overrides: SprintDetailOverrides = {},
) {
  return [
    ...projectScenario(scenario),
    graphql.query('Sprint', () =>
      HttpResponse.json({ data: { sprint: sprintDetail(overrides) } }),
    ),
    graphql.query('SprintTaskCandidates', () =>
      HttpResponse.json({ data: candidatesData() }),
    ),
  ];
}
