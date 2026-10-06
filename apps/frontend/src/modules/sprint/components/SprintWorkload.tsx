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
import type { SprintWorkloadRow } from '@/modules/sprint/hooks/useSprints';

type SprintWorkloadProps = {
  rows: readonly SprintWorkloadRow[];
};

/**
 * Who carries how much of the sprint. A table with a bar in it rather than a
 * chart: the figures are the point, and the bar only compares them.
 */
export function SprintWorkload({ rows }: SprintWorkloadProps) {
  const { t } = useTranslation();
  const heaviest = Math.max(1, ...rows.map((row) => row.storyPoints));

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">{t('sprint.workload.title')}</CardTitle>
      </CardHeader>

      {rows.length === 0 ? (
        <EmptyState variant="icon" icon={<Users />}>
          {t('sprint.workload.empty')}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('sprint.workload.assignee')}</TableHead>
                <TableHead>{t('sprint.workload.tasks')}</TableHead>
                <TableHead>{t('sprint.workload.points')}</TableHead>
                <TableHead>{t('sprint.workload.share')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const name = row.user?.name ?? t('sprint.workload.unassigned');

                return (
                  <TableRow key={row.assigneeId ?? 'unassigned'}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        {row.user ? (
                          <Avatar
                            size="xs"
                            name={row.user.name}
                            {...(row.user.avatarUrl
                              ? { src: row.user.avatarUrl }
                              : {})}
                          />
                        ) : null}
                        <span className="truncate">{name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.taskCount}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.storyPoints}
                    </TableCell>
                    <TableCell className="min-w-32">
                      <Progress
                        size="sm"
                        value={row.storyPoints}
                        max={heaviest}
                        aria-label={t('sprint.workload.shareOf', {
                          name,
                          points: row.storyPoints,
                        })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
