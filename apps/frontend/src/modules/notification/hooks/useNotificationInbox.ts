import { useToast } from '@averoui/react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotificationActions } from '@/modules/notification/hooks/useNotifications';
import type { NotificationData } from '@/modules/notification/hooks/useNotifications';
import { useErrorToast } from '@/shared/hooks/useErrorToast';

/**
 * What a person does with their notifications, with the outcome reported: the
 * same handlers behind the bell's popover and the notifications page.
 */
export function useNotificationInbox() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const { markNotificationRead, markAllNotificationsRead, isMarkingAll } =
    useNotificationActions();

  const markRead = useCallback(
    (notification: NotificationData) => {
      markNotificationRead(notification).catch(showError);
    },
    [markNotificationRead, showError],
  );

  const markAllRead = useCallback(async () => {
    try {
      const count = await markAllNotificationsRead();
      toast({
        tone: 'success',
        title:
          count === 0
            ? t('notification.noneToMark')
            : t('notification.markedAll', { count }),
      });
    } catch (error) {
      showError(error);
    }
  }, [markAllNotificationsRead, showError, t, toast]);

  return { markRead, markAllRead, isMarkingAll };
}
