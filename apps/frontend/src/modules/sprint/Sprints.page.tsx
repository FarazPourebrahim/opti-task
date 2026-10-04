import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  useToast,
} from '@averoui/react';
import { IterationCw, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import { SprintForm } from '@/modules/sprint/components/SprintForm';
import { SPRINT_STATE_TONES } from '@/modules/sprint/constants/sprint.constants';
import {
  useCreateSprint,
  useProjectSprints,
} from '@/modules/sprint/hooks/useSprints';
import type { SprintInput } from '@/modules/sprint/schemas/sprint.schema';
import { ErrorState, LoadMore, PageSkeleton } from '@/shared/components';
import { can } from '@/shared/lib/capabilities';
import { sprintPath } from '@/shared/routes/route.constants';
import { formatCalendarDate } from '@/shared/utils/date.utils';

/** The project's sprints, newest first as the server orders them. */
export function SprintsPage() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { project, roles } = useProjectContext();
  const {
    sprints,
    totalCount,
    isLoading,
    error,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
  } = useProjectSprints(project.id);
  const { createSprint, isCreating } = useCreateSprint(project.id);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  async function handleCreate(input: SprintInput) {
    const created = await createSprint(input);
    if (!created) return;

    toast({
      tone: 'success',
      title: t('sprint.created', { name: created.name }),
    });
    setIsCreateOpen(false);
    await navigate(sprintPath(project.id, created.id));
  }

  // A hint only: the server refuses the action to anyone else.
  const createButton = can(roles, 'sprint:create') ? (
    <Button onClick={() => setIsCreateOpen(true)}>
      <Plus aria-hidden className="size-4" />
      {t('sprint.new')}
    </Button>
  ) : undefined;

  function dates(sprint: {
    startDate?: string | null;
    endDate?: string | null;
  }): string {
    const start = formatCalendarDate(sprint.startDate, i18n.language);
    const end = formatCalendarDate(sprint.endDate, i18n.language);

    if (start && end) return t('sprint.dateRange', { start, end });
    if (start) return t('sprint.startsOn', { date: start });
    if (end) return t('sprint.endsOn', { date: end });
    return t('sprint.noDates');
  }

  return (
    <section className="flex flex-col gap-4">
      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState
          title={t('sprint.listLoadFailed')}
          description={t(error.messageKey as never)}
          requestId={error.requestId}
          onRetry={() => void refetch()}
        />
      ) : sprints.length === 0 ? (
        <Card>
          <EmptyState
            variant="circle"
            icon={<IterationCw />}
            action={createButton}
          >
            {t('sprint.empty')}
          </EmptyState>
        </Card>
      ) : (
        <>
          {createButton ? (
            <div className="flex justify-end">{createButton}</div>
          ) : null}
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sprints.map((sprint) => (
              <li key={sprint.id}>
                <Card asChild interactive padding="md" className="h-full">
                  <RouterLink
                    to={sprintPath(project.id, sprint.id)}
                    className="flex flex-col gap-2"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-text-strong font-semibold">
                        {sprint.name}
                      </span>
                      <Badge tone={SPRINT_STATE_TONES[sprint.state]}>
                        {t(`enums.sprintState.${sprint.state}`)}
                      </Badge>
                    </span>
                    {sprint.goal ? (
                      <span className="text-text-subtle line-clamp-2 text-sm">
                        {sprint.goal}
                      </span>
                    ) : null}
                    <span className="text-text-subtle mt-auto flex flex-wrap justify-between gap-2 text-xs">
                      <span>{dates(sprint)}</span>
                      <span>
                        {t('sprint.taskCount', { count: sprint.taskCount })}
                      </span>
                    </span>
                  </RouterLink>
                </Card>
              </li>
            ))}
          </ul>
          <LoadMore
            shown={sprints.length}
            total={totalCount}
            hasMore={hasMore}
            isLoading={isLoadingMore}
            onLoadMore={() => void loadMore()}
          />
        </>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{t('sprint.createTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <SprintForm
              submitLabel={t('sprint.create')}
              isPending={isCreating}
              onSubmit={handleCreate}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </section>
  );
}
