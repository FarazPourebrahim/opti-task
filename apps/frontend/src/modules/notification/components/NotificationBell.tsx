import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SkeletonText,
  useToast,
} from '@averoui/react';
import { Bell, BellOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationItem } from '@/modules/notification/components/NotificationItem';
import {
  BELL_BADGE_MAX,
  BELL_FEED_SIZE,
} from '@/modules/notification/constants/notification.constants';
import { useNotificationInbox } from '@/modules/notification/hooks/useNotificationInbox';
import {
  useNotificationFeed,
  useNotificationRealtime,
  useUnreadNotificationCount,
} from '@/modules/notification/hooks/useNotifications';
import { AppLink, ErrorState } from '@/shared/components';
import { ROUTES } from '@/shared/routes/route.constants';

/**
 * The top bar's notification bell: how many are unread, the newest few, and a
 * way to the full list.
 *
 * It also holds the subscription that brings notifications in as they happen.
 * The bell is on every signed-in screen, so that subscription is too.
 */
export function NotificationBell() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = useUnreadNotificationCount();
  // Nothing is fetched until the popover has been opened once.
  const [hasOpened, setHasOpened] = useState(false);
  const { notifications, totalCount, isLoading, error, refetch } =
    useNotificationFeed({ unreadOnly: false, skip: !hasOpened });
  const { markRead, markAllRead, isMarkingAll } = useNotificationInbox();

  useNotificationRealtime((notification) => {
    // Announced as well as counted: a badge changing is easy to miss.
    toast({
      tone: 'info',
      title: notification.title,
      ...(notification.body ? { description: notification.body } : {}),
    });
  });

  const newest = notifications.slice(0, BELL_FEED_SIZE);

  function handleOpenChange(open: boolean) {
    setIsOpen(open);
    if (open) setHasOpened(true);
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <IconButton
          variant="outline"
          className="relative"
          label={
            unreadCount === 0
              ? t('notification.bell')
              : t('notification.bellUnread', { count: unreadCount })
          }
        >
          <Bell aria-hidden />
          {unreadCount > 0 ? (
            // Decorative: the button's name already says the number.
            <Badge
              aria-hidden
              variant="counter"
              tone="danger"
              className="absolute -end-1 -top-1"
            >
              {unreadCount > BELL_BADGE_MAX
                ? t('notification.badgeOverflow', { max: BELL_BADGE_MAX })
                : unreadCount}
            </Badge>
          ) : null}
        </IconButton>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        aria-labelledby="notification-bell-title"
        className="flex w-80 flex-col gap-3 p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="notification-bell-title"
            className="text-text-strong text-sm font-semibold"
          >
            {t('notification.title')}
          </h2>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              loading={isMarkingAll}
              onClick={() => void markAllRead()}
            >
              {t('notification.markAllRead')}
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <div aria-busy="true" aria-label={t('notification.loading')}>
            <SkeletonText lines={3} />
          </div>
        ) : error ? (
          <ErrorState
            title={t('notification.loadFailed')}
            description={t(error.messageKey as never)}
            requestId={error.requestId}
            onRetry={() => void refetch()}
          />
        ) : newest.length === 0 ? (
          <EmptyState variant="icon" icon={<BellOff />}>
            {t('notification.empty')}
          </EmptyState>
        ) : (
          <ul className="divide-border-subtle flex flex-col divide-y">
            {newest.map((notification) => (
              <li key={notification.id} className="py-3 first:pt-0 last:pb-0">
                <NotificationItem
                  notification={notification}
                  onOpen={(opened) => {
                    markRead(opened);
                    setIsOpen(false);
                  }}
                  onMarkRead={markRead}
                />
              </li>
            ))}
          </ul>
        )}

        <AppLink
          to={ROUTES.notifications}
          variant="subtle"
          className="text-sm font-medium"
          onClick={() => setIsOpen(false)}
        >
          {totalCount > newest.length
            ? t('notification.seeAllCount', { count: totalCount })
            : t('notification.seeAll')}
        </AppLink>
      </PopoverContent>
    </Popover>
  );
}
