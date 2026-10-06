import { z } from 'zod';
import { STORY_POINTS_MAX } from '@/modules/task/constants/task.constants';

/**
 * What a person puts in place of a suggestion.
 *
 * The story-point bounds are the task's own (`task.validation.ts` on the
 * backend): an override sets the same field an estimate does. Unlike the
 * task's estimate, an override cannot be empty — the API requires a number.
 */
export const overrideStoryPointsSchema = z.object({
  storyPoints: z
    .number({ invalid_type_error: 'ai.validation.storyPointsRange' })
    .int('ai.validation.storyPointsRange')
    .min(0, 'ai.validation.storyPointsRange')
    .max(STORY_POINTS_MAX, 'ai.validation.storyPointsRange'),
});

export const overrideAssigneeSchema = z.object({
  assigneeId: z.string().min(1, 'ai.validation.assigneeRequired'),
});

export type OverrideInput =
  | z.infer<typeof overrideStoryPointsSchema>
  | z.infer<typeof overrideAssigneeSchema>;
