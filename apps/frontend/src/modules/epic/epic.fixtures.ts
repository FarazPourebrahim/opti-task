import { HttpResponse } from 'msw';
import type { TaskStatus } from '@contracts';
import {
  PROJECT_ID,
  projectScenario,
} from '@/modules/project/project.fixtures';
import type { Scenario } from '@/modules/project/project.fixtures';
import { graphql } from '@/shared/tests/graphql';

/**
 * Test fixtures for the epic screens: one epic with two tasks and a
 * milestone, and handlers for each query the screens make.
 */

export const EPIC_ID = '99999999-9999-4999-8999-999999999999';
export const OTHER_EPIC_ID = '9a9a9a9a-9a9a-49a9-89a9-9a9a9a9a9a9a';
export const TASK_ID = '66666666-6666-4666-8666-666666666666';
export const OTHER_TASK_ID = '77777777-7777-4777-8777-777777777777';
export const MILESTONE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

export type EpicOverrides = Partial<{
  id: string;
  name: string;
  description: string | null;
  progress: number;
  completedTasks: number;
  totalTasks: number;
}>;

export function epicSummary(overrides: EpicOverrides = {}) {
  return {
    __typename: 'Epic',
    id: overrides.id ?? EPIC_ID,
    name: overrides.name ?? 'Onboarding',
    description:
      overrides.description === undefined
        ? 'Everything a new user meets.'
        : overrides.description,
    projectId: PROJECT_ID,
    progress: overrides.progress ?? 50,
    completedTasks: overrides.completedTasks ?? 1,
    totalTasks: overrides.totalTasks ?? 2,
  };
}

type EpicTask = {
  id: string;
  title: string;
  status: TaskStatus;
  storyPoints: number | null;
};

export const EPIC_TASKS: EpicTask[] = [
  { id: TASK_ID, title: 'Build login', status: 'DONE', storyPoints: 5 },
  {
    id: OTHER_TASK_ID,
    title: 'Design schema',
    status: 'IN_PROGRESS',
    storyPoints: null,
  },
];

export type Milestone = {
  id: string;
  name: string;
  description: string | null;
  dueDate: string | null;
};

export const MILESTONE: Milestone = {
  id: MILESTONE_ID,
  name: 'Beta',
  description: 'First outside users.',
  dueDate: '2026-04-01T00:00:00.000Z',
};

export type EpicDetailOverrides = EpicOverrides & {
  tasks?: EpicTask[];
  milestones?: Milestone[];
};

/** An epic with every field the detail query selects. */
export function epicDetail(overrides: EpicDetailOverrides = {}) {
  const tasks = overrides.tasks ?? EPIC_TASKS;
  const milestones = overrides.milestones ?? [MILESTONE];
  const summary = epicSummary(overrides);

  return {
    ...summary,
    milestones: milestones.map((milestone) => ({
      __typename: 'Milestone',
      ...milestone,
      epicId: summary.id,
    })),
    tasks: {
      __typename: 'TaskConnection',
      edges: tasks.map((task) => ({
        __typename: 'TaskEdge',
        cursor: `cursor-${task.id}`,
        node: { __typename: 'Task', ...task },
      })),
      pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
      totalCount: tasks.length,
    },
  };
}

export function epicsData(
  epics: Array<ReturnType<typeof epicSummary>> = [epicSummary()],
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
      epics: {
        __typename: 'EpicConnection',
        edges: epics.map((epic) => ({
          __typename: 'EpicEdge',
          cursor: `cursor-${epic.id}`,
          node: epic,
        })),
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: page.hasNextPage ?? false,
          endCursor: page.endCursor ?? null,
        },
        totalCount: page.total ?? epics.length,
      },
    },
  };
}

export function epicListScenario(
  scenario: Scenario = {},
  epics?: Array<ReturnType<typeof epicSummary>>,
) {
  return [
    ...projectScenario(scenario),
    graphql.query('ProjectEpics', () =>
      HttpResponse.json({ data: epicsData(epics) }),
    ),
  ];
}

export function epicDetailScenario(
  scenario: Scenario = {},
  overrides: EpicDetailOverrides = {},
) {
  return [
    ...projectScenario(scenario),
    graphql.query('Epic', () =>
      HttpResponse.json({ data: { epic: epicDetail(overrides) } }),
    ),
  ];
}
