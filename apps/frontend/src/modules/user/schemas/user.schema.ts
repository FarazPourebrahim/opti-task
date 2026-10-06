import { z } from 'zod';
import { SENIORITY_LEVELS } from '@contracts';
import { blankToNull } from '@/shared/utils/form.utils';

/**
 * Client-side validation, mirroring
 * `apps/backend/src/modules/user/user.validation.ts`. The server reports a
 * rejected input without saying which field, so these rules are what let the
 * form point at it. The server remains the authority.
 */

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'user.validation.nameRequired')
    .max(100, 'user.validation.nameTooLong'),
  avatarUrl: z
    .string()
    .max(2048, 'user.validation.urlTooLong')
    .transform(blankToNull)
    .refine((value) => value === null || URL.canParse(value), {
      message: 'user.validation.urlInvalid',
    }),
  seniority: z.enum(SENIORITY_LEVELS).nullable(),
});

export const skillSchema = z
  .string()
  .trim()
  .min(1, 'user.validation.skillRequired')
  .max(50, 'user.validation.skillTooLong');

/**
 * The form collects confidence as a whole percentage, because "70%" is how a
 * person says it; the API stores a fraction from 0 to 1.
 */
export const expertiseSchema = z.object({
  tag: z
    .string()
    .trim()
    .min(1, 'user.validation.tagRequired')
    .max(50, 'user.validation.tagTooLong'),
  confidencePercent: z
    .number({ invalid_type_error: 'user.validation.confidenceRange' })
    .int('user.validation.confidenceRange')
    .min(0, 'user.validation.confidenceRange')
    .max(100, 'user.validation.confidenceRange'),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type ExpertiseFormInput = z.infer<typeof expertiseSchema>;

export function toConfidenceScore(percent: number): number {
  return percent / 100;
}

export function toConfidencePercent(score: number): number {
  return Math.round(score * 100);
}
