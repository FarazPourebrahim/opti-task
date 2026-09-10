import { z } from 'zod';
import { AvailabilityStatus, TeamRole } from '@prisma/client';
import { ValidationError } from '@/shared/errors';
import type {
  CreateTeamInput,
  TeamMemberAttributes,
  UpdateTeamInput,
} from './team.model.js';

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  description: z.string().trim().max(2000).nullable().optional(),
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No fields to update',
  });

const memberAttributesSchema = z.object({
  role: z.nativeEnum(TeamRole).optional(),
  responsibilities: z.string().trim().max(2000).nullable().optional(),
  availability: z.nativeEnum(AvailabilityStatus).optional(),
  workload: z.number().int().min(0).max(1000).optional(),
});

const updateMemberSchema = memberAttributesSchema.refine(
  (value) => Object.keys(value).length > 0,
  { message: 'No fields to update' },
);

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
  }
  return result.data;
}

export function validateCreateTeam(input: unknown): CreateTeamInput {
  return parse(createSchema, input);
}

export function validateUpdateTeam(input: unknown): UpdateTeamInput {
  return parse(updateSchema, input) as UpdateTeamInput;
}

export function validateAddTeamMember(input: unknown): TeamMemberAttributes {
  return parse(memberAttributesSchema, input);
}

export function validateUpdateTeamMember(input: unknown): TeamMemberAttributes {
  return parse(updateMemberSchema, input);
}
