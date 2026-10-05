import type { AiRecommendationType, Role } from '@contracts';
import { can } from '@/shared/lib/capabilities';

/**
 * What a recommendation proposes, read out of its `metadata`.
 *
 * `metadata` is free-form JSON, so nothing about its shape is assumed: a value
 * of the wrong type reads as "nothing proposed" rather than being cast. The
 * shapes mirror what the backend's `ai.service.ts` stores.
 */
export type AiSuggestion =
  | { kind: 'storyPoints'; storyPoints: number | null }
  | { kind: 'assignee'; assigneeId: string | null }
  | { kind: 'insight'; risks: string[] };

type SuggestionSource = {
  type: AiRecommendationType;
  metadata: Readonly<Record<string, unknown>>;
};

export function readSuggestion({
  type,
  metadata,
}: SuggestionSource): AiSuggestion {
  if (type === 'STORY_POINT_ESTIMATION') {
    const value = metadata['storyPoints'];
    return {
      kind: 'storyPoints',
      storyPoints:
        typeof value === 'number' && Number.isInteger(value) && value >= 0
          ? value
          : null,
    };
  }

  if (type === 'TASK_ASSIGNMENT') {
    const value = metadata['suggestedAssigneeId'];
    return {
      kind: 'assignee',
      assigneeId: typeof value === 'string' && value !== '' ? value : null,
    };
  }

  const risks = metadata['risks'];
  return {
    kind: 'insight',
    risks: Array.isArray(risks)
      ? risks.filter((risk): risk is string => typeof risk === 'string')
      : [],
  };
}

/**
 * Whether deciding on this kind of suggestion changes a task.
 *
 * An estimate or an assignment is applied to its task on approval. A sprint
 * insight is informational: approving it only records that it was reviewed.
 */
export function changesTask(suggestion: AiSuggestion): boolean {
  return suggestion.kind !== 'insight';
}

/** Hints for what the viewer may do with AI suggestions. The server decides. */
export function aiCapabilities(roles: readonly Role[]) {
  return {
    canRequest: can(roles, 'ai:request'),
    canDecide: can(roles, 'ai:approve'),
  };
}

/**
 * A confidence score (0 to 1) as a percentage, or null when none was reported
 * or the value is not one.
 */
export function confidencePercent(
  score: number | null | undefined,
): number | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  return Math.round(Math.min(1, Math.max(0, score)) * 100);
}
