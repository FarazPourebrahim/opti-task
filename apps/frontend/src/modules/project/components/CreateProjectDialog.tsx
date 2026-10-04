import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  useToast,
} from '@averoui/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ProjectForm } from '@/modules/project/components/ProjectForm';
import { useCreateProject } from '@/modules/project/hooks/useProject';
import type { ProjectInput } from '@/modules/project/schemas/project.schema';
import { projectPath } from '@/shared/routes/route.constants';

type CreateProjectDialogProps = {
  organizationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateProjectDialog({
  organizationId,
  open,
  onOpenChange,
}: CreateProjectDialogProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { createProject, isCreating } = useCreateProject(organizationId);

  async function handleSubmit(input: ProjectInput) {
    const created = await createProject(input);
    if (!created) return;

    toast({
      tone: 'success',
      title: t('project.created', { name: created.name }),
    });
    onOpenChange(false);
    await navigate(projectPath(created.id));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('project.createTitle')}</DialogTitle>
          <DialogDescription>
            {t('project.createDescription')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ProjectForm
            submitLabel={t('project.create')}
            isPending={isCreating}
            onSubmit={handleSubmit}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
