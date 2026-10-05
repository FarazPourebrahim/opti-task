import { z } from 'zod';
import {
  ATTACHMENT_CONTENT_TYPE_MAX,
  ATTACHMENT_FILENAME_MAX,
  ATTACHMENT_SIZE_MAX,
  COMMENT_BODY_MAX,
  COMMENT_MENTIONS_MAX,
} from '@/modules/comment/constants/comment.constants';
import { blankToNull } from '@/shared/utils/form.utils';

/**
 * Client-side validation, mirroring
 * `apps/backend/src/modules/comment/comment.validation.ts`. The server reports
 * a rejected input without saying which field; these rules are what let the
 * form point at it. The server remains the authority.
 */

const body = z
  .string()
  .trim()
  .min(1, 'comment.validation.bodyRequired')
  .max(COMMENT_BODY_MAX, 'comment.validation.bodyTooLong');

export const commentSchema = z.object({
  body,
  /** Ids picked from the project's members, never read out of the text. */
  mentionedUserIds: z
    .array(z.string())
    .max(COMMENT_MENTIONS_MAX, 'comment.validation.tooManyMentions'),
});

/** An edit changes the text only: the API takes nothing else. */
export const commentEditSchema = z.object({ body });

export const attachmentSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1, 'attachment.validation.filenameRequired')
    .max(ATTACHMENT_FILENAME_MAX, 'attachment.validation.filenameTooLong'),
  contentType: z
    .string()
    .max(
      ATTACHMENT_CONTENT_TYPE_MAX,
      'attachment.validation.contentTypeTooLong',
    )
    .transform(blankToNull),
  /** Null when the size is not known. */
  sizeBytes: z
    .number({ invalid_type_error: 'attachment.validation.sizeInvalid' })
    .int('attachment.validation.sizeInvalid')
    .min(0, 'attachment.validation.sizeInvalid')
    .max(ATTACHMENT_SIZE_MAX, 'attachment.validation.sizeInvalid')
    .nullable(),
});

export type CommentInput = z.infer<typeof commentSchema>;
export type CommentEditInput = z.infer<typeof commentEditSchema>;
export type AttachmentInput = z.infer<typeof attachmentSchema>;
