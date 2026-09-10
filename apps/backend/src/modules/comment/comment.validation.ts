import { z } from 'zod';
import { ValidationError } from '@/shared/errors';
import type {
  AddAttachmentInput,
  CreateCommentInput,
  UpdateCommentInput,
} from './comment.model.js';

const createSchema = z.object({
  body: z.string().trim().min(1, 'Comment body is required').max(10000),
  parentCommentId: z.string().uuid().nullable().optional(),
  mentionedUserIds: z.array(z.string().uuid()).max(50).optional(),
});

const updateSchema = z.object({
  body: z.string().trim().min(1, 'Comment body is required').max(10000),
});

const attachmentSchema = z.object({
  filename: z.string().trim().min(1, 'Filename is required').max(255),
  contentType: z.string().trim().max(255).nullable().optional(),
  sizeBytes: z.number().int().min(0).max(5_000_000_000).nullable().optional(),
});

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid input');
  }
  return result.data;
}

export function validateCreateComment(input: unknown): CreateCommentInput {
  return parse(createSchema, input) as CreateCommentInput;
}

export function validateUpdateComment(input: unknown): UpdateCommentInput {
  return parse(updateSchema, input);
}

export function validateAttachment(input: unknown): AddAttachmentInput {
  return parse(attachmentSchema, input) as AddAttachmentInput;
}
