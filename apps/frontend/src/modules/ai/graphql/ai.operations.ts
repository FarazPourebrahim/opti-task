import { graphql } from '@/shared/graphql/generated';

/**
 * AI recommendation operations.
 *
 * Phase 11 defines only what the realtime layer needs: the shape of a
 * recommendation and the event that says one changed. The queue, the request
 * actions and the approval flow are Phase 12 and build on this fragment.
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
