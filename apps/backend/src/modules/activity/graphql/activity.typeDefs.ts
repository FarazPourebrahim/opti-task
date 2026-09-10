/**
 * Activity GraphQL contract: the immutable audit trail. Read-only from the API
 * (entries are written transactionally by domain services). Adds the
 * `activities` connection to `Task`. The `ActivityType` enum mirrors the Prisma
 * enum of the same name.
 */
export const activityTypeDefs = /* GraphQL */ `
  enum ActivityType {
    TASK_CREATED
    STATUS_CHANGED
    ASSIGNED
    STORY_POINTS_UPDATED
    SPRINT_MOVED
    AI_RECOMMENDATION
    USER_APPROVAL
    COMMENT_ADDED
  }

  type ActivityLog {
    id: UUID!
    type: ActivityType!
    metadata: JSON!
    actor: User
    createdAt: DateTime!
  }

  type ActivityLogEdge {
    cursor: String!
    node: ActivityLog!
  }

  type ActivityLogConnection {
    edges: [ActivityLogEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  extend type Task {
    activities(first: Int, after: String): ActivityLogConnection!
  }
`;
