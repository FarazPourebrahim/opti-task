import { Card, CardHeader, CardTitle } from '@averoui/react';
import { useTranslation } from 'react-i18next';
import { MyAnalytics } from '@/modules/analytics/components/MyAnalytics';
import { ExpertiseEditor } from '@/modules/user/components/ExpertiseEditor';
import { ProfileForm } from '@/modules/user/components/ProfileForm';
import { SkillsEditor } from '@/modules/user/components/SkillsEditor';
import { useMyProfile } from '@/modules/user/hooks/useProfile';
import { ErrorState, PageHeader, PageSkeleton } from '@/shared/components';

export function ProfilePage() {
  const { t } = useTranslation();
  const { profile, isLoading, error, refetch } = useMyProfile();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader
        title={t('user.profileTitle')}
        description={t('user.profileSubtitle')}
      />

      {isLoading ? (
        <PageSkeleton />
      ) : error || !profile ? (
        <ErrorState
          title={t('user.profileLoadFailed')}
          description={error ? t(error.messageKey as never) : undefined}
          requestId={error?.requestId}
          onRetry={() => void refetch()}
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle as="h2">{t('user.detailsTitle')}</CardTitle>
            </CardHeader>
            <ProfileForm profile={profile} />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{t('user.skillsTitle')}</CardTitle>
            </CardHeader>
            <SkillsEditor skills={profile.skills} />
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-1">
                <CardTitle as="h2">{t('user.expertiseTitle')}</CardTitle>
                <p className="text-text-subtle text-sm">
                  {t('user.expertiseSubtitle')}
                </p>
              </div>
            </CardHeader>
            <ExpertiseEditor expertise={profile.expertise} />
          </Card>

          <MyAnalytics userId={profile.id} />
        </>
      )}
    </div>
  );
}
