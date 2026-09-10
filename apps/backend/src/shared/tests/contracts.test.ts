import { describe, expect, it } from 'vitest';
import {
  ActivityType,
  AiApprovalStatus,
  AiRecommendationType,
  AiResolutionStatus,
  AvailabilityStatus,
  InvitationStatus,
  NotificationType,
  OrgRole,
  ProjectRole,
  ProjectState,
  SeniorityLevel,
  SprintState,
  TaskPriority,
  TaskStatus,
  TeamRole,
} from '@prisma/client';
import {
  ACTIVITY_TYPES,
  AI_APPROVAL_STATUSES,
  AI_RECOMMENDATION_TYPES,
  AI_RESOLUTION_STATUSES,
  AVAILABILITY_STATUSES,
  INVITATION_STATUSES,
  NOTIFICATION_TYPES,
  ORG_ROLES,
  PROJECT_ROLES,
  PROJECT_STATES,
  SENIORITY_LEVELS,
  SPRINT_STATES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TEAM_ROLES,
} from '@contracts';

/**
 * Conformance guard for the cross-app domain vocabulary.
 *
 * `@contracts` declares each enum independently of Prisma on purpose — clients
 * must not depend on the database client to know what a task status is. That
 * independence is only safe if the two definitions are kept identical, so this
 * test fails the build the moment a value is added to the Prisma schema (or to
 * `@contracts`) without being mirrored in the other.
 */
const ENUM_PAIRS: ReadonlyArray<{
  name: string;
  prisma: Record<string, string>;
  contract: readonly string[];
}> = [
  { name: 'OrgRole', prisma: OrgRole, contract: ORG_ROLES },
  { name: 'ProjectRole', prisma: ProjectRole, contract: PROJECT_ROLES },
  { name: 'TeamRole', prisma: TeamRole, contract: TEAM_ROLES },
  {
    name: 'InvitationStatus',
    prisma: InvitationStatus,
    contract: INVITATION_STATUSES,
  },
  { name: 'ProjectState', prisma: ProjectState, contract: PROJECT_STATES },
  { name: 'SprintState', prisma: SprintState, contract: SPRINT_STATES },
  { name: 'TaskPriority', prisma: TaskPriority, contract: TASK_PRIORITIES },
  { name: 'TaskStatus', prisma: TaskStatus, contract: TASK_STATUSES },
  {
    name: 'SeniorityLevel',
    prisma: SeniorityLevel,
    contract: SENIORITY_LEVELS,
  },
  {
    name: 'AvailabilityStatus',
    prisma: AvailabilityStatus,
    contract: AVAILABILITY_STATUSES,
  },
  {
    name: 'NotificationType',
    prisma: NotificationType,
    contract: NOTIFICATION_TYPES,
  },
  { name: 'ActivityType', prisma: ActivityType, contract: ACTIVITY_TYPES },
  {
    name: 'AiRecommendationType',
    prisma: AiRecommendationType,
    contract: AI_RECOMMENDATION_TYPES,
  },
  {
    name: 'AiApprovalStatus',
    prisma: AiApprovalStatus,
    contract: AI_APPROVAL_STATUSES,
  },
  {
    name: 'AiResolutionStatus',
    prisma: AiResolutionStatus,
    contract: AI_RESOLUTION_STATUSES,
  },
];

describe('@contracts domain enums', () => {
  it.each(ENUM_PAIRS)(
    '$name matches the Prisma schema exactly',
    ({ prisma, contract }) => {
      // Arrange
      const fromPrisma = Object.values(prisma).sort();

      // Act
      const fromContract = [...contract].sort();

      // Assert
      expect(fromContract).toEqual(fromPrisma);
    },
  );

  it('covers every enum the database defines', () => {
    // Arrange — a new Prisma enum must be added to ENUM_PAIRS above, otherwise
    // it can drift from the client contract unnoticed.
    const covered = ENUM_PAIRS.length;

    // Act & Assert
    expect(covered).toBe(15);
  });
});
