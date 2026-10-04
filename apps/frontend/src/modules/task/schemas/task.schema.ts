import { z } from 'zod';
import { TASK_PRIORITIES } from '@contracts';
import {
  LOGGED_SECONDS_MAX,
  STORY_POINTS_MAX,
  TASK_DESCRIPTION_MAX,
  TASK_TITLE_MAX,
} from '@/modules/task/constants/task.constants';
import { toSeconds } from '@/modules/task/utils/task.utils';
import { isApiDateTime } from '@/shared/utils/date.utils';
import { blankToNull } from '@/shared/utils/form.utils';

/**
 * Client-side validation, mirroring
 * `apps/backend/src/modules/task/task.validation.ts`. The server reports a
 * rejected input without saying which field; these rules are what let the form
 * point at it. The server remains the authority.
 */

const title = z
  .string()
  .trim()
  .min(1, 'task.validation.titleRequired')
  .max(TASK_TITLE_MAX, 'task.validation.titleTooLong');

const description = z
  .string()
  .max(TASK_DESCRIPTION_MAX, 'task.validation.descriptionTooLong')
  .transform(blankToNull);

/** Null for "no date"; otherwise a full instant, which is all the API takes. */
const dueDate = z
  .string()
  .refine(isApiDateTime, 'task.validation.dueDateInvalid')
  .nullable();

/** Null clears the estimate. */
export const storyPointsSchema = z
  .number({ invalid_type_error: 'task.validation.storyPointsRange' })
  .int('task.validation.storyPointsRange')
  .min(0, 'task.validation.storyPointsRange')
  .max(STORY_POINTS_MAX, 'task.validation.storyPointsRange')
  .nullable();

export const taskDetailsSchema = z.object({
  title,
  description,
  priority: z.enum(TASK_PRIORITIES),
  dueDate,
});

export const createTaskSchema = taskDetailsSchema.extend({
  storyPoints: storyPointsSchema,
  assigneeId: z.string().nullable(),
  sprintId: z.string().nullable(),
  epicId: z.string().nullable(),
});

export const timeLogSchema = z
  .object({
    hours: z
      .number({ invalid_type_error: 'task.validation.timeInvalid' })
      .int('task.validation.timeInvalid')
      .min(0, 'task.validation.timeInvalid'),
    minutes: z
      .number({ invalid_type_error: 'task.validation.timeInvalid' })
      .int('task.validation.timeInvalid')
      .min(0, 'task.validation.timeInvalid')
      .max(59, 'task.validation.timeInvalid'),
  })
  .transform(({ hours, minutes }) => toSeconds(hours, minutes))
  // The API takes a positive number of seconds: logging nothing is an error.
  .refine((seconds) => seconds > 0, {
    message: 'task.validation.timeRequired',
    path: ['hours'],
  })
  .refine((seconds) => seconds <= LOGGED_SECONDS_MAX, {
    message: 'task.validation.timeInvalid',
    path: ['hours'],
  });

export const labelSchema = z
  .string()
  .trim()
  .min(1, 'task.validation.labelRequired');

export type TaskDetailsInput = z.infer<typeof taskDetailsSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
