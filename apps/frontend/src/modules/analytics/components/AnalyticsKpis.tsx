import { Card, CardHeader, CardTitle, Progress } from '@averoui/react';
import { useTranslation } from 'react-i18next';
import type { ProjectAnalyticsData } from '@/modules/analytics/hooks/useAnalytics';
import { formatPoints } from '@/modules/analytics/utils/analytics.utils';
import { toPercent } from '@/modules/sprint/utils/sprint.utils';

type AnalyticsKpisProps = {
  analytics: ProjectAnalyticsData;
};

type FigureProps = { label: string; value: string; hint?: string };

function Figure({ label, value, hint }: FigureProps) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-text-subtle text-xs">{label}</dt>
      <dd className="flex flex-col gap-1">
        <span className="text-text-strong text-lg font-semibold tabular-nums">
          {value}
        </span>
        {hint ? <span className="text-text-subtle text-xs">{hint}</span> : null}
      </dd>
    </div>
  );
}

/** The project's headline figures, as the server computed them. */
export function AnalyticsKpis({ analytics }: AnalyticsKpisProps) {
  const { t, i18n } = useTranslation();
  const completion = toPercent(analytics.completionRate);

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">{t('analytics.kpis.title')}</CardTitle>
      </CardHeader>

      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Figure
            label={t('analytics.kpis.totalTasks')}
            value={String(analytics.totalTasks)}
          />
          <Figure
            label={t('analytics.kpis.completedTasks')}
            value={String(analytics.completedTasks)}
          />
          <Figure
            label={t('analytics.kpis.totalPoints')}
            value={String(analytics.totalStoryPoints)}
          />
          <Figure
            label={t('analytics.kpis.completedPoints')}
            value={String(analytics.completedStoryPoints)}
          />
          <Figure
            label={t('analytics.kpis.velocity')}
            value={t('analytics.pointsPerSprint', {
              value: formatPoints(analytics.teamVelocity, i18n.language),
            })}
            hint={t('analytics.kpis.velocityHint')}
          />
        </dl>

        <div className="flex flex-col gap-2">
          <p className="text-text-subtle flex items-center justify-between text-sm">
            <span id="analytics-completion-label">
              {t('analytics.kpis.completionRate')}
            </span>
            <span className="tabular-nums">
              {t('analytics.percent', { value: completion })}
            </span>
          </p>
          <Progress
            value={completion}
            tone="success"
            aria-labelledby="analytics-completion-label"
          />
          <p className="text-text-subtle text-xs">
            {t('analytics.kpis.completionHint')}
          </p>
        </div>
      </div>
    </Card>
  );
}
