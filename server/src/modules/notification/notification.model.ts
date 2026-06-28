import type { NotificationType } from '@prisma/client';

/** A notification to create for a single recipient. */
export type NotificationInput = {
  recipientId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};
