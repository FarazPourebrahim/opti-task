import { HttpResponse } from 'msw';
import {
  PAT,
  PROJECT_ID,
  TERRY,
  projectScenario,
} from '@/modules/project/project.fixtures';
import type { Person, Scenario } from '@/modules/project/project.fixtures';
import { graphql } from '@/shared/tests/graphql';

/**
 * Test fixtures for AI recommendations: one of each kind, shaped as the
 * backend's `ai.service.ts` stores them, and a queue handler that answers
 * from a list a test can change as decisions are made.
 */

export const TASK_ID = '66666666-6666-4666-8666-666666666666';
export const SPRINT_ID = '88888888-8888-4888-8888-888888888888';
export const ESTIMATE_ID = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
export const ASSIGNMENT_ID = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2';
export const HEALTH_ID = 'a3a3a3a3-a3a3-4a3a-8a3a-a3a3a3a3a3a3';

export type RecommendationOverrides = Partial<{
  type: string;
  text: string;
  confidenceScore: number | null;
  provider: string | null;
  approvalStatus: string;
  resolutionStatus: string;
  metadata: Record<string, unknown>;
  taskId: string | null;
  sprintId: string | null;
  requestedBy: Person | null;
  approvedBy: Person | null;
}>;

function userRef(person: Person | null) {
  return person
    ? { __typename: 'User', id: person.id, name: person.name }
    : null;
}

/** A recommendation with every field the fragment selects. */
export function recommendationNode(
  id: string,
  overrides: RecommendationOverrides = {},
) {
  return {
    __typename: 'AiRecommendation',
    id,
    type: overrides.type ?? 'STORY_POINT_ESTIMATION',
    text:
      overrides.text ??
      'Estimated 5 points from 12 words of scope and 3 similar tasks.',
    confidenceScore:
      overrides.confidenceScore === undefined ? 0.8 : overrides.confidenceScore,
    provider: overrides.provider === undefined ? 'stub' : overrides.provider,
    approvalStatus: overrides.approvalStatus ?? 'PENDING',
    resolutionStatus: overrides.resolutionStatus ?? 'OPEN',
    metadata: overrides.metadata ?? { storyPoints: 5 },
    projectId: PROJECT_ID,
    taskId: overrides.taskId === undefined ? TASK_ID : overrides.taskId,
    sprintId: overrides.sprintId ?? null,
    createdAt: '2026-09-09T10:00:00.000Z',
    updatedAt: '2026-09-09T10:00:00.000Z',
    requestedBy: userRef(
      overrides.requestedBy === undefined ? PAT : overrides.requestedBy,
    ),
    approvedBy: userRef(overrides.approvedBy ?? null),
  };
}

export type RecommendationNode = ReturnType<typeof recommendationNode>;

export function estimateNode(overrides: RecommendationOverrides = {}) {
  return recommendationNode(ESTIMATE_ID, overrides);
}

export function assignmentNode(overrides: RecommendationOverrides = {}) {
  return recommendationNode(ASSIGNMENT_ID, {
    type: 'TASK_ASSIGNMENT',
    text: 'Recommended the candidate with the lightest current workload among 2.',
    confidenceScore: 0.7,
    metadata: {
      suggestedAssigneeId: TERRY.id,
      ranking: [{ userId: TERRY.id, score: 990 }],
    },
    ...overrides,
  });
}

export function healthNode(overrides: RecommendationOverrides = {}) {
  return recommendationNode(HEALTH_ID, {
    type: 'SPRINT_HEALTH',
    text: 'Sprint “Sprint 1”: 5/13 points done, 8 remaining.',
    confidenceScore: 0.65,
    metadata: { risks: ['Committed story points exceed sprint capacity.'] },
    taskId: null,
    sprintId: SPRINT_ID,
    ...overrides,
  });
}

/** The recommendation as a decision leaves it. */
export function decided(
  node: RecommendationNode,
  approvalStatus: 'APPROVED' | 'REJECTED' | 'OVERRIDDEN',
  by: Person = PAT,
): RecommendationNode {
  return {
    ...node,
    approvalStatus,
    resolutionStatus: approvalStatus === 'REJECTED' ? 'DISMISSED' : 'RESOLVED',
    approvedBy: userRef(by),
  };
}

export function recommendationsData(
  nodes: RecommendationNode[],
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
      aiRecommendations: {
        __typename: 'AiRecommendationConnection',
        edges: nodes.map((node) => ({
          __typename: 'AiRecommendationEdge',
          cursor: `cursor-${node.id}`,
          node,
        })),
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: page.hasNextPage ?? false,
          endCursor: page.endCursor ?? null,
        },
        totalCount: page.total ?? nodes.length,
      },
    },
  };
}

/**
 * The project frame and its queue. `queue.recommendations` is read on every
 * request and filtered as the server filters, so a mutation handler can change
 * it and the next read sees the change. `requests` records each read.
 */
export function queueScenario(
  scenario: Scenario = {},
  recommendations: RecommendationNode[] = [],
) {
  const queue = { recommendations };
  const requests: Array<Record<string, unknown>> = [];

  const handlers = [
    graphql.query('ProjectAiRecommendations', ({ variables }) => {
      requests.push(variables);
      return HttpResponse.json({
        data: recommendationsData(
          queue.recommendations.filter(
            (node) =>
              (!variables['type'] || node.type === variables['type']) &&
              (!variables['approvalStatus'] ||
                node.approvalStatus === variables['approvalStatus']),
          ),
        ),
      });
    }),
    ...projectScenario(scenario),
  ];

  return { queue, requests, handlers };
}

export function candidate(
  person: Person,
  overrides: Partial<{
    skills: string[];
    expertise: string[];
    workload: number;
    availability: string | null;
    activeTaskCount: number;
    completedTasks: number;
  }> = {},
) {
  return {
    __typename: 'AssignmentCandidate',
    skills: overrides.skills ?? ['TypeScript'],
    expertise: overrides.expertise ?? [],
    workload: overrides.workload ?? 3,
    availability:
      overrides.availability === undefined
        ? 'AVAILABLE'
        : overrides.availability,
    activeTaskCount: overrides.activeTaskCount ?? 2,
    completedTasks: overrides.completedTasks ?? 9,
    user: {
      __typename: 'User',
      id: person.id,
      name: person.name,
      avatarUrl: null,
    },
  };
}

export function contextData(candidates: Array<ReturnType<typeof candidate>>) {
  return {
    assignmentContext: {
      __typename: 'AssignmentContext',
      taskId: TASK_ID,
      candidates,
    },
  };
}

export { PAT, PROJECT_ID, TERRY };
