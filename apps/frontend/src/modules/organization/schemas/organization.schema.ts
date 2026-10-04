import { z } from 'zod';
import { blankToNull } from '@/shared/utils/form.utils';

/**
 * Client-side validation, mirroring
 * `apps/backend/src/modules/organization/organization.validation.ts`.
 *
 * The API reports a rejected input as a bare `BAD_USER_INPUT` with no field
 * detail, so these rules are what let a form point at the field that is wrong.
 * The server remains the authority.
 */

const optionalUrl = z
  .string()
  .max(2048, 'organization.validation.urlTooLong')
  .transform(blankToNull)
  .refine((value) => value === null || URL.canParse(value), {
    message: 'organization.validation.urlInvalid',
  });

export const organizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'organization.validation.nameRequired')
    .max(120, 'organization.validation.nameTooLong'),
  description: z
    .string()
    .max(2000, 'organization.validation.descriptionTooLong')
    .transform(blankToNull),
  logoUrl: optionalUrl,
});

/** Invitations grant ADMIN or MEMBER only; ownership is never handed out. */
export const ASSIGNABLE_ORG_ROLES = ['ADMIN', 'MEMBER'] as const;
export type AssignableOrgRole = (typeof ASSIGNABLE_ORG_ROLES)[number];

export function isAssignableOrgRole(value: string): value is AssignableOrgRole {
  return (ASSIGNABLE_ORG_ROLES as readonly string[]).includes(value);
}

export const inviteSchema = z.object({
  // Trimmed and lower-cased exactly as the server does, so the pending
  // invitation shown afterwards matches what was typed.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('organization.validation.emailInvalid'),
  role: z.enum(ASSIGNABLE_ORG_ROLES),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
