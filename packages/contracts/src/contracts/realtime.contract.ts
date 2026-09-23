import type { AiApprovalStatus } from '../types/domain.types.js';

/**
 * Payloads published on the real-time (GraphQL subscription) channel.
 *
 * Events are deliberately thin — ids plus the scope needed to authorize and
 * route them, never whole entities. A client receiving one re-reads the changed
 * node through the normal query path, so a subscriber can never observe a field
 * it is not allowed to query. Keeping the map here means the publisher and the
 * subscriber are checked against the same definition.
 */
export type RealtimeEvents = {
  TASK_UPDATED: { taskId: string; projectId: string };
  COMMENT_ADDED: { commentId: string; taskId: string; projectId: string };
  SPRINT_UPDATED: { sprintId: string; projectId: string };
  NOTIFICATION_CREATED: { notificationId: string; recipientId: string };
  AI_RECOMMENDATION_UPDATED: {
    recommendationId: string;
    projectId: string;
    approvalStatus: AiApprovalStatus;
  };
};

/** Every topic a client may subscribe to. */
export type RealtimeTopic = keyof RealtimeEvents;
