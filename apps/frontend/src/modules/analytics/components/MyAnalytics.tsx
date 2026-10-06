import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  SkeletonText,
  useToast,
} from '@averoui/react';
import { useTranslation } from 'react-i18next';
import { UserAnalyticsTable } from '@/modules/analytics/components/UserAnalyticsTable';
import {
  useMyStatistics,
  useRecomputeUserStatistics,
  useUserAnalytics,
} from '@/modules/analytics/hooks/useAnalytics';
import { ErrorState } from '@/shared/components';
import { useErrorToast } from '@/shared/hooks/useErrorToast';

type MyAnalyticsProps = {
  userId: string;
};

/**
 * The signed-in user's own figures: live, beside the copy stored on their
 * profile, with the one action that brings the copy up to date. The two are
 * shown together so a difference between them reads as "not saved yet", not
 * as a fault.
 */
export function MyAnalytics({ userId }: MyAnalyticsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const live = useUserAnalytics(userId);
  const stored = useMyStatistics();
  const { recomputeStatistics, isRecomputing } =
    useRecomputeUserStatistics(userId);

  const error = live.error ?? stored.error;

  async function handleSave() {
    try {
      await recomputeStatistics();
      toast({ tone: 'success', title: t('analytics.user.savedToast') });
    } catch (failure) {
      showError(failure);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle as="h2">{t('analytics.user.title')}</CardTitle>
          <p className="text-text-subtle text-sm">
            {t('analytics.user.selfSubtitle')}
          </p>
        </div>
      </CardHeader>

      {live.isLoading || stored.isLoading ? (
        <SkeletonText lines={5} />
      ) : error || !live.analytics || !stored.statistics ? (
        <ErrorState
          title={t('analytics.user.loadFailed')}
          description={error ? t(error.messageKey as never) : undefined}
          requestId={error?.requestId}
          onRetry={() => {
            void live.refetch();
            void stored.refetch();
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <UserAnalyticsTable
            analytics={live.analytics}
            saved={stored.statistics}
          />
          <p className="text-text-subtle text-sm">
            {t('analytics.user.savedExplanation')}
          </p>
          <div>
            <Button
              variant="outline"
              loading={isRecomputing}
              onClick={() => void handleSave()}
            >
              {t('analytics.user.save')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
