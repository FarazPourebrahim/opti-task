import {
  Activity,
  Gauge,
  HeartPulse,
  Lightbulb,
  UserRoundSearch,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  AiApprovalStatus,
  AiRecommendationType,
  AiResolutionStatus,
} from '@contracts';

/* An icon only ever accompanies the type's name, never replaces it. */
export const AI_TYPE_ICONS: Record<AiRecommendationType, LucideIcon> = {
  STORY_POINT_ESTIMATION: Gauge,
  TASK_ASSIGNMENT: UserRoundSearch,
  SPRINT_HEALTH: HeartPulse,
  PROGRESS_TRACKING: Activity,
  RECOMMENDATION: Lightbulb,
};

type BadgeTone = 'neutral' | 'success' | 'danger' | 'indigo' | 'blue' | 'dark';

/*
 * Two different questions, so two different sets of tones and two labelled
 * badges: what a person decided, and what became of the suggestion. A tone
 * only ever accompanies the status name, never replaces it.
 */
export const AI_APPROVAL_TONES: Record<AiApprovalStatus, BadgeTone> = {
  PENDING: 'blue',
  APPROVED: 'success',
  REJECTED: 'danger',
  OVERRIDDEN: 'indigo',
};

export const AI_RESOLUTION_TONES: Record<AiResolutionStatus, BadgeTone> = {
  OPEN: 'neutral',
  RESOLVED: 'success',
  DISMISSED: 'dark',
};

/** A select cannot hold an empty value, so "any" has a name. */
export const AI_FILTER_ANY = 'ANY';

/** The suggestions a person can ask for, by what they are asked about. */
export const AI_TASK_REQUESTS = ['storyPoints', 'assignment'] as const;
export const AI_SPRINT_REQUESTS = ['sprintHealth', 'progress'] as const;

export type AiRequestKind =
  (typeof AI_TASK_REQUESTS)[number] | (typeof AI_SPRINT_REQUESTS)[number];
