import {
  Badge,
  Card,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@averoui/react';
import { FolderKanban, SearchX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PROJECT_STATES } from '@contracts';
import type { ProjectState } from '@contracts';
import { useOrganizationContext } from '@/modules/organization/hooks/useOrganizationContext';
import { useOrganizationProjects } from '@/modules/organization/hooks/useOrganizationProjects';
import {
  ErrorState,
  LoadMore,
  PageSkeleton,
  SelectField,
} from '@/shared/components';
import type { SelectOption } from '@/shared/components';

const ALL_STATUSES = 'ALL';
type StatusFilter = ProjectState | typeof ALL_STATUSES;

const STATUS_TONES: Record<ProjectState, 'neutral' | 'success' | 'blue'> = {
  PLANNING: 'blue',
  ACTIVE: 'success',
  COMPLETED: 'neutral',
  ARCHIVED: 'neutral',
};

/**
 * The organisation's projects. Read-only for now: creating a project and its
 * own screens arrive with Phase 7, so rows are not links yet.
 */
export function OrganizationProjectsPage() {
  const { t } = useTranslation();
  const { organization } = useOrganizationContext();
  const [filter, setFilter] = useState<StatusFilter>(ALL_STATUSES);

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
      <SelectField
        label={t('organization.projectsFilter.label')}
        value={filter}
        onValueChange={setFilter}
        options={options}
        className="max-w-xs"
      />

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
                    <span className="text-text-strong block font-medium">
                      {project.name}
                    </span>
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
    </section>
  );
}
