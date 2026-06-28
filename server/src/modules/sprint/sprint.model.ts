import type { SprintState } from '@prisma/client';

export type CreateSprintInput = {
  name: string;
  goal?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  capacity?: number | null;
};

export type UpdateSprintInput = {
  name?: string;
  goal?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  capacity?: number | null;
};

/**
 * Allowed sprint state transitions. COMPLETED and CANCELLED are terminal. A
 * self-transition, or any pair not listed here, is rejected.
 */
export const SPRINT_STATE_TRANSITIONS: Record<SprintState, SprintState[]> = {
  PLANNED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionSprint(from: SprintState, to: SprintState): boolean {
  return SPRINT_STATE_TRANSITIONS[from].includes(to);
}

/** Aggregated sprint metrics computed from its tasks (story points = work). */
export type SprintMetrics = {
  totalStoryPoints: number;
  completedStoryPoints: number;
  remainingStoryPoints: number;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  velocity: number;
  capacity: number | null;
  overCapacity: boolean;
  workloadDistribution: SprintWorkload[];
};

export type SprintWorkload = {
  assigneeId: string | null;
  storyPoints: number;
  taskCount: number;
};

export type BurndownPoint = {
  date: Date;
  idealRemaining: number;
  actualRemaining: number;
};
