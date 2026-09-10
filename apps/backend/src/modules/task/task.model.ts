import type { TaskPriority, TaskStatus } from '@prisma/client';

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  storyPoints?: number | null;
  assigneeId?: string | null;
  sprintId?: string | null;
  epicId?: string | null;
  dueDate?: Date | null;
};

export type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  dueDate?: Date | null;
};

export type TaskFilter = {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  sprintId?: string;
  epicId?: string;
  labelId?: string;
};

export type TaskSortField = 'CREATED_AT' | 'PRIORITY' | 'DUE_DATE';

/**
 * Allowed task status transitions (a simple Agile workflow). BLOCKED is
 * reachable from any active state and returns to the workable states when
 * cleared; DONE can be reopened. A self-transition, or any pair not listed
 * here, is rejected as an illegal transition.
 */
export const TASK_STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  BACKLOG: ['TODO', 'BLOCKED'],
  TODO: ['BACKLOG', 'IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['TODO', 'IN_REVIEW', 'BLOCKED'],
  IN_REVIEW: ['IN_PROGRESS', 'TESTING', 'BLOCKED'],
  TESTING: ['IN_PROGRESS', 'DONE', 'BLOCKED'],
  DONE: ['IN_PROGRESS'],
  BLOCKED: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'TESTING'],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean {
  return TASK_STATUS_TRANSITIONS[from].includes(to);
}
