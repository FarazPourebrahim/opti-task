import {
  Alert,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  useToast,
} from '@averoui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ProjectForm } from '@/modules/project/components/ProjectForm';
import { WorkflowEditor } from '@/modules/project/components/WorkflowEditor';
import { useProjectActions } from '@/modules/project/hooks/useProject';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import type { ProjectInput } from '@/modules/project/schemas/project.schema';
import { RequireCapability } from '@/shared/components';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { organizationPath } from '@/shared/routes/route.constants';

export function ProjectSettingsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const navigate = useNavigate();
  const { project, roles } = useProjectContext();
  const {
    updateProject,
    isUpdating,
    configureWorkflow,
    isConfiguring,
    deleteProject,
    forgetProject,
  } = useProjectActions(project.id);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  async function handleUpdate(input: ProjectInput) {
    await updateProject(input);
    toast({ tone: 'success', title: t('project.updated') });
  }

  async function handleDelete() {
    try {
      await deleteProject();
      toast({
        tone: 'success',
        title: t('project.deleted', { name: project.name }),
      });
      await navigate(organizationPath(project.organizationId), {
        replace: true,
      });
      forgetProject(project.organizationId);
    } catch (error) {
      showError(error);
      setIsConfirmingDelete(false);
    }
  }

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <RequireCapability
        roles={roles}
        permission="project:update"
        fallback={
          <Alert tone="neutral" title={t('project.settingsReadOnlyTitle')}>
            {t('project.settingsReadOnlyBody')}
          </Alert>
        }
      >
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t('project.settingsTitle')}</CardTitle>
          </CardHeader>
          <ProjectForm
            // Remounts with the saved values once the cache has them.
            key={`${project.name}|${project.description}`}
            initialValues={project}
            submitLabel={t('common.save')}
            isPending={isUpdating}
            onSubmit={handleUpdate}
          />
        </Card>
      </RequireCapability>

      <RequireCapability roles={roles} permission="project:configure_workflow">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t('project.workflowTitle')}</CardTitle>
          </CardHeader>
          <WorkflowEditor
            workflow={project.settings.workflow}
            isPending={isConfiguring}
            onSave={configureWorkflow}
          />
        </Card>
      </RequireCapability>

      <RequireCapability roles={roles} permission="project:delete">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t('project.deleteTitle')}</CardTitle>
          </CardHeader>
          <div className="flex flex-col items-start gap-4">
            <p className="text-text-subtle text-sm">
              {t('project.deleteBody')}
            </p>
            <Button
              variant="danger"
              onClick={() => setIsConfirmingDelete(true)}
            >
              {t('project.delete')}
            </Button>
          </div>
        </Card>
      </RequireCapability>

      <ConfirmDialog
        open={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        title={t('project.deleteConfirmTitle', { name: project.name })}
        description={t('project.deleteConfirmBody')}
        confirmLabel={t('project.delete')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        onConfirm={handleDelete}
      />
    </section>
  );
}
