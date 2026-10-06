import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@averoui/react';
import { ListTodo } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormEvent } from 'react';
import type { SprintTaskRow } from '@/modules/sprint/hooks/useSprints';
import {
  TASK_PRIORITY_TONES,
  TASK_STATUS_TONES,
} from '@/modules/task/constants/task.constants';
import { AppLink, LoadMore, SelectField } from '@/shared/components';
import { taskPath } from '@/shared/routes/route.constants';

// A select cannot hold an empty value; this stands for "nothing chosen".
const NONE = 'none';

type SprintTasksProps = {
  projectId: string;
  tasks: readonly SprintTaskRow[];
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  /** Whether the viewer may add and remove tasks — a hint, not a guard. */
  canManage: boolean;
  /** Tasks in the project that are not in this sprint. */
  candidates: ReadonlyArray<{ id: string; title: string }>;
  isAdding: boolean;
  /** Neither rejects: the caller reports a failure itself. */
  onAdd: (taskId: string) => Promise<void>;
  onRemove: (task: SprintTaskRow) => Promise<void>;
};

/** The tasks in a sprint, with a way to add one and to take one out. */
export function SprintTasks({
  projectId,
  tasks,
  total,
  hasMore,
  isLoadingMore,
  onLoadMore,
  canManage,
  candidates,
  isAdding,
  onAdd,
  onRemove,
}: SprintTasksProps) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState(NONE);
  // Which row is being removed, so only that button spins.
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (chosen === NONE) return;

    await onAdd(chosen);
    setChosen(NONE);
  }

  async function handleRemove(task: SprintTaskRow) {
    setRemoving(task.id);
    try {
      await onRemove(task);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h3">{t('sprint.tasks.title')}</CardTitle>
      </CardHeader>

      <div className="flex flex-col gap-4">
        {canManage ? (
          candidates.length === 0 ? (
            <p className="text-text-subtle text-sm">
              {t('sprint.tasks.noCandidates')}
            </p>
          ) : (
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={handleAdd}
            >
              <SelectField
                className="min-w-0 flex-1"
                label={t('sprint.tasks.addLabel')}
                hint={t('sprint.tasks.addHint')}
                value={chosen}
                onValueChange={setChosen}
                disabled={isAdding}
                options={[
                  { value: NONE, label: t('sprint.tasks.addPlaceholder') },
                  ...candidates.map((task) => ({
                    value: task.id,
                    label: task.title,
                  })),
                ]}
              />
              <Button
                type="submit"
                variant="outline"
                loading={isAdding}
                disabled={chosen === NONE}
              >
                {t('sprint.tasks.add')}
              </Button>
            </form>
          )
        ) : null}

        {tasks.length === 0 ? (
          <EmptyState variant="icon" icon={<ListTodo />}>
            {t('sprint.tasks.empty')}
          </EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('sprint.tasks.columns.task')}</TableHead>
                    <TableHead>{t('sprint.tasks.columns.status')}</TableHead>
                    <TableHead>{t('sprint.tasks.columns.priority')}</TableHead>
                    <TableHead>{t('sprint.tasks.columns.assignee')}</TableHead>
                    <TableHead>{t('sprint.tasks.columns.points')}</TableHead>
                    {canManage ? (
                      <TableHead>
                        <span className="sr-only">
                          {t('sprint.tasks.columns.actions')}
                        </span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <AppLink
                          to={taskPath(projectId, task.id)}
                          variant="subtle"
                          className="font-medium"
                        >
                          {task.title}
                        </AppLink>
                      </TableCell>
                      <TableCell>
                        <Badge tone={TASK_STATUS_TONES[task.status]}>
                          {t(`enums.taskStatus.${task.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge tone={TASK_PRIORITY_TONES[task.priority]}>
                          {t(`enums.taskPriority.${task.priority}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {task.assignee ? (
                          <span className="flex items-center gap-2">
                            <Avatar
                              size="xs"
                              name={task.assignee.name}
                              {...(task.assignee.avatarUrl
                                ? { src: task.assignee.avatarUrl }
                                : {})}
                            />
                            <span className="truncate">
                              {task.assignee.name}
                            </span>
                          </span>
                        ) : (
                          <span className="text-text-subtle">
                            {t('task.unassigned')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {task.storyPoints ?? t('task.unestimated')}
                      </TableCell>
                      {canManage ? (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={removing === task.id}
                            disabled={removing !== null}
                            aria-label={t('sprint.tasks.removeNamed', {
                              title: task.title,
                            })}
                            onClick={() => void handleRemove(task)}
                          >
                            {t('sprint.tasks.remove')}
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <LoadMore
              shown={tasks.length}
              total={total}
              hasMore={hasMore}
              isLoading={isLoadingMore}
              onLoadMore={onLoadMore}
            />
          </>
        )}
      </div>
    </Card>
  );
}
