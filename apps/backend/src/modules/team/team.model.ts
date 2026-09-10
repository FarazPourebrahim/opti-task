import type { AvailabilityStatus, TeamRole } from '@prisma/client';

export type CreateTeamInput = {
  name: string;
  description?: string | null | undefined;
};

export type UpdateTeamInput = {
  name?: string;
  description?: string | null;
};

/**
 * Team-member attributes that feed the external AI task-assignment service:
 * role, responsibilities, availability, and current workload.
 */
export type TeamMemberAttributes = {
  role?: TeamRole | undefined;
  responsibilities?: string | null | undefined;
  availability?: AvailabilityStatus | undefined;
  workload?: number | undefined;
};
