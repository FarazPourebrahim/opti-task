import { PillTab, PillTabs } from '@averoui/react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, Outlet, useMatch } from 'react-router';
import type { ParseKeys } from 'i18next';
import { useOrganization } from '@/modules/organization/hooks/useOrganization';
import type { OrganizationOutletContext } from '@/modules/organization/hooks/useOrganizationContext';
import { ErrorState, PageHeader, PageSkeleton } from '@/shared/components';
import { useBreadcrumbLabel } from '@/shared/context/breadcrumb.context';
import { useEntityIdParam } from '@/shared/hooks/useEntityIdParam';
import { useEscalateRouteError } from '@/shared/hooks/useEscalateRouteError';
import { can } from '@/shared/lib/capabilities';
import {
  CRUMB_IDS,
  ROUTE_PARAMS,
  organizationInvitationsPath,
  organizationMembersPath,
  organizationPath,
  organizationSettingsPath,
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
 * The frame around one organisation: its header and tabs, with the current
 * tab's page rendered inside. It makes the single organisation query and
 * hands the result down, so tabs do not each ask again.
 */
export function OrganizationPage() {
  const { t } = useTranslation();
  const organizationId = useEntityIdParam(ROUTE_PARAMS.organizationId);
  const {
    organization,
    roles,
    members,
    membersTotal,
    isLoading,
    error,
    refetch,
    hasMoreMembers,
    isLoadingMoreMembers,
    loadMoreMembers,
  } = useOrganization(organizationId);

  useEscalateRouteError(error);
  useBreadcrumbLabel(CRUMB_IDS.organization, organization?.name);

  if (isLoading) return <PageSkeleton />;

  if (error || !organization) {
    return (
      <ErrorState
        title={t('organization.loadFailed')}
        description={error ? t(error.messageKey as never) : undefined}
        requestId={error?.requestId}
        onRetry={() => void refetch()}
      />
    );
  }

  const context: OrganizationOutletContext = {
    organization,
    roles,
    members,
    membersTotal,
    hasMoreMembers,
    isLoadingMoreMembers,
    loadMoreMembers,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={organization.name}
        description={organization.description ?? undefined}
      />

      <PillTabs aria-label={t('organization.sections')}>
        <Tab
          to={organizationPath(organization.id)}
          labelKey="organization.tabs.projects"
          end
        />
        <Tab
          to={organizationMembersPath(organization.id)}
          labelKey="organization.tabs.members"
        />
        {/* Hints only: the server refuses these pages to anyone else. */}
        {can(roles, 'organization:manage_members') ? (
          <Tab
            to={organizationInvitationsPath(organization.id)}
            labelKey="organization.tabs.invitations"
          />
        ) : null}
        {can(roles, 'organization:update') ? (
          <Tab
            to={organizationSettingsPath(organization.id)}
            labelKey="organization.tabs.settings"
          />
        ) : null}
      </PillTabs>

      <Suspense fallback={<PageSkeleton />}>
        <Outlet context={context} />
      </Suspense>
    </div>
  );
}
