/**
 * Canonical OptiTask domain vocabulary. Every one of these enums exists in three
 * places that must never drift: the Postgres schema (Prisma), the GraphQL SDL,
 * and the client UI (filters, badges, dropdowns). This file is the single
 * definition all three are checked against — the backend asserts compatibility
 * with the Prisma-generated enums in its contract conformance test.
 *
 * Each enum ships as a `readonly` array plus a union derived from it, so the
 * same declaration serves as runtime data (iterating options in a UI) and as a
 * compile-time type. Order is the natural domain order, not alphabetical.
 */

export const ORG_ROLES = ['OWNER', 'ADMIN', 'MEMBER'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const PROJECT_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const TEAM_ROLES = ['LEAD', 'MEMBER'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const INVITATION_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'REVOKED',
  'EXPIRED',
] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const PROJECT_STATES = [
  'PLANNING',
  'ACTIVE',
  'COMPLETED',
  'ARCHIVED',
] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

export const SPRINT_STATES = [
  'PLANNED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
] as const;
export type SprintState = (typeof SPRINT_STATES)[number];

export const TASK_PRIORITIES = [
  'LOWEST',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'TESTING',
  'DONE',
  'BLOCKED',
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const SENIORITY_LEVELS = [
  'JUNIOR',
  'MID',
  'SENIOR',
  'LEAD',
  'PRINCIPAL',
] as const;
export type SeniorityLevel = (typeof SENIORITY_LEVELS)[number];

export const AVAILABILITY_STATUSES = [
  'AVAILABLE',
  'BUSY',
  'AWAY',
  'OFFLINE',
] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'TASK_ASSIGNED',
  'MENTION',
  'SPRINT_UPDATE',
  'DEADLINE_REMINDER',
  'AI_RECOMMENDATION',
  'APPROVAL_REQUEST',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const ACTIVITY_TYPES = [
  'TASK_CREATED',
  'STATUS_CHANGED',
  'ASSIGNED',
  'STORY_POINTS_UPDATED',
  'SPRINT_MOVED',
  'AI_RECOMMENDATION',
  'USER_APPROVAL',
  'COMMENT_ADDED',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const AI_RECOMMENDATION_TYPES = [
  'STORY_POINT_ESTIMATION',
  'TASK_ASSIGNMENT',
  'SPRINT_HEALTH',
  'PROGRESS_TRACKING',
  'RECOMMENDATION',
] as const;
export type AiRecommendationType = (typeof AI_RECOMMENDATION_TYPES)[number];

export const AI_APPROVAL_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'OVERRIDDEN',
] as const;
export type AiApprovalStatus = (typeof AI_APPROVAL_STATUSES)[number];

export const AI_RESOLUTION_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const;
export type AiResolutionStatus = (typeof AI_RESOLUTION_STATUSES)[number];
