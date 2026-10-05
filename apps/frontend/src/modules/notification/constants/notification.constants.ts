import {
  AlarmClock,
  AtSign,
  CalendarRange,
  CheckCheck,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NotificationType } from '@contracts';

/* An icon only ever accompanies the type's name, never replaces it. */
export const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  TASK_ASSIGNED: UserRoundCheck,
  MENTION: AtSign,
  SPRINT_UPDATE: CalendarRange,
  DEADLINE_REMINDER: AlarmClock,
  AI_RECOMMENDATION: Sparkles,
  APPROVAL_REQUEST: CheckCheck,
};

/** How many of the newest notifications the bell's popover shows. */
export const BELL_FEED_SIZE = 5;

/** The bell's badge stops counting here and shows "99+". */
export const BELL_BADGE_MAX = 99;

/** The cache's name for the unread-only feed, as an `only` filter sees it. */
export const UNREAD_FEED_MARKER = '"unreadOnly":true';
