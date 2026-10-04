import {
  Badge,
  Button,
  Card,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@averoui/react';
import { FolderKanban, Plus, SearchX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PROJECT_STATES } from '@contracts';
import type { ProjectState } from '@contracts';
import { useOrganizationContext } from '@/modules/organization/hooks/useOrganizationContext';
import { useOrganizationProjects } from '@/modules/organization/hooks/useOrganizationProjects';
import { CreateProjectDialog } from '@/modules/project/components/CreateProjectDialog';
import {
  AppLink,
  ErrorState,
  LoadMore,
  PageSkeleton,
  SelectField,
} from '@/shared/components';
import type { SelectOption } from '@/shared/components';
import { can } from '@/shared/lib/capabilities';
import { projectPath } from '@/shared/routes/route.constants';

const ALL_STATUSES = 'ALL';
type StatusFilter = ProjectState | typeof ALL_STATUSES;

const STATUS_TONES: Record<ProjectState, 'neutral' | 'success' | 'blue'> = {
  PLANNING: 'blue',
  ACTIVE: 'success',
  COMPLETED: 'neutral',
  ARCHIVED: 'neutral',
};

/**
 * The organisation's projects: the way into each one, and where a new one is
 * created.
 */
export function OrganizationProjectsPage() {
  const { t } = useTranslation();
  const { organization, roles } = useOrganizationContext();
  const [filter, setFilter] = useState<StatusFilter>(ALL_STATUSES);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const status = filter === ALL_STATUSES ? null : filter;
  const {
    projects,
    totalCount,
    isLoading,
    isRefreshing,
    error,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
  } = useOrganizationProjects(organization.id, status);

  const options: Array<SelectOption<StatusFilter>> = [
    { value: ALL_STATUSES, label: t('organization.projectsFilter.all') },
    ...PROJECT_STATES.map((state) => ({
      value: state,
      label: t(`enums.projectState.${state}`),
    })),
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SelectField
          label={t('organization.projectsFilter.label')}
          value={filter}
          onValueChange={setFilter}
          options={options}
          className="w-full max-w-xs"
        />
        {/* A hint only: the server refuses project creation to anyone else. */}
        {can(roles, 'project:create') ? (
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus aria-hidden className="size-4" />
            {t('organization.projectNew')}
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState
          title={t('organization.projectsLoadFailed')}
          description={t(error.messageKey as never)}
          requestId={error.requestId}
          onRetry={() => void refetch()}
        />
      ) : projects.length === 0 ? (
        <Card>
          {/* Two different absences: nothing here at all, or nothing in this
              filter. The second is not a reason to create a project. */}
          {status === null ? (
            <EmptyState variant="circle" icon={<FolderKanban />}>
              {t('organization.projectsEmpty')}
            </EmptyState>
          ) : (
            <EmptyState variant="circle" icon={<SearchX />}>
              {t('organization.projectsEmptyFiltered', {
                status: t(`enums.projectState.${status}`),
              })}
            </EmptyState>
          )}
        </Card>
      ) : (
        <>
          <Table aria-busy={isRefreshing}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('organization.projectColumns.name')}</TableHead>
                <TableHead>{t('organization.projectColumns.status')}</TableHead>
                <TableHead>
                  {t('organization.projectColumns.members')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <AppLink
                      to={projectPath(project.id)}
                      variant="subtle"
                      className="block font-medium"
                    >
                      {project.name}
                    </AppLink>
                    {project.description ? (
                      <span className="text-text-subtle line-clamp-1 block text-xs">
                        {project.description}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge tone={STATUS_TONES[project.status]}>
                      {t(`enums.projectState.${project.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>{project.memberCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <LoadMore
            shown={projects.length}
            total={totalCount}
            hasMore={hasMore}
            isLoading={isLoadingMore}
            onLoadMore={() => void loadMore()}
          />
        </>
      )}
      <CreateProjectDialog
        organizationId={organization.id}
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </section>
  );
}
