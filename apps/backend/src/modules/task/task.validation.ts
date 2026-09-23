import { z } from 'zod';
import { TaskPriority } from '@prisma/client';
import { ValidationError } from '@/shared/errors';
import type { CreateTaskInput, UpdateTaskInput } from './task.model.js';

const createSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(10000).nullable().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  storyPoints: z.number().int().min(0).max(1000).nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  sprintId: z.string().uuid().nullable().optional(),
  epicId: z.string().uuid().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
});

const updateSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'No fields to update',
  });

const storyPointsSchema = z.number().int().min(0).max(1000).nullable();
const secondsSchema = z.number().int().positive().max(1_000_000_000);

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
  }
  return result.data;
}

export function validateCreateTask(input: unknown): CreateTaskInput {
  return parse(createSchema, input) as CreateTaskInput;
}

export function validateUpdateTask(input: unknown): UpdateTaskInput {
  return parse(updateSchema, input) as UpdateTaskInput;
}

export function validateStoryPoints(value: unknown): number | null {
  return parse(storyPointsSchema, value);
}

export function validateSeconds(value: unknown): number {
  return parse(secondsSchema, value);
}
