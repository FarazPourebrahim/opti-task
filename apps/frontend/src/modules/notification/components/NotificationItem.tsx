import { Badge, Button } from '@averoui/react';
import { useTranslation } from 'react-i18next';
import { NOTIFICATION_ICONS } from '@/modules/notification/constants/notification.constants';
import type { NotificationData } from '@/modules/notification/hooks/useNotifications';
import { notificationTarget } from '@/modules/notification/utils/notification.utils';
import { AppLink } from '@/shared/components';
import { formatRelativeTime } from '@/shared/utils/date.utils';

type NotificationItemProps = {
  notification: NotificationData;
  /** The notification's link was followed. */
  onOpen: (notification: NotificationData) => void;
  onMarkRead: (notification: NotificationData) => void;
};

/**
 * One notification: what kind it is, what it says, when, and where it leads.
 *
 * The title and body are the server's own words about the event, shown as
 * written. The kind is named from this app's strings and carries an icon; a
 * notification about something this app cannot open has no link, and is still
 * shown.
 */
export function NotificationItem({
  notification,
  onOpen,
  onMarkRead,
}: NotificationItemProps) {
  const { t } = useTranslation();
  const Icon = NOTIFICATION_ICONS[notification.type];
  const target = notificationTarget(notification);

  return (
    <article className="flex items-start gap-3">
      <Icon aria-hidden className="text-text-subtle mt-0.5 size-4 shrink-0" />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-text-subtle flex flex-wrap items-center gap-x-2 text-xs">
          <span>{t(`enums.notificationType.${notification.type}`)}</span>
          <time dateTime={notification.createdAt}>
            {formatRelativeTime(notification.createdAt)}
          </time>
          {notification.read ? null : (
            <Badge tone="blue">{t('notification.unread')}</Badge>
          )}
        </p>

        {target ? (
          <AppLink
            to={target}
            variant="subtle"
            className="text-sm font-medium"
            onClick={() => onOpen(notification)}
          >
            {notification.title}
          </AppLink>
        ) : (
          <span className="text-text-strong text-sm font-medium">
            {notification.title}
          </span>
        )}

        {notification.body ? (
          <p className="text-text-subtle text-sm break-words">
            {notification.body}
          </p>
        ) : null}
      </div>

      {notification.read ? null : (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          aria-label={t('notification.markReadNamed', {
            title: notification.title,
          })}
          onClick={() => onMarkRead(notification)}
        >
          {t('notification.markRead')}
        </Button>
      )}
    </article>
  );
}
