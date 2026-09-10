/**
 * Analytics GraphQL contract: project reporting (velocity, story-point trends,
 * completion, task distribution, individual workloads) and user analytics
 * (delivery time, productivity). `recomputeUserStatistics` finalizes the Phase 5
 * `user_statistics` stub from real task/sprint history. All figures derive from
 * grouped aggregate queries.
 */
export const analyticsTypeDefs = /* GraphQL */ `
  type StatusCount {
    status: TaskStatus!
    count: Int!
  }

  type PriorityCount {
    priority: TaskPriority!
    count: Int!
  }

  type SprintTrendPoint {
    sprintId: UUID!
    name: String!
    committedStoryPoints: Int!
    completedStoryPoints: Int!
  }

  type IndividualWorkload {
    assigneeId: UUID!
    user: User!
    activeTasks: Int!
    activeStoryPoints: Int!
    completedTasks: Int!
  }

  type ProjectAnalytics {
    projectId: UUID!
    totalTasks: Int!
    completedTasks: Int!
    totalStoryPoints: Int!
    completedStoryPoints: Int!
    completionRate: Float!
    teamVelocity: Float!
    taskDistributionByStatus: [StatusCount!]!
    taskDistributionByPriority: [PriorityCount!]!
    storyPointTrends: [SprintTrendPoint!]!
    individualWorkloads: [IndividualWorkload!]!
  }

  type UserAnalytics {
    userId: UUID!
    completedTasks: Int!
    historicalStoryPoints: Int!
    avgCompletionSeconds: Float
    velocity: Float
    activeAssignments: Int!
  }

  extend type Project {
    analytics: ProjectAnalytics!
  }

  extend type User {
    analytics: UserAnalytics!
  }

  extend type Query {
    projectAnalytics(projectId: UUID!): ProjectAnalytics!
    userAnalytics(userId: UUID!): UserAnalytics!
  }

  extend type Mutation {
    recomputeUserStatistics(userId: UUID!): User!
  }
`;
