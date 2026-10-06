import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  useToast,
} from '@averoui/react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import { TaskForm } from '@/modules/task/components/TaskForm';
import { useCreateTask } from '@/modules/task/hooks/useTaskActions';
import { useProjectPlanning } from '@/modules/task/hooks/useTasks';
import type { CreateTaskInput } from '@/modules/task/schemas/task.schema';

type CreateTaskDialogProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateTaskDialog({
  projectId,
  open,
  onOpenChange,
}: CreateTaskDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { members } = useProjectContext();
  const { sprints, epics } = useProjectPlanning(projectId);
  const { createTask, isCreating } = useCreateTask(projectId);

  const assignees = useMemo(
    () =>
      members.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
      })),
    [members],
  );

  async function handleSubmit(input: CreateTaskInput) {
    const created = await createTask(input);
    if (!created) return;

    toast({
      tone: 'success',
      title: t('task.created', { title: created.title }),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('task.createTitle')}</DialogTitle>
          <DialogDescription>{t('task.createDescription')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <TaskForm
            mode="create"
            assignees={assignees}
            sprints={sprints}
            epics={epics}
            submitLabel={t('task.create')}
            isPending={isCreating}
            onSubmit={handleSubmit}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
