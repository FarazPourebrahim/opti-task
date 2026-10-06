import { graphql } from '@/shared/graphql/generated';

/**
 * Analytics operations.
 *
 * Every figure here is worked out by the server on each read; nothing is
 * derived in the client. The one stored copy is `User.statistics`, which only
 * `recomputeUserStatistics` writes.
 */

export const ProjectAnalyticsQuery = graphql(`
  query ProjectAnalytics($projectId: UUID!) {
    projectAnalytics(projectId: $projectId) {
      projectId
      totalTasks
      completedTasks
      totalStoryPoints
      completedStoryPoints
      completionRate
      teamVelocity
      taskDistributionByStatus {
        status
        count
      }
      taskDistributionByPriority {
        priority
        count
      }
      storyPointTrends {
        sprintId
        name
        committedStoryPoints
        completedStoryPoints
      }
      individualWorkloads {
        assigneeId
        activeTasks
        activeStoryPoints
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

export const UserAnalyticsQuery = graphql(`
  query UserAnalytics($userId: UUID!) {
    userAnalytics(userId: $userId) {
      userId
      completedTasks
      historicalStoryPoints
      avgCompletionSeconds
      velocity
      activeAssignments
    }
  }
`);

export const MyStatisticsQuery = graphql(`
  query MyStatistics {
    me {
      id
      statistics {
        completedTasks
        historicalStoryPoints
        avgCompletionSeconds
        velocity
      }
    }
  }
`);

export const RecomputeUserStatisticsMutation = graphql(`
  mutation RecomputeUserStatistics($userId: UUID!) {
    recomputeUserStatistics(userId: $userId) {
      id
      statistics {
        completedTasks
        historicalStoryPoints
        avgCompletionSeconds
        velocity
      }
    }
  }
`);
