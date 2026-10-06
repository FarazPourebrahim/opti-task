import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  Progress,
} from '@averoui/react';
import { GraduationCap, Sparkles, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MyAnalytics } from '@/modules/analytics/components/MyAnalytics';
import { PersonAnalytics } from '@/modules/analytics/components/PersonAnalytics';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useUserProfile } from '@/modules/user/hooks/useProfile';
import { toConfidencePercent } from '@/modules/user/schemas/user.schema';
import { ErrorState, PageSkeleton } from '@/shared/components';
import { useBreadcrumbLabel } from '@/shared/context/breadcrumb.context';
import { useEntityIdParam } from '@/shared/hooks/useEntityIdParam';
import { useEscalateRouteError } from '@/shared/hooks/useEscalateRouteError';
import { CRUMB_IDS, ROUTE_PARAMS } from '@/shared/routes/route.constants';

/**
 * Another person's profile, read-only: who they are, what they are good at,
 * and — for those the server allows — their delivery figures.
 */
export function UserProfilePage() {
  const { t } = useTranslation();
  const { user: viewer } = useAuth();
  const userId = useEntityIdParam(ROUTE_PARAMS.userId);
  const { profile, isLoading, error, refetch } = useUserProfile(userId);

  useEscalateRouteError(error);
  useBreadcrumbLabel(CRUMB_IDS.user, profile?.name);

  if (isLoading) return <PageSkeleton />;

  if (error || !profile) {
    return (
      <ErrorState
        title={t('user.profileLoadFailed')}
        description={error ? t(error.messageKey as never) : undefined}
        requestId={error?.requestId}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar
          name={profile.name}
          size="lg"
          {...(profile.avatarUrl ? { src: profile.avatarUrl } : {})}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-text-strong truncate text-2xl font-bold tracking-tight">
            {profile.name}
          </h1>
          {profile.seniority ? (
            <p className="text-text-subtle text-sm">
              {t(`enums.seniority.${profile.seniority}`)}
            </p>
          ) : null}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t('user.skillsTitle')}</CardTitle>
        </CardHeader>
        {profile.skills.length === 0 ? (
          <EmptyState variant="circle" icon={<Sparkles />}>
            {t('user.otherSkillsEmpty')}
          </EmptyState>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <li
                key={skill}
                className="bg-surface-sunken text-text-strong rounded-full px-3 py-1 text-sm"
              >
                {skill}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t('user.expertiseTitle')}</CardTitle>
        </CardHeader>
        {profile.expertise.length === 0 ? (
          <EmptyState variant="circle" icon={<GraduationCap />}>
            {t('user.otherExpertiseEmpty')}
          </EmptyState>
        ) : (
          <ul className="divide-border-subtle flex flex-col divide-y">
            {profile.expertise.map((item) => {
              const percent = toConfidencePercent(item.confidenceScore);

              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span className="text-text-strong min-w-32 flex-1 text-sm font-medium">
                    {item.tag}
                  </span>
                  <Progress
                    value={percent}
                    aria-label={t('user.expertiseConfidenceFor', {
                      tag: item.tag,
                    })}
                    className="w-32"
                  />
                  <span className="text-text-subtle w-12 text-end text-sm tabular-nums">
                    {t('user.percent', { value: percent })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t('user.teamsTitle')}</CardTitle>
        </CardHeader>
        {profile.teamMemberships.length === 0 ? (
          <EmptyState variant="circle" icon={<UsersRound />}>
            {t('user.teamsEmpty')}
          </EmptyState>
        ) : (
          <ul className="divide-border-subtle flex flex-col divide-y">
            {profile.teamMemberships.map((membership) => (
              <li
                key={membership.teamId}
                className="flex flex-wrap items-center gap-2 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-text-strong flex-1 text-sm font-medium">
                  {membership.teamName}
                </span>
                <Badge>{t(`enums.teamRole.${membership.role}`)}</Badge>
                <Badge variant="outline">
                  {t(`enums.availability.${membership.availability}`)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {profile.id === viewer?.id ? (
        <MyAnalytics userId={profile.id} />
      ) : (
        <PersonAnalytics userId={profile.id} name={profile.name} />
      )}
    </div>
  );
}
