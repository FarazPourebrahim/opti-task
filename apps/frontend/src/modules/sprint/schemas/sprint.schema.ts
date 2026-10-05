import { z } from 'zod';
import {
  SPRINT_CAPACITY_MAX,
  SPRINT_GOAL_MAX,
  SPRINT_NAME_MAX,
} from '@/modules/sprint/constants/sprint.constants';
import { isApiDateTime } from '@/shared/utils/date.utils';
import { blankToNull } from '@/shared/utils/form.utils';

/** Null for "no date"; otherwise a full instant, which is all the API takes. */
const day = z
  .string()
  .refine(isApiDateTime, 'sprint.validation.dateInvalid')
  .nullable();

/**
 * Client-side validation, mirroring
 * `apps/backend/src/modules/sprint/sprint.validation.ts`. The server reports a
 * rejected input without saying which field; these rules are what let the form
 * point at it. The server remains the authority.
 */
export const sprintSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'sprint.validation.nameRequired')
      .max(SPRINT_NAME_MAX, 'sprint.validation.nameTooLong'),
    goal: z
      .string()
      .max(SPRINT_GOAL_MAX, 'sprint.validation.goalTooLong')
      .transform(blankToNull),
    startDate: day,
    endDate: day,
    /** Null for "no capacity set". */
    capacity: z
      .number({ invalid_type_error: 'sprint.validation.capacityRange' })
      .int('sprint.validation.capacityRange')
      .min(0, 'sprint.validation.capacityRange')
      .max(SPRINT_CAPACITY_MAX, 'sprint.validation.capacityRange')
      .nullable(),
  })
  .refine(
    // Both are UTC-midnight instants in one format, so they compare as text.
    (value) =>
      !value.startDate || !value.endDate || value.endDate >= value.startDate,
    { message: 'sprint.validation.endBeforeStart', path: ['endDate'] },
  );

export type SprintInput = z.infer<typeof sprintSchema>;
