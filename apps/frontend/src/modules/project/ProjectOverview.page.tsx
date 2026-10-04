import { Card, CardHeader, CardTitle, useToast } from '@averoui/react';
import { useTranslation } from 'react-i18next';
import type { ProjectState } from '@contracts';
import { ProjectStatusControl } from '@/modules/project/components/ProjectStatusControl';
import { useProjectActions } from '@/modules/project/hooks/useProject';
import { useProjectContext } from '@/modules/project/hooks/useProjectContext';
import { useErrorToast } from '@/shared/hooks/useErrorToast';
import { ApiError } from '@/shared/lib/apiError';
import { can } from '@/shared/lib/capabilities';

export function ProjectOverviewPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const showError = useErrorToast();
  const { project, roles } = useProjectContext();
  const { changeProjectStatus } = useProjectActions(project.id);

  async function handleStatusChange(status: ProjectState) {
    try {
      await changeProjectStatus(status);
      toast({
        tone: 'success',
        title: t('project.statusChanged', {
          status: t(`enums.projectState.${status}`),
        }),
      });
    } catch (error) {
      // Nothing was changed optimistically, so the badge still shows the
      // status the server last confirmed.
      if (ApiError.is(error) && error.kind === 'validation') {
        // The move looked legal here and the server disagreed — most likely
        // someone else moved the project first. The generic "fix the details
        // below" would point at a form that is not there.
        toast({ tone: 'danger', title: t('project.statusRejected') });
        return;
      }
      showError(error);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t('project.lifecycleTitle')}</CardTitle>
        </CardHeader>
        <ProjectStatusControl
          status={project.status}
          canChange={can(roles, 'project:update')}
          onChange={handleStatusChange}
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t('project.peopleTitle')}</CardTitle>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <dt className="text-text-subtle text-sm">
              {t('project.tabs.members')}
            </dt>
            <dd className="text-text-strong text-2xl font-bold tabular-nums">
              {project.memberCount}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-text-subtle text-sm">
              {t('project.tabs.teams')}
            </dt>
            <dd className="text-text-strong text-2xl font-bold tabular-nums">
              {project.teamCount}
            </dd>
          </div>
        </dl>
      </Card>
    </section>
  );
}
