import { graphql } from '@/shared/graphql/generated';

/**
 * AI recommendation operations.
 *
 * The contract the whole module serves: the AI suggests, a person decides. A
 * request stores a suggestion and changes nothing else. Only a decision —
 * approve, or override with a value of one's own — touches a task, and only
 * for an estimate or an assignment; a sprint insight is informational.
 */

export const AiRecommendationItemFragment = graphql(`
  fragment AiRecommendationItem on AiRecommendation {
    id
    type
    text
    confidenceScore
    provider
    approvalStatus
    resolutionStatus
    metadata
    projectId
    taskId
    sprintId
    createdAt
    updatedAt
    requestedBy {
      id
      name
    }
    approvedBy {
      id
      name
    }
  }
`);

/** Newest first. Each combination of the two filters is its own cached list. */
export const ProjectAiRecommendationsQuery = graphql(`
  query ProjectAiRecommendations(
    $projectId: UUID!
    $first: Int
    $after: String
    $type: AiRecommendationType
    $approvalStatus: AiApprovalStatus
  ) {
    project(id: $projectId) {
      id
      aiRecommendations(
        first: $first
        after: $after
        type: $type
        approvalStatus: $approvalStatus
      ) {
        edges {
          cursor
          node {
            ...AiRecommendationItem
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
    }
  }
`);

/** One recommendation as it stands now: read when a decision was a step late. */
export const AiRecommendationQuery = graphql(`
  query AiRecommendation($id: UUID!) {
    aiRecommendation(id: $id) {
      ...AiRecommendationItem
    }
  }
`);

/** The people an assignment suggestion chooses among, and what it weighs. */
export const AssignmentContextQuery = graphql(`
  query AssignmentContext($taskId: UUID!) {
    assignmentContext(taskId: $taskId) {
      taskId
      candidates {
        skills
        expertise
        workload
        availability
        activeTaskCount
        completedTasks
        user {
          id
          name
          avatarUrl
        }
      }
    }
  }
`);

/*
 * What an approved estimate or assignment changes on its task. The decision
 * mutations return the recommendation, not the task, and no event announces
 * the change — so the task's two fields are read again and every screen
 * showing it follows.
 */
export const AiAppliedTaskQuery = graphql(`
  query AiAppliedTask($id: UUID!) {
    task(id: $id) {
      id
      storyPoints
      assigneeId
      assignee {
        id
        name
        avatarUrl
      }
    }
  }
`);

export const RequestStoryPointEstimateMutation = graphql(`
  mutation RequestStoryPointEstimate($taskId: UUID!) {
    requestStoryPointEstimate(taskId: $taskId) {
      ...AiRecommendationItem
    }
  }
`);

export const RequestAssignmentRecommendationMutation = graphql(`
  mutation RequestAssignmentRecommendation($taskId: UUID!) {
    requestAssignmentRecommendation(taskId: $taskId) {
      ...AiRecommendationItem
    }
  }
`);

export const RequestSprintHealthAnalysisMutation = graphql(`
  mutation RequestSprintHealthAnalysis($sprintId: UUID!) {
    requestSprintHealthAnalysis(sprintId: $sprintId) {
      ...AiRecommendationItem
    }
  }
`);

export const RequestProgressTrackingMutation = graphql(`
  mutation RequestProgressTracking($sprintId: UUID!) {
    requestProgressTracking(sprintId: $sprintId) {
      ...AiRecommendationItem
    }
  }
`);

export const ApproveRecommendationMutation = graphql(`
  mutation ApproveRecommendation($id: UUID!) {
    approveRecommendation(id: $id) {
      ...AiRecommendationItem
    }
  }
`);

export const RejectRecommendationMutation = graphql(`
  mutation RejectRecommendation($id: UUID!) {
    rejectRecommendation(id: $id) {
      ...AiRecommendationItem
    }
  }
`);

export const OverrideRecommendationMutation = graphql(`
  mutation OverrideRecommendation(
    $id: UUID!
    $input: OverrideRecommendationInput!
  ) {
    overrideRecommendation(id: $id, input: $input) {
      ...AiRecommendationItem
    }
  }
`);

export const AiRecommendationUpdatedSubscription = graphql(`
  subscription AiRecommendationUpdated($projectId: UUID!) {
    aiRecommendationUpdated(projectId: $projectId) {
      recommendationId
      projectId
      approvalStatus
      recommendation {
        ...AiRecommendationItem
      }
    }
  }
`);
