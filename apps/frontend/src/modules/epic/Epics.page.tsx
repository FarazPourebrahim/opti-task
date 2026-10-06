import {
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Progress,
  useToast,
} from '@averoui/react';
import { Layers, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate } from 'react-router';
import { EpicForm } from '@/modules/epic/components/EpicForm';
import { useCreateEpic, useProjectEpics } from '@/modules/epic/hooks/useEpics';
import type { EpicInput } from '@/modules/epic/schemas/epic.schema';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import { ErrorState, LoadMore, PageSkeleton } from '@/shared/components';
import { can } from '@/shared/lib/capabilities';
import { epicPath } from '@/shared/routes/route.constants';

/** The project's epics, each with how far along its tasks are. */
export function EpicsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { project, roles } = useProjectContext();
  const {
    epics,
    totalCount,
    isLoading,
    error,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
  } = useProjectEpics(project.id);
  const { createEpic, isCreating } = useCreateEpic(project.id);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  async function handleCreate(input: EpicInput) {
    const created = await createEpic(input);
    if (!created) return;

    toast({
      tone: 'success',
      title: t('epic.created', { name: created.name }),
    });
    setIsCreateOpen(false);
    await navigate(epicPath(project.id, created.id));
  }

  // A hint only: the server refuses the action to anyone else.
  const createButton = can(roles, 'epic:create') ? (
    <Button onClick={() => setIsCreateOpen(true)}>
      <Plus aria-hidden className="size-4" />
      {t('epic.new')}
    </Button>
  ) : undefined;

  return (
    <section className="flex flex-col gap-4">
      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState
          title={t('epic.listLoadFailed')}
          description={t(error.messageKey as never)}
          requestId={error.requestId}
          onRetry={() => void refetch()}
        />
      ) : epics.length === 0 ? (
        <Card>
          <EmptyState variant="circle" icon={<Layers />} action={createButton}>
            {t('epic.empty')}
          </EmptyState>
        </Card>
      ) : (
        <>
          {createButton ? (
            <div className="flex justify-end">{createButton}</div>
          ) : null}
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {epics.map((epic) => {
              const percent = Math.round(epic.progress);

              return (
                <li key={epic.id}>
                  <Card asChild interactive padding="md" className="h-full">
                    <RouterLink
                      to={epicPath(project.id, epic.id)}
                      className="flex flex-col gap-2"
                    >
                      <span className="text-text-strong font-semibold">
                        {epic.name}
                      </span>
                      {epic.description ? (
                        <span className="text-text-subtle line-clamp-2 text-sm">
                          {epic.description}
                        </span>
                      ) : null}
                      <span className="mt-auto flex flex-col gap-1.5 pt-2">
                        <span className="text-text-subtle flex justify-between gap-2 text-xs tabular-nums">
                          <span>
                            {t('epic.tasksDone', {
                              completed: epic.completedTasks,
                              total: epic.totalTasks,
                            })}
                          </span>
                          <span>{t('epic.percent', { value: percent })}</span>
                        </span>
                        <Progress
                          size="sm"
                          value={percent}
                          tone="success"
                          aria-label={t('epic.progressOf', {
                            name: epic.name,
                          })}
                        />
                      </span>
                    </RouterLink>
                  </Card>
                </li>
              );
            })}
          </ul>
          <LoadMore
            shown={epics.length}
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
            <DialogTitle>{t('epic.createTitle')}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <EpicForm
              submitLabel={t('epic.create')}
              isPending={isCreating}
              onSubmit={handleCreate}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </section>
  );
}
