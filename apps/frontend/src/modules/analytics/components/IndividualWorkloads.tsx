import {
  Avatar,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  Progress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@averoui/react';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { IndividualWorkloadRow } from '@/modules/analytics/hooks/useAnalytics';
import { AppLink } from '@/shared/components';
import { userPath } from '@/shared/routes/route.constants';

type IndividualWorkloadsProps = {
  rows: readonly IndividualWorkloadRow[];
};

/**
 * What each assignee carries now and has finished. The bar compares open
 * story points against whoever carries the most.
 */
export function IndividualWorkloads({ rows }: IndividualWorkloadsProps) {
  const { t } = useTranslation();
  const heaviest = Math.max(1, ...rows.map((row) => row.activeStoryPoints));

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">{t('analytics.workloads.title')}</CardTitle>
      </CardHeader>

      {rows.length === 0 ? (
        <EmptyState variant="icon" icon={<Users />}>
          {t('analytics.workloads.empty')}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('analytics.workloads.assignee')}</TableHead>
                <TableHead>{t('analytics.workloads.activeTasks')}</TableHead>
                <TableHead>{t('analytics.workloads.activePoints')}</TableHead>
                <TableHead>{t('analytics.workloads.load')}</TableHead>
                <TableHead>{t('analytics.workloads.completedTasks')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.assigneeId}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Avatar
                        size="xs"
                        name={row.user.name}
                        {...(row.user.avatarUrl
                          ? { src: row.user.avatarUrl }
                          : {})}
                      />
                      <AppLink
                        to={userPath(row.user.id)}
                        variant="subtle"
                        className="truncate"
                      >
                        {row.user.name}
                      </AppLink>
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.activeTasks}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.activeStoryPoints}
                  </TableCell>
                  <TableCell className="min-w-32">
                    <Progress
                      size="sm"
                      value={row.activeStoryPoints}
                      max={heaviest}
                      aria-label={t('analytics.workloads.loadOf', {
                        name: row.user.name,
                        points: row.activeStoryPoints,
                      })}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.completedTasks}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
