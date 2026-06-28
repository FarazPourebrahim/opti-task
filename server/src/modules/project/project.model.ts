import type { ProjectState } from '@prisma/client';

export type CreateProjectInput = {
  name: string;
  description?: string | null | undefined;
};

export type UpdateProjectInput = {
  name?: string;
  description?: string | null;
};

/**
 * Allowed project status transitions. ARCHIVED is terminal. A transition to the
 * same state, or any pair not listed here, is rejected (illegal transition).
 */
export const PROJECT_STATE_TRANSITIONS: Record<ProjectState, ProjectState[]> = {
  PLANNING: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['COMPLETED', 'ARCHIVED'],
  COMPLETED: ['ACTIVE', 'ARCHIVED'],
  ARCHIVED: [],
};

export function canTransition(from: ProjectState, to: ProjectState): boolean {
  return PROJECT_STATE_TRANSITIONS[from].includes(to);
}
