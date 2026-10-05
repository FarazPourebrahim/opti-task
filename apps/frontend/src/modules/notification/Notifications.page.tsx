import {
  Button,
  Card,
  EmptyState,
  SegmentedControl,
  SegmentedControlItem,
} from '@averoui/react';
import { BellOff, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NotificationItem } from '@/modules/notification/components/NotificationItem';
import { useNotificationInbox } from '@/modules/notification/hooks/useNotificationInbox';
import {
  useNotificationFeed,
  useUnreadNotificationCount,
} from '@/modules/notification/hooks/useNotifications';
import {
  ErrorState,
  LoadMore,
  PageHeader,
  PageSkeleton,
} from '@/shared/components';

const FILTER_ALL = 'all';
const FILTER_UNREAD = 'unread';

/** Every notification the signed-in person has, newest first. */
export function NotificationsPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState(FILTER_ALL);
  const unreadOnly = filter === FILTER_UNREAD;
  const unreadCount = useUnreadNotificationCount();
  const {
    notifications,
    totalCount,
    isLoading,
    error,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
  } = useNotificationFeed({ unreadOnly });
  const { markRead, markAllRead, isMarkingAll } = useNotificationInbox();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('notification.title')}
        description={t('notification.subtitle')}
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              loading={isMarkingAll}
              onClick={() => void markAllRead()}
            >
              {t('notification.markAllRead')}
            </Button>
          ) : undefined
        }
      />

      <div>
        <SegmentedControl
          aria-label={t('notification.filterLabel')}
          value={filter}
          // Radix reports an empty value when the chosen item is pressed
          // again; a filter is always one or the other.
          onValueChange={(value) => {
            if (value) setFilter(value);
          }}
        >
          <SegmentedControlItem value={FILTER_ALL}>
            {t('notification.filterAll')}
          </SegmentedControlItem>
          <SegmentedControlItem value={FILTER_UNREAD}>
            {t('notification.filterUnread')}
          </SegmentedControlItem>
        </SegmentedControl>
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState
          title={t('notification.loadFailed')}
          description={t(error.messageKey as never)}
          requestId={error.requestId}
          onRetry={() => void refetch()}
        />
      ) : notifications.length === 0 ? (
        <Card>
          {unreadOnly ? (
            <EmptyState variant="circle" icon={<CheckCheck />}>
              {t('notification.emptyUnread')}
            </EmptyState>
          ) : (
            <EmptyState variant="circle" icon={<BellOff />}>
              {t('notification.empty')}
            </EmptyState>
          )}
        </Card>
      ) : (
        <Card>
          <div className="flex flex-col gap-4">
            <ul className="divide-border-subtle flex flex-col divide-y">
              {notifications.map((notification) => (
                <li key={notification.id} className="py-4 first:pt-0 last:pb-0">
                  <NotificationItem
                    notification={notification}
                    onOpen={markRead}
                    onMarkRead={markRead}
                  />
                </li>
              ))}
            </ul>
            <LoadMore
              shown={notifications.length}
              total={totalCount}
              hasMore={hasMore}
              isLoading={isLoadingMore}
              onLoadMore={() => void loadMore()}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
