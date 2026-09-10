import type { ActivityType } from '@prisma/client';

/**
 * An immutable audit entry. Written transactionally by the domain services
 * (task assignment, status change, etc.) — never updated or deleted. `metadata`
 * captures the change detail (e.g. `{ from, to }`) as opaque JSON.
 */
export type RecordActivityInput = {
  projectId: string;
  taskId?: string | null;
  actorId?: string | null;
  type: ActivityType;
  metadata?: Record<string, unknown>;
};
