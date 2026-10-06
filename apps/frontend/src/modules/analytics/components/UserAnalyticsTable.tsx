import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@averoui/react';
import { useTranslation } from 'react-i18next';
import type {
  SavedStatistics,
  UserAnalyticsData,
} from '@/modules/analytics/hooks/useAnalytics';
import {
  formatElapsed,
  formatPoints,
} from '@/modules/analytics/utils/analytics.utils';

type UserAnalyticsTableProps = {
  analytics: UserAnalyticsData;
  /** The stored copy, shown beside the live figures when it is given. */
  saved?: SavedStatistics | undefined;
};

/**
 * One person's figures. A figure the server could not work out is said in
 * words — why it is absent — never left as a blank cell.
 */
export function UserAnalyticsTable({
  analytics,
  saved,
}: UserAnalyticsTableProps) {
  const { t, i18n } = useTranslation();

  const elapsed = (seconds: number | null | undefined, absent: string) =>
    seconds === null || seconds === undefined
      ? absent
      : formatElapsed(seconds, i18n.language);
  const velocity = (value: number | null | undefined, absent: string) =>
    value === null || value === undefined
      ? absent
      : t('analytics.pointsPerSprint', {
          value: formatPoints(value, i18n.language),
        });

  const nothingSaved = t('analytics.user.nothingSaved');
  const rows = [
    {
      key: 'completedTasks',
      label: t('analytics.user.completedTasks'),
      live: String(analytics.completedTasks),
      saved: saved ? String(saved.completedTasks) : null,
    },
    {
      key: 'historicalPoints',
      label: t('analytics.user.historicalPoints'),
      live: String(analytics.historicalStoryPoints),
      saved: saved ? String(saved.historicalStoryPoints) : null,
    },
    {
      key: 'avgCompletion',
      label: t('analytics.user.avgCompletion'),
      live: elapsed(
        analytics.avgCompletionSeconds,
        t('analytics.user.noAvgCompletion'),
      ),
      saved: saved ? elapsed(saved.avgCompletionSeconds, nothingSaved) : null,
    },
    {
      key: 'velocity',
      label: t('analytics.user.velocity'),
      live: velocity(analytics.velocity, t('analytics.user.noVelocity')),
      saved: saved ? velocity(saved.velocity, nothingSaved) : null,
    },
    {
      key: 'activeAssignments',
      label: t('analytics.user.activeAssignments'),
      live: String(analytics.activeAssignments),
      saved: saved ? t('analytics.user.notKept') : null,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('analytics.user.figure')}</TableHead>
            <TableHead>
              {saved ? t('analytics.user.live') : t('analytics.user.value')}
            </TableHead>
            {saved ? <TableHead>{t('analytics.user.saved')}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>{row.label}</TableCell>
              <TableCell className="tabular-nums">{row.live}</TableCell>
              {row.saved === null ? null : (
                <TableCell className="tabular-nums">{row.saved}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
