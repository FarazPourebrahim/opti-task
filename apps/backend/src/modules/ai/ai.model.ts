/**
 * Persisted metadata shapes for each AI recommendation type. Stored on
 * `ai_recommendations.metadata` so an approval can apply exactly what the AI
 * proposed (or a human override), and so the suggestion is fully auditable.
 */
export type StoryPointMetadata = {
  storyPoints: number;
  ranking?: never;
};

export type AssignmentMetadata = {
  suggestedAssigneeId: string | null;
  ranking: Array<{ userId: string; score: number }>;
};

export type OverrideRecommendationInput = {
  storyPoints?: number | null;
  assigneeId?: string | null;
};

/** A single candidate surfaced by the assignment-context dataset API. */
export type AssignmentCandidate = {
  userId: string;
  skills: string[];
  expertise: string[];
  workload: number;
  availability: string | null;
  activeTaskCount: number;
  completedTasks: number;
};
