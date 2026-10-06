import {
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
import { ListTodo } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type DistributionTableProps = {
  title: string;
  /** The column naming what the tasks are grouped by. */
  groupLabel: string;
  rows: ReadonlyArray<{ key: string; label: string; count: number }>;
};

/**
 * How the project's tasks divide across one attribute. A table with a bar in
 * it rather than a chart: the counts are the point, and the bar only compares
 * them.
 */
export function DistributionTable({
  title,
  groupLabel,
  rows,
}: DistributionTableProps) {
  const { t } = useTranslation();
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">{title}</CardTitle>
      </CardHeader>

      {total === 0 ? (
        <EmptyState variant="icon" icon={<ListTodo />}>
          {t('analytics.distribution.empty')}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{groupLabel}</TableHead>
                <TableHead>{t('analytics.distribution.tasks')}</TableHead>
                <TableHead>{t('analytics.distribution.share')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="tabular-nums">{row.count}</TableCell>
                  <TableCell className="min-w-32">
                    <Progress
                      size="sm"
                      value={row.count}
                      max={total}
                      aria-label={t('analytics.distribution.shareOf', {
                        label: row.label,
                        count: row.count,
                        total,
                      })}
                    />
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
