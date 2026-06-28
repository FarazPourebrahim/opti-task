import { z } from 'zod';
import { ValidationError } from '@shared/errors';
import type {
  CreateEpicInput,
  CreateMilestoneInput,
  UpdateEpicInput,
} from './epic.model.js';

const createSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  description: z.string().trim().max(5000).nullable().optional(),
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No fields to update',
  });

const milestoneSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(150),
  description: z.string().trim().max(5000).nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  epicId: z.string().uuid().nullable().optional(),
});

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
  }
  return result.data;
}

export function validateCreateEpic(input: unknown): CreateEpicInput {
  return parse(createSchema, input) as CreateEpicInput;
}

export function validateUpdateEpic(input: unknown): UpdateEpicInput {
  return parse(updateSchema, input) as UpdateEpicInput;
}

export function validateCreateMilestone(input: unknown): CreateMilestoneInput {
  return parse(milestoneSchema, input) as CreateMilestoneInput;
}
