import { PillTab, PillTabs } from '@averoui/react';
import { Suspense, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, Outlet, useMatch } from 'react-router';
import type { ParseKeys } from 'i18next';
import { useProject } from '@/modules/project/hooks/useProject';
import type { ProjectOutletContext } from '@/modules/project/hooks/useProjectContext';
import {
  AppLink,
  ErrorState,
  PageHeader,
  PageSkeleton,
} from '@/shared/components';
import { useBreadcrumbLabel } from '@/shared/context/breadcrumb.context';
import { useEntityIdParam } from '@/shared/hooks/useEntityIdParam';
import { useEscalateRouteError } from '@/shared/hooks/useEscalateRouteError';
import { can } from '@/shared/lib/capabilities';
import {
  CRUMB_IDS,
  ROUTE_PARAMS,
  organizationPath,
  projectBoardPath,
  projectMembersPath,
  projectPath,
  projectSettingsPath,
  projectTasksPath,
  projectTeamsPath,
} from '@/shared/routes/route.constants';

type TabProps = {
  to: string;
  labelKey: ParseKeys;
  /** Match the path exactly, for the tab whose path prefixes the others. */
  end?: boolean;
};

function Tab({ to, labelKey, end = false }: TabProps) {
  const { t } = useTranslation();
  const match = useMatch({ path: to, end });

  return (
    <PillTab asChild current={match !== null}>
      <RouterLink to={to}>{t(labelKey)}</RouterLink>
    </PillTab>
  );
}

/**
 * The frame around one project: its header and tabs, with the current tab's
 * page rendered inside. Sprints, epics, analytics and AI tabs join as their
 * phases land — a tab is added with the screen behind it, never
 * before.
 */
export function ProjectPage() {
  const { t } = useTranslation();
  const projectId = useEntityIdParam(ROUTE_PARAMS.projectId);
  const {
    project,
    organization,
    organizationMembers,
    roles,
    members,
    membersTotal,
    isLoading,
    error,
    refetch,
    hasMoreMembers,
    isLoadingMoreMembers,
    loadMoreMembers,
  } = useProject(projectId);

  useEscalateRouteError(error);
  useBreadcrumbLabel(CRUMB_IDS.project, project?.name);

  const candidates = useMemo(
    () =>
      organizationMembers.map((member) => ({
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
      })),
    [organizationMembers],
  );

  if (isLoading) return <PageSkeleton />;

  if (error || !project) {
    return (
      <ErrorState
        title={t('project.loadFailed')}
        description={error ? t(error.messageKey as never) : undefined}
        requestId={error?.requestId}
        onRetry={() => void refetch()}
      />
    );
  }

  const context: ProjectOutletContext = {
    project,
    roles,
    members,
    membersTotal,
    hasMoreMembers,
    isLoadingMoreMembers,
    loadMoreMembers,
    organizationMembers: candidates,
    refetchProject: refetch,
  };

  const canOpenSettings =
    can(roles, 'project:update') ||
    can(roles, 'project:configure_workflow') ||
    can(roles, 'project:delete');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        {/* Shown only when the viewer may read the organisation it sits in. */}
        {organization ? (
          <p className="text-text-subtle text-sm">
            <AppLink to={organizationPath(organization.id)} variant="subtle">
              {organization.name}
            </AppLink>
          </p>
        ) : null}
        <PageHeader
          title={project.name}
          description={project.description ?? undefined}
        />
      </div>

      <PillTabs aria-label={t('project.sections')}>
        <Tab
          to={projectPath(project.id)}
          labelKey="project.tabs.overview"
          end
        />
        <Tab to={projectBoardPath(project.id)} labelKey="project.tabs.board" />
        <Tab to={projectTasksPath(project.id)} labelKey="project.tabs.tasks" />
        <Tab
          to={projectMembersPath(project.id)}
          labelKey="project.tabs.members"
        />
        <Tab to={projectTeamsPath(project.id)} labelKey="project.tabs.teams" />
        {/* A hint only: the server refuses these actions to anyone else. */}
        {canOpenSettings ? (
          <Tab
            to={projectSettingsPath(project.id)}
            labelKey="project.tabs.settings"
          />
        ) : null}
      </PillTabs>

      <Suspense fallback={<PageSkeleton />}>
        <Outlet context={context} />
      </Suspense>
    </div>
  );
}
