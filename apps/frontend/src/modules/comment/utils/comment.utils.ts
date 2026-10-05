import type { Role } from '@contracts';
import { PENDING_COMMENT_PREFIX } from '@/modules/comment/constants/comment.constants';
import { can } from '@/shared/lib/capabilities';

/**
 * Hints for what the viewer may do in a task's discussion. The server decides.
 *
 * Mirrors the backend's `comment.service.ts`: commenting and recording an
 * attachment need `task:comment`; changing or removing someone else's needs
 * `task:update` as a role. One's own comment or attachment is always one's own
 * to change — see `ownsOrModerates`.
 */
export function discussionCapabilities(roles: readonly Role[]) {
  return {
    canComment: can(roles, 'task:comment'),
    canModerate: can(roles, 'task:update'),
  };
}

/** True for the author (or uploader), and for anyone who may moderate. */
export function ownsOrModerates(
  canModerate: boolean,
  viewerId: string | undefined,
  ownerId: string,
): boolean {
  return canModerate || (viewerId !== undefined && viewerId === ownerId);
}

let pendingCommentCount = 0;

/** An id for a comment that is on screen before the server has answered. */
export function nextPendingCommentId(): string {
  pendingCommentCount += 1;
  return `${PENDING_COMMENT_PREFIX}${pendingCommentCount}`;
}

/** A pending comment has no real id yet, so nothing can be done to it. */
export function isPendingComment(commentId: string): boolean {
  return commentId.startsWith(PENDING_COMMENT_PREFIX);
}

const SIZE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;

/** A file size for display ("1.5 MB"), in the viewer's locale. */
export function formatFileSize(bytes: number, locale?: string): string {
  let value = Math.max(0, bytes);
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < SIZE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: SIZE_UNITS[unitIndex] ?? 'byte',
    unitDisplay: unitIndex === 0 ? 'long' : 'short',
    maximumFractionDigits: 1,
  }).format(value);
}

let ownCommentsInFlight = 0;

/**
 * Marks a comment of the viewer's own as on its way to the server.
 *
 * The realtime event for a comment can arrive before the mutation that made it
 * has answered. While that is so the comment is already on screen as a pending
 * stand-in, and adding the event's copy beside it would show it twice. So the
 * viewer's own comments are left to the mutation while one is in flight.
 */
export async function trackOwnComment<Result>(
  send: Promise<Result>,
): Promise<Result> {
  ownCommentsInFlight += 1;
  try {
    return await send;
  } finally {
    ownCommentsInFlight -= 1;
  }
}

export function hasOwnCommentInFlight(): boolean {
  return ownCommentsInFlight > 0;
}
