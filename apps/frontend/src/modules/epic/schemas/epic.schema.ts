import { z } from 'zod';
import {
  EPIC_DESCRIPTION_MAX,
  EPIC_NAME_MAX,
} from '@/modules/epic/constants/epic.constants';
import { isApiDateTime } from '@/shared/utils/date.utils';
import { blankToNull } from '@/shared/utils/form.utils';

/**
 * Client-side validation, mirroring
 * `apps/backend/src/modules/epic/epic.validation.ts`. The server reports a
 * rejected input without saying which field; these rules are what let the form
 * point at it. The server remains the authority.
 */

const name = z
  .string()
  .trim()
  .min(1, 'epic.validation.nameRequired')
  .max(EPIC_NAME_MAX, 'epic.validation.nameTooLong');

const description = z
  .string()
  .max(EPIC_DESCRIPTION_MAX, 'epic.validation.descriptionTooLong')
  .transform(blankToNull);

export const epicSchema = z.object({ name, description });

export const milestoneSchema = z.object({
  name,
  description,
  /** Null for "no date"; otherwise a full instant, which is all the API takes. */
  dueDate: z
    .string()
    .refine(isApiDateTime, 'epic.validation.dueDateInvalid')
    .nullable(),
});

export type EpicInput = z.infer<typeof epicSchema>;
export type MilestoneInput = z.infer<typeof milestoneSchema>;
