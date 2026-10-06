import { ChartCard, LineChart } from '@averoui/charts';
import { EmptyState } from '@averoui/react';
import { LineChart as LineChartIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  summarizeTrends,
  toTrendRows,
} from '@/modules/analytics/utils/analytics.utils';

type StoryPointTrendsProps = {
  points: ReadonlyArray<{
    sprintId: string;
    name: string;
    committedStoryPoints: number;
    completedStoryPoints: number;
  }>;
};

/**
 * Story points committed and completed, sprint by sprint.
 *
 * The lines carry shape only: the chart renders the same figures as a table
 * for anyone who cannot read it, and the sentence underneath gives the totals.
 * Series colors are the chart palette's own tokens.
 */
export function StoryPointTrends({ points }: StoryPointTrendsProps) {
  const { t } = useTranslation();
  const rows = useMemo(() => toTrendRows(points), [points]);
  const summary = useMemo(() => summarizeTrends(points), [points]);
  const series = useMemo(
    () => [
      { dataKey: 'committed', name: t('analytics.trends.committed') },
      { dataKey: 'completed', name: t('analytics.trends.completed') },
    ],
    [t],
  );

  return (
    <div className="flex flex-col gap-2">
      <ChartCard
        title={t('analytics.trends.title')}
        empty={rows.length === 0}
        emptyState={
          <EmptyState variant="icon" icon={<LineChartIcon />}>
            {t('analytics.trends.empty')}
          </EmptyState>
        }
      >
        {/* Its own scroll, so a project of many sprints never widens the page.
            The chart renders the same rows as a table for assistive
            technology. */}
        <div className="h-full w-full overflow-x-auto">
          <div className="h-full min-w-80">
            <LineChart
              data={rows}
              series={series}
              xKey="sprint"
              label={t('analytics.trends.label')}
            />
          </div>
        </div>
      </ChartCard>

      {rows.length > 0 ? (
        <p className="text-text-subtle text-sm">
          {t('analytics.trends.summary', {
            count: summary.sprints,
            committed: summary.committed,
            completed: summary.completed,
          })}
        </p>
      ) : null}
    </div>
  );
}
