import { z } from 'zod';
import { PROJECT_ROLES } from '@contracts';
import { blankToNull } from '@/shared/utils/form.utils';

/**
 * Client-side validation, mirroring
 * `apps/backend/src/modules/project/project.validation.ts`. The server reports
 * a rejected input without saying which field; these rules are what let the
 * form point at it. The server remains the authority.
 */
export const projectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'project.validation.nameRequired')
    .max(120, 'project.validation.nameTooLong'),
  description: z
    .string()
    .max(2000, 'project.validation.descriptionTooLong')
    .transform(blankToNull),
});

export const addProjectMemberSchema = z.object({
  userId: z.string().min(1, 'project.validation.memberRequired'),
  role: z.enum(PROJECT_ROLES),
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
