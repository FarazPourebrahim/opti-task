/**
 * Real-time GraphQL subscriptions. Each subscription authorizes the socket's
 * authenticated user against the resource scope before yielding, and filters the
 * stream so a subscriber only ever receives events they are permitted to see.
 * Events carry ids + the resolved entity (loaded lazily through the normal type
 * resolvers).
 */
export const realtimeTypeDefs = /* GraphQL */ `
  type TaskEvent {
    taskId: UUID!
    projectId: UUID!
    task: Task
  }

  type CommentEvent {
    commentId: UUID!
    taskId: UUID!
    projectId: UUID!
    comment: Comment
  }

  type SprintEvent {
    sprintId: UUID!
    projectId: UUID!
    sprint: Sprint
  }

  type NotificationEvent {
    notificationId: UUID!
    notification: Notification
  }

  type AiRecommendationEvent {
    recommendationId: UUID!
    projectId: UUID!
    approvalStatus: AiApprovalStatus!
    recommendation: AiRecommendation
  }

  type Subscription {
    taskUpdated(projectId: UUID!): TaskEvent!
    commentAdded(taskId: UUID!): CommentEvent!
    sprintUpdated(projectId: UUID!): SprintEvent!
    notificationReceived: NotificationEvent!
    aiRecommendationUpdated(projectId: UUID!): AiRecommendationEvent!
  }
`;
