import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AnalyticsKpis } from '@/modules/analytics/components/AnalyticsKpis';
import { DistributionTable } from '@/modules/analytics/components/DistributionTable';
import { IndividualWorkloads } from '@/modules/analytics/components/IndividualWorkloads';
import { StoryPointTrends } from '@/modules/analytics/components/StoryPointTrends';
import { useProjectAnalytics } from '@/modules/analytics/hooks/useAnalytics';
import {
  toPriorityDistribution,
  toStatusDistribution,
} from '@/modules/analytics/utils/analytics.utils';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import { ErrorState, PageSkeleton } from '@/shared/components';
import { useEscalateRouteError } from '@/shared/hooks/useEscalateRouteError';

/**
 * The project's reporting surface: headline figures, how the tasks divide,
 * story points sprint by sprint, and who carries what.
 *
 * Every figure is the server's, worked out on each read. Someone whose roles
 * do not include `analytics:view` is refused by the server and shown the
 * Forbidden screen; the tab is hidden from them only as a hint.
 */
export function ProjectAnalyticsPage() {
  const { t } = useTranslation();
  const { project } = useProjectContext();
  const { analytics, isLoading, error, refetch } = useProjectAnalytics(
    project.id,
  );

  useEscalateRouteError(error);

  const byStatus = useMemo(
    () =>
      toStatusDistribution(analytics?.taskDistributionByStatus ?? []).map(
        (row) => ({
          key: row.key,
          label: t(`enums.taskStatus.${row.key}`),
          count: row.count,
        }),
      ),
    [analytics, t],
  );
  const byPriority = useMemo(
    () =>
      toPriorityDistribution(analytics?.taskDistributionByPriority ?? []).map(
        (row) => ({
          key: row.key,
          label: t(`enums.taskPriority.${row.key}`),
          count: row.count,
        }),
      ),
    [analytics, t],
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-text-strong text-xl font-bold">
          {t('analytics.title')}
        </h2>
        <p className="text-text-subtle text-sm">{t('analytics.subtitle')}</p>
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : error || !analytics ? (
        <ErrorState
          title={t('analytics.loadFailed')}
          description={error ? t(error.messageKey as never) : undefined}
          requestId={error?.requestId}
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          <AnalyticsKpis analytics={analytics} />

          <div className="grid gap-6 lg:grid-cols-2">
            <DistributionTable
              title={t('analytics.distribution.byStatus')}
              groupLabel={t('analytics.distribution.status')}
              rows={byStatus}
            />
            <DistributionTable
              title={t('analytics.distribution.byPriority')}
              groupLabel={t('analytics.distribution.priority')}
              rows={byPriority}
            />
          </div>

          <StoryPointTrends points={analytics.storyPointTrends} />

          <IndividualWorkloads rows={analytics.individualWorkloads} />
        </>
      )}
    </section>
  );
}
