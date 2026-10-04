import { Avatar, Button, Card, EmptyState } from '@averoui/react';
import { Building2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { CreateOrganizationDialog } from '@/modules/organization/components/CreateOrganizationDialog';
import { useOrganizations } from '@/modules/organization/hooks/useOrganizations';
import {
  ErrorState,
  LoadMore,
  PageHeader,
  PageSkeleton,
} from '@/shared/components';
import { useEscalateRouteError } from '@/shared/hooks/useEscalateRouteError';
import { organizationPath } from '@/shared/routes/route.constants';

export function OrganizationsPage() {
  const { t } = useTranslation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const {
    organizations,
    totalCount,
    isLoading,
    error,
    refetch,
    hasMore,
    isLoadingMore,
    loadMore,
  } = useOrganizations();

  useEscalateRouteError(error);

  // Anyone may create an organisation — doing so is what makes them its owner.
  const createButton = (
    <Button onClick={() => setIsCreateOpen(true)}>
      <Plus aria-hidden className="size-4" />
      {t('organization.new')}
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('organization.listTitle')}
        description={t('organization.listSubtitle')}
        actions={createButton}
      />

      {isLoading ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState
          title={t('organization.loadFailed')}
          description={t(error.messageKey as never)}
          requestId={error.requestId}
          onRetry={() => void refetch()}
        />
      ) : organizations.length === 0 ? (
        <Card>
          <EmptyState
            variant="circle"
            icon={<Building2 />}
            action={createButton}
          >
            {t('organization.empty')}
          </EmptyState>
        </Card>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {organizations.map((organization) => (
              <li key={organization.id}>
                <Card asChild interactive padding="md" className="h-full">
                  <RouterLink
                    to={organizationPath(organization.id)}
                    className="flex flex-col gap-3"
                  >
                    <span className="flex items-center gap-3">
                      <Avatar
                        name={organization.name}
                        shape="xl"
                        {...(organization.logoUrl
                          ? { src: organization.logoUrl }
                          : {})}
                      />
                      <span className="text-text-strong min-w-0 truncate font-semibold">
                        {organization.name}
                      </span>
                    </span>
                    {organization.description ? (
                      <span className="text-text-subtle line-clamp-2 text-sm">
                        {organization.description}
                      </span>
                    ) : null}
                    <span className="text-text-subtle mt-auto text-xs">
                      {t('organization.members', {
                        count: organization.memberCount,
                      })}
                      {' · '}
                      {t('organization.projects', {
                        count: organization.projectCount,
                      })}
                    </span>
                  </RouterLink>
                </Card>
              </li>
            ))}
          </ul>

          <LoadMore
            shown={organizations.length}
            total={totalCount}
            hasMore={hasMore}
            isLoading={isLoadingMore}
            onLoadMore={() => void loadMore()}
          />
        </>
      )}

      <CreateOrganizationDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  );
}
