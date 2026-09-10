import { z } from 'zod';
import { ProjectRole } from '@prisma/client';
import { ValidationError } from '@/shared/errors';
import type { CreateProjectInput, UpdateProjectInput } from './project.model.js';

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

const projectRoleSchema = z.nativeEnum(ProjectRole);
const workflowSchema = z.record(z.unknown());

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
  }
  return result.data;
}

export function validateCreateProject(input: unknown): CreateProjectInput {
  return parse(createSchema, input);
}

export function validateUpdateProject(input: unknown): UpdateProjectInput {
  return parse(updateSchema, input) as UpdateProjectInput;
}

export function validateProjectRole(role: unknown): ProjectRole {
  return parse(projectRoleSchema, role);
}

export function validateWorkflow(workflow: unknown): Record<string, unknown> {
  return parse(workflowSchema, workflow);
}
