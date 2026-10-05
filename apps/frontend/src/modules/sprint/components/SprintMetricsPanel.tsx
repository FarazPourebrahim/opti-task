import { Alert, Card, CardHeader, CardTitle, Progress } from '@averoui/react';
import { useTranslation } from 'react-i18next';
import type { SprintMetricsData } from '@/modules/sprint/hooks/useSprints';
import { toPercent } from '@/modules/sprint/utils/sprint.utils';

type SprintMetricsPanelProps = {
  metrics: SprintMetricsData;
};

type FigureProps = { label: string; value: string };

function Figure({ label, value }: FigureProps) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-text-subtle text-xs">{label}</dt>
      <dd className="text-text-strong text-lg font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}

/** The sprint's figures, as the server computed them. Props in, markup out. */
export function SprintMetricsPanel({ metrics }: SprintMetricsPanelProps) {
  const { t } = useTranslation();
  const completion = toPercent(metrics.completionRate);
  const capacity = metrics.capacity;
  const hasCapacity = capacity !== null && capacity !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">{t('sprint.metrics.title')}</CardTitle>
      </CardHeader>

      <div className="flex flex-col gap-5">
        {/* Said in words and as an alert, not by color alone. */}
        {metrics.overCapacity && hasCapacity ? (
          <Alert tone="danger" title={t('sprint.metrics.overCapacityTitle')}>
            {t('sprint.metrics.overCapacityBody', {
              committed: metrics.totalStoryPoints,
              capacity,
              over: metrics.totalStoryPoints - capacity,
            })}
          </Alert>
        ) : null}

        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Figure
            label={t('sprint.metrics.totalPoints')}
            value={String(metrics.totalStoryPoints)}
          />
          <Figure
            label={t('sprint.metrics.completedPoints')}
            value={String(metrics.completedStoryPoints)}
          />
          <Figure
            label={t('sprint.metrics.remainingPoints')}
            value={String(metrics.remainingStoryPoints)}
          />
          <Figure
            label={t('sprint.metrics.tasks')}
            value={t('sprint.metrics.tasksValue', {
              completed: metrics.completedTasks,
              total: metrics.totalTasks,
            })}
          />
          <Figure
            label={t('sprint.metrics.velocity')}
            value={String(metrics.velocity)}
          />
          <Figure
            label={t('sprint.metrics.capacity')}
            value={
              hasCapacity ? String(capacity) : t('sprint.metrics.noCapacity')
            }
          />
        </dl>

        <div className="flex flex-col gap-2">
          <p className="text-text-subtle flex items-center justify-between text-sm">
            <span id="sprint-completion-label">
              {t('sprint.metrics.completionRate')}
            </span>
            <span className="tabular-nums">
              {t('sprint.metrics.percent', { value: completion })}
            </span>
          </p>
          <Progress
            value={completion}
            tone="success"
            aria-labelledby="sprint-completion-label"
          />
        </div>

        {hasCapacity ? (
          <div className="flex flex-col gap-2">
            <p className="text-text-subtle flex items-center justify-between text-sm">
              <span id="sprint-capacity-label">
                {t('sprint.metrics.capacityUse')}
              </span>
              <span className="tabular-nums">
                {t('sprint.metrics.capacityValue', {
                  committed: metrics.totalStoryPoints,
                  capacity,
                })}
              </span>
            </p>
            <Progress
              value={Math.min(metrics.totalStoryPoints, capacity)}
              // A capacity of 0 cannot be a maximum; any commitment fills it.
              max={Math.max(capacity, 1)}
              tone={metrics.overCapacity ? 'danger' : 'primary'}
              aria-labelledby="sprint-capacity-label"
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
