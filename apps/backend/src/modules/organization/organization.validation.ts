import { z } from 'zod';
import { OrgRole } from '@prisma/client';
import { ValidationError } from '@/shared/errors';
import type {
  CreateOrganizationInput,
  InviteMemberInput,
  UpdateOrganizationInput,
} from './organization.model.js';

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  logoUrl: z.string().url().max(2048).nullable().optional(),
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    logoUrl: z.string().url().max(2048).nullable().optional(),
    settings: z.record(z.unknown()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No fields to update',
  });

// Invitations may only grant ADMIN or MEMBER — ownership transfers are separate.
const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email'),
  role: z.enum([OrgRole.ADMIN, OrgRole.MEMBER]).optional(),
});

// updateMemberRole likewise cannot set OWNER.
const assignableRoleSchema = z.enum([OrgRole.ADMIN, OrgRole.MEMBER]);

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
  }
  return result.data;
}

export function validateCreateOrganization(
  input: unknown,
): CreateOrganizationInput {
  return parse(createSchema, input);
}

export function validateUpdateOrganization(
  input: unknown,
): UpdateOrganizationInput {
  return parse(updateSchema, input) as UpdateOrganizationInput;
}

export function validateInvite(input: unknown): InviteMemberInput {
  return parse(inviteSchema, input);
}

export function validateAssignableRole(role: unknown): OrgRole {
  return parse(assignableRoleSchema, role);
}
