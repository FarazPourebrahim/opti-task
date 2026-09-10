import { z } from 'zod';
import { ValidationError } from '@/shared/errors';
import type { CreateSprintInput, UpdateSprintInput } from './sprint.model.js';

const baseShape = {
  name: z.string().trim().min(1, 'Name is required').max(120),
  goal: z.string().trim().max(2000).nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  capacity: z.number().int().min(0).max(100000).nullable().optional(),
};

/** End date, when both are present, must not precede the start date. */
function datesOrdered(value: {
  startDate?: Date | null | undefined;
  endDate?: Date | null | undefined;
}): boolean {
  if (value.startDate && value.endDate) {
    return value.endDate.getTime() >= value.startDate.getTime();
  }
  return true;
}

const createSchema = z
  .object(baseShape)
  .refine(datesOrdered, { message: 'End date must be on or after start date' });

const updateSchema = z
  .object({ ...baseShape, name: baseShape.name.optional() })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No fields to update',
  })
  .refine(datesOrdered, { message: 'End date must be on or after start date' });

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
  }
  return result.data;
}

export function validateCreateSprint(input: unknown): CreateSprintInput {
  return parse(createSchema, input) as CreateSprintInput;
}

export function validateUpdateSprint(input: unknown): UpdateSprintInput {
  return parse(updateSchema, input) as UpdateSprintInput;
}
