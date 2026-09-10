import { z } from 'zod';
import { SeniorityLevel } from '@prisma/client';
import { ValidationError } from '@shared/errors';
import type { AddExpertiseInput, UpdateProfileInput } from './user.model.js';

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    avatarUrl: z.string().url().max(2048).nullable().optional(),
    seniority: z.nativeEnum(SeniorityLevel).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No fields to update',
  });

const addExpertiseSchema = z.object({
  tag: z.string().trim().min(1, 'Tag is required').max(50),
  confidenceScore: z.number().min(0).max(1).optional(),
});

const skillSchema = z.string().trim().min(1, 'Skill is required').max(50);

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
  }
  return result.data;
}

export function validateUpdateProfile(input: unknown): UpdateProfileInput {
  return parse(updateProfileSchema, input);
}

export function validateAddExpertise(input: unknown): AddExpertiseInput {
  return parse(addExpertiseSchema, input);
}

export function validateSkill(skill: unknown): string {
  return parse(skillSchema, skill);
}
