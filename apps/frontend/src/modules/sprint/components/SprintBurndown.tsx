import { ChartCard, LineChart } from '@averoui/charts';
import { EmptyState } from '@averoui/react';
import { CalendarOff, LineChart as LineChartIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toBurndownRows } from '@/modules/sprint/utils/sprint.utils';

type SprintBurndownProps = {
  points: ReadonlyArray<{
    date: string;
    idealRemaining: number;
    actualRemaining: number;
  }>;
  /** The server draws no burndown for a sprint missing either date. */
  hasDates: boolean;
};

/**
 * Remaining story points per day, against the ideal straight line.
 *
 * The lines carry shape only; the chart also renders the same figures as a
 * table for anyone who cannot read it. Series colors are the chart palette's
 * own tokens.
 */
export function SprintBurndown({ points, hasDates }: SprintBurndownProps) {
  const { t, i18n } = useTranslation();
  const rows = useMemo(
    () => toBurndownRows(points, i18n.language),
    [points, i18n.language],
  );
  const series = useMemo(
    () => [
      { dataKey: 'ideal', name: t('sprint.burndown.ideal') },
      { dataKey: 'actual', name: t('sprint.burndown.actual') },
    ],
    [t],
  );

  return (
    <ChartCard
      title={t('sprint.burndown.title')}
      empty={rows.length === 0}
      emptyState={
        // Two different absences: the chart cannot exist without dates, or it
        // can and has nothing to show yet.
        hasDates ? (
          <EmptyState variant="icon" icon={<LineChartIcon />}>
            {t('sprint.burndown.empty')}
          </EmptyState>
        ) : (
          <EmptyState variant="icon" icon={<CalendarOff />}>
            {t('sprint.burndown.needsDates')}
          </EmptyState>
        )
      }
    >
      {/* Its own scroll, so a long sprint never widens the page. The chart
          renders the same rows as a table for assistive technology. */}
      <div className="h-full w-full overflow-x-auto">
        <div className="h-full min-w-80">
          <LineChart
            data={rows}
            series={series}
            xKey="day"
            label={t('sprint.burndown.label')}
          />
        </div>
      </div>
    </ChartCard>
  );
}
