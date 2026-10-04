import { z } from 'zod';
import { AVAILABILITY_STATUSES, TEAM_ROLES } from '@contracts';
import { blankToNull } from '@/shared/utils/form.utils';

/**
 * Client-side validation, mirroring
 * `apps/backend/src/modules/team/team.validation.ts`. The server reports a
 * rejected input without saying which field; these rules are what let the form
 * point at it. The server remains the authority.
 */
export const teamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'team.validation.nameRequired')
    .max(120, 'team.validation.nameTooLong'),
  description: z
    .string()
    .max(2000, 'team.validation.descriptionTooLong')
    .transform(blankToNull),
});

export const teamMemberSchema = z.object({
  role: z.enum(TEAM_ROLES),
  responsibilities: z
    .string()
    .max(2000, 'team.validation.responsibilitiesTooLong')
    .transform(blankToNull),
  availability: z.enum(AVAILABILITY_STATUSES),
  workload: z
    .number({ invalid_type_error: 'team.validation.workloadRange' })
    .int('team.validation.workloadRange')
    .min(0, 'team.validation.workloadRange')
    .max(1000, 'team.validation.workloadRange'),
});

export type TeamInput = z.infer<typeof teamSchema>;
export type TeamMemberInput = z.infer<typeof teamMemberSchema>;
