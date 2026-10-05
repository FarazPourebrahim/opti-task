/** Bounds mirrored from the backend's `comment.validation.ts`. */
export const COMMENT_BODY_MAX = 10_000;
export const COMMENT_MENTIONS_MAX = 50;
export const ATTACHMENT_FILENAME_MAX = 255;
export const ATTACHMENT_CONTENT_TYPE_MAX = 255;

/*
 * The backend allows 5,000,000,000 bytes, but the field is a GraphQL `Int`,
 * which cannot carry a number past 2^31 - 1. The smaller bound is the real one.
 */
export const ATTACHMENT_SIZE_MAX = 2_147_483_647;

/** Marks a comment shown before the server has answered. */
export const PENDING_COMMENT_PREFIX = 'pending-comment-';
