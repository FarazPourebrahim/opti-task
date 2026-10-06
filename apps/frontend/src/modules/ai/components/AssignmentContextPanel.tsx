import {
  Avatar,
  Button,
  EmptyState,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@averoui/react';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAssignmentContext } from '@/modules/ai/hooks/useAiRecommendations';
import { AppLink, ErrorState } from '@/shared/components';
import { userPath } from '@/shared/routes/route.constants';

type AssignmentContextPanelProps = {
  taskId: string;
};

/**
 * Who an assignment suggestion chooses among, and what it is given about each
 * of them — so the suggestion can be checked rather than taken on trust.
 *
 * Read only when asked for: it is a second request, and most visits to a task
 * do not need it.
 */
export function AssignmentContextPanel({
  taskId,
}: AssignmentContextPanelProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { candidates, isLoading, error, refetch } = useAssignmentContext(
    taskId,
    isOpen,
  );

  function list(values: readonly string[]): string {
    return values.length === 0 ? t('ai.context.none') : values.join(', ');
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? t('ai.context.hide') : t('ai.context.show')}
        </Button>
      </div>

      {!isOpen ? null : isLoading ? (
        <div aria-busy="true" aria-label={t('ai.context.loading')}>
          <SkeletonText lines={3} />
        </div>
      ) : error ? (
        <ErrorState
          title={t('ai.context.loadFailed')}
          description={t(error.messageKey as never)}
          requestId={error.requestId}
          onRetry={() => void refetch()}
        />
      ) : candidates.length === 0 ? (
        <EmptyState variant="icon" icon={<Users />}>
          {t('ai.context.empty')}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <Table aria-label={t('ai.context.title')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ai.context.person')}</TableHead>
                <TableHead>{t('ai.context.skills')}</TableHead>
                <TableHead>{t('ai.context.expertise')}</TableHead>
                <TableHead>{t('ai.context.availability')}</TableHead>
                <TableHead>{t('ai.context.workload')}</TableHead>
                <TableHead>{t('ai.context.active')}</TableHead>
                <TableHead>{t('ai.context.completed')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((candidate) => (
                <TableRow key={candidate.user.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <Avatar
                        size="xs"
                        name={candidate.user.name}
                        {...(candidate.user.avatarUrl
                          ? { src: candidate.user.avatarUrl }
                          : {})}
                      />
                      <AppLink
                        to={userPath(candidate.user.id)}
                        variant="subtle"
                        className="font-medium"
                      >
                        {candidate.user.name}
                      </AppLink>
                    </span>
                  </TableCell>
                  <TableCell>{list(candidate.skills)}</TableCell>
                  <TableCell>{list(candidate.expertise)}</TableCell>
                  <TableCell>
                    {candidate.availability
                      ? t(`enums.availability.${candidate.availability}`)
                      : t('ai.context.unknown')}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {candidate.workload}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {candidate.activeTaskCount}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {candidate.completedTasks}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
