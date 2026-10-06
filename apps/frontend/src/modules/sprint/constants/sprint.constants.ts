import type { SprintState } from '@contracts';

/** Bounds mirrored from the backend's `sprint.validation.ts`. */
export const SPRINT_NAME_MAX = 120;
export const SPRINT_GOAL_MAX = 2000;
export const SPRINT_CAPACITY_MAX = 100_000;

/** Tasks shown per page on the sprint's own list. */
export const SPRINT_TASKS_PAGE_SIZE = 20;

/** How many of the project's tasks are offered for adding to a sprint. */
export const SPRINT_TASK_CANDIDATES_PAGE_SIZE = 100;

/* A tone only ever accompanies the state's name, never replaces it. */
export const SPRINT_STATE_TONES: Record<
  SprintState,
  'neutral' | 'success' | 'blue' | 'danger'
> = {
  PLANNED: 'blue',
  ACTIVE: 'success',
  COMPLETED: 'neutral',
  CANCELLED: 'danger',
};
