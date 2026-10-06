import { HttpResponse } from 'msw';
import {
  PAT,
  PROJECT_ID,
  TERRY,
  projectScenario,
} from '@/modules/project/project.fixtures';
import type { Person, Scenario } from '@/modules/project/project.fixtures';
import { graphql } from '@/shared/tests/graphql';
import { TEST_USER } from '@/shared/tests/session';

/**
 * Test fixtures for the analytics screens: a project's figures, one person's
 * live figures and the copy saved on their profile.
 */

function workload(
  person: Person,
  figures: {
    activeTasks: number;
    activeStoryPoints: number;
    completedTasks: number;
  },
) {
  return {
    __typename: 'IndividualWorkload',
    assigneeId: person.id,
    ...figures,
    user: {
      __typename: 'User',
      id: person.id,
      name: person.name,
      avatarUrl: null,
    },
  };
}

export function projectAnalytics(overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'ProjectAnalytics',
    projectId: PROJECT_ID,
    totalTasks: 10,
    completedTasks: 4,
    totalStoryPoints: 40,
    completedStoryPoints: 16,
    completionRate: 0.4,
    teamVelocity: 12.5,
    // Only the statuses and priorities that hold a task, as the API sends.
    taskDistributionByStatus: [
      { __typename: 'StatusCount', status: 'TODO', count: 3 },
      { __typename: 'StatusCount', status: 'IN_PROGRESS', count: 3 },
      { __typename: 'StatusCount', status: 'DONE', count: 4 },
    ],
    taskDistributionByPriority: [
      { __typename: 'PriorityCount', priority: 'MEDIUM', count: 6 },
      { __typename: 'PriorityCount', priority: 'CRITICAL', count: 4 },
    ],
    storyPointTrends: [
      {
        __typename: 'SprintTrendPoint',
        sprintId: 'sprint-1',
        name: 'Sprint 1',
        committedStoryPoints: 20,
        completedStoryPoints: 16,
      },
      {
        __typename: 'SprintTrendPoint',
        sprintId: 'sprint-2',
        name: 'Sprint 2',
        committedStoryPoints: 20,
        completedStoryPoints: 9,
      },
    ],
    individualWorkloads: [
      workload(TERRY, {
        activeTasks: 4,
        activeStoryPoints: 18,
        completedTasks: 3,
      }),
      workload(PAT, {
        activeTasks: 2,
        activeStoryPoints: 6,
        completedTasks: 1,
      }),
    ],
    ...overrides,
  };
}

/** What the API returns for a project with nothing in it. */
export function emptyProjectAnalytics() {
  return projectAnalytics({
    totalTasks: 0,
    completedTasks: 0,
    totalStoryPoints: 0,
    completedStoryPoints: 0,
    completionRate: 0,
    teamVelocity: 0,
    taskDistributionByStatus: [],
    taskDistributionByPriority: [],
    storyPointTrends: [],
    individualWorkloads: [],
  });
}

export function projectAnalyticsScenario(
  scenario: Scenario = {},
  analytics: ReturnType<typeof projectAnalytics> = projectAnalytics(),
) {
  return [
    graphql.query('ProjectAnalytics', () =>
      HttpResponse.json({ data: { projectAnalytics: analytics } }),
    ),
    ...projectScenario(scenario),
  ];
}

export function userAnalytics(
  userId: string = TEST_USER.id,
  overrides: Record<string, unknown> = {},
) {
  return {
    __typename: 'UserAnalytics',
    userId,
    completedTasks: 12,
    historicalStoryPoints: 48,
    // 2 days and 3 hours.
    avgCompletionSeconds: 183_600,
    velocity: 9.6,
    activeAssignments: 3,
    ...overrides,
  };
}

export function savedStatistics(overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'UserStatistics',
    completedTasks: 10,
    historicalStoryPoints: 40,
    avgCompletionSeconds: 172_800,
    velocity: 8,
    ...overrides,
  };
}

/** What the API returns for someone who has never saved their figures. */
export function noSavedStatistics() {
  return savedStatistics({
    completedTasks: 0,
    historicalStoryPoints: 0,
    avgCompletionSeconds: null,
    velocity: null,
  });
}

/**
 * Handlers for the analytics card on the signed-in user's own profile: the
 * live figures and the saved copy. Any test that opens that profile needs
 * them, whatever it is about.
 */
export function myAnalyticsScenario(
  live: ReturnType<typeof userAnalytics> = userAnalytics(),
  saved: ReturnType<typeof savedStatistics> = savedStatistics(),
) {
  return [
    graphql.query('UserAnalytics', () =>
      HttpResponse.json({ data: { userAnalytics: live } }),
    ),
    graphql.query('MyStatistics', () =>
      HttpResponse.json({
        data: {
          me: { __typename: 'User', id: TEST_USER.id, statistics: saved },
        },
      }),
    ),
  ];
}
